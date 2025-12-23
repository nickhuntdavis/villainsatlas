// scripts/backfill-graveyard-coords-and-images.js
// Verify lat/lng and backfill image_url for graveyards using Google Place IDs
// This script will:
// 1) Fetch all graveyards from Baserow that have google_place_id
// 2) For each, fetch Google Places Details API to get:
//    - geometry.location (lat/lng) - verify and update if different
//    - photos (for image_url) - backfill if missing
// 3) Update Baserow with verified coordinates and images
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-graveyard-coords-and-images.js

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID =
  process.env.BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

if (!TABLE_ID || !BASEROW_TOKEN || !MAPS_KEY) {
  console.error(
    "Missing required env vars. Please set BASEROW_TABLE_ID / REACT_APP_BASEROW_TABLE_ID, BASEROW_TOKEN / REACT_APP_BASEROW_API_TOKEN, and GOOGLE_MAPS_API_KEY (or REACT_APP_GOOGLE_MAPS_API_KEY)."
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to check if an image URL is from Google Places
function isGooglePlacesImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return false;
  return imageUrl.includes("maps.googleapis.com/maps/api/place/photo");
}

// Fetch all rows from Baserow with pagination
async function fetchAllRows() {
  let page = 1;
  const pageSize = 200;
  const rows = [];

  while (true) {
    const url = `${BASEROW_BASE}/${TABLE_ID}/?user_field_names=true&page=${page}&size=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Baserow error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    rows.push(...data.results);

    if (!data.next) break; // no more pages
    page += 1;
  }

  return rows;
}

// Fetch Place Details from Google Places API
async function getPlaceDetails(placeId) {
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=place_id,geometry,photos,url&key=${MAPS_KEY}`;

  const res = await fetch(detailsUrl);
  if (!res.ok) {
    console.warn(
      `Places Details error for ${placeId}: ${res.status} ${res.statusText}`
    );
    return null;
  }

  const data = await res.json();
  if (data.status !== "OK" || !data.result) {
    console.warn(`Places Details status error for ${placeId}: ${data.status}`);
    return null;
  }

  const result = data.result;

  // Extract coordinates
  let lat = null;
  let lng = null;
  if (result.geometry && result.geometry.location) {
    lat = result.geometry.location.lat;
    lng = result.geometry.location.lng;
  }

  // Extract photo URL
  let photoUrl = null;
  const photos = result.photos;
  if (Array.isArray(photos) && photos.length > 0) {
    const photoRef = photos[0].photo_reference;
    if (photoRef) {
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
        photoRef
      )}&key=${MAPS_KEY}`;
    }
  }

  const mapsUrl = result.url || null;

  return { lat, lng, photoUrl, mapsUrl };
}

// Calculate distance between two coordinates in meters (Haversine formula)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// PATCH Baserow row with updates
async function updateRow(rowId, updates) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    console.warn(`Failed to update row ${rowId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

async function main() {
  console.log("Fetching all rows from Baserow...");
  const allRows = await fetchAllRows();
  console.log(`Fetched ${allRows.length} total rows from Baserow\n`);

  // Filter for graveyards with google_place_id
  const graveyards = allRows.filter((row) => {
    const style = String(row.style || "").trim();
    const placeId = row.google_place_id;
    const hasGraveyardStyle =
      style === "Graveyard" ||
      style.toLowerCase().includes("graveyard") ||
      style.toLowerCase().includes("cemetery");
    const hasPlaceId = placeId && String(placeId).trim() !== "";
    return hasGraveyardStyle && hasPlaceId;
  });

  console.log(`Found ${graveyards.length} graveyards with google_place_id\n`);

  let processed = 0;
  let coordsUpdated = 0;
  let coordsVerified = 0;
  let imagesUpdated = 0;
  let imagesSkipped = 0;
  let errors = 0;

  for (const row of graveyards) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const placeId = row.google_place_id;
    const currentLat = parseFloat(row.lat) || null;
    const currentLng = parseFloat(row.lng) || null;
    const currentImageUrl = String(row.image_url || "").trim();

    processed++;
    console.log(`[${processed}/${graveyards.length}] Processing "${name}" (row ${rowId})`);
    console.log(`   Place ID: ${placeId}`);

    try {
      // Fetch Place Details
      const details = await getPlaceDetails(placeId);
      await sleep(300); // Be polite to the API

      if (!details) {
        console.log(`   ⚠️  Could not fetch Place Details\n`);
        errors++;
        continue;
      }

      const updates = {};
      let hasUpdates = false;

      // Verify and update coordinates
      if (details.lat !== null && details.lng !== null) {
        if (currentLat === null || currentLng === null) {
          // Missing coordinates - add them
          updates.lat = String(details.lat);
          updates.lng = String(details.lng);
          hasUpdates = true;
          coordsUpdated++;
          console.log(`   ✅ Adding coordinates: ${details.lat}, ${details.lng}`);
        } else {
          // Check if coordinates differ significantly (more than 100 meters)
          const distance = getDistance(currentLat, currentLng, details.lat, details.lng);
          if (distance > 100) {
            // Coordinates differ significantly - update them
            updates.lat = String(details.lat);
            updates.lng = String(details.lng);
            hasUpdates = true;
            coordsUpdated++;
            console.log(
              `   ✅ Updating coordinates (${distance.toFixed(0)}m difference): ${details.lat}, ${details.lng}`
            );
          } else {
            coordsVerified++;
            console.log(
              `   ✓ Coordinates verified (${distance.toFixed(0)}m difference)`
            );
          }
        }
      } else {
        console.log(`   ⚠️  No coordinates in Place Details`);
      }

      // Backfill image URL
      if (details.photoUrl) {
        if (!currentImageUrl || currentImageUrl === "" || !isGooglePlacesImage(currentImageUrl)) {
          updates.image_url = details.photoUrl;
          hasUpdates = true;
          imagesUpdated++;
          console.log(`   ✅ Adding image_url`);
        } else {
          imagesSkipped++;
          console.log(`   ℹ️  Image URL already exists`);
        }
      } else {
        console.log(`   ⚠️  No photo available in Place Details`);
      }

      // Update Gmaps URL if available and missing
      if (details.mapsUrl && (!row.Gmaps_url || String(row.Gmaps_url).trim() === "")) {
        updates.Gmaps_url = details.mapsUrl;
        hasUpdates = true;
        console.log(`   ✅ Adding Gmaps_url`);
      }

      // Update Baserow if there are changes
      if (hasUpdates) {
        const ok = await updateRow(rowId, updates);
        await sleep(300); // Be polite to the API

        if (ok) {
          console.log(`   ✅ Updated: ${Object.keys(updates).join(", ")}\n`);
        } else {
          console.log(`   ⚠️  Failed to update Baserow\n`);
          errors++;
        }
      } else {
        console.log(`   ℹ️  No updates needed\n`);
      }
    } catch (err) {
      console.warn(`   ⚠️  Error processing row ${rowId}:`, err.message);
      errors++;
      console.log("");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Backfill complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Coordinates updated: ${coordsUpdated}`);
  console.log(`   Coordinates verified: ${coordsVerified}`);
  console.log(`   Images updated: ${imagesUpdated}`);
  console.log(`   Images skipped (already exist): ${imagesSkipped}`);
  console.log(`   Errors: ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

