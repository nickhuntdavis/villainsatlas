// scripts/backfill-images.js
// One-off script to backfill Baserow `image_url` fields using Google Places Photos.
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-images.js

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID = process.env.BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

if (!TABLE_ID || !BASEROW_TOKEN || !MAPS_KEY) {
  console.error(
    "Missing required env vars. Please set BASEROW_TABLE_ID, BASEROW_TOKEN, and GOOGLE_MAPS_API_KEY."
  );
  process.exit(1);
}

// Fetch all rows from Baserow with basic pagination
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

// For a given Google Place ID, fetch a representative photo URL
async function getPhotoUrlForPlaceId(placeId) {
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=photos&key=${MAPS_KEY}`;

  const res = await fetch(detailsUrl);
  if (!res.ok) {
    console.warn(`Places Details error for ${placeId}: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  const photos = data.result && data.result.photos;
  if (!photos || !photos.length) {
    return null;
  }

  const photoRef = photos[0].photo_reference;
  if (!photoRef) return null;

  // Construct photo URL (Google will redirect; fine for <img src="...">)
  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
    photoRef
  )}&key=${MAPS_KEY}`;

  return photoUrl;
}

// PATCH Baserow row with image_url
async function updateRowImage(rowId, imageUrl) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url: imageUrl }),
  });

  if (!res.ok) {
    console.warn(`Failed to update row ${rowId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

async function main() {
  console.log("Fetching rows from Baserow...");
  const rows = await fetchAllRows();
  console.log(`Fetched ${rows.length} rows from Baserow`);

  for (const row of rows) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const placeId = row.google_place_id;
    const imageUrl = row.image_url;

    // Skip if no place_id
    if (!placeId || String(placeId).trim() === "") continue;

    console.log(`Processing "${name}" (row ${rowId}) with place_id=${placeId} ...`);

    try {
      const photoUrl = await getPhotoUrlForPlaceId(placeId);
      if (!photoUrl) {
        console.log(`  No photo found for place_id=${placeId}`);

        // If we previously had a non-Google image URL (e.g., Wikimedia) that may not work,
        // clear it so the frontend shows the fallback state instead of a broken image.
        if (imageUrl && !String(imageUrl).includes("maps.googleapis.com/maps/api/place/photo")) {
          const cleared = await updateRowImage(rowId, "");
          if (cleared) {
            console.log(`  ⛔ Cleared non-Google image_url for row ${rowId}`);
          }
        }

        continue;
      }

      const ok = await updateRowImage(rowId, photoUrl);
      if (ok) {
        console.log(`  ✅ Saved image_url for row ${rowId}`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Error processing row ${rowId}:`, err);
    }

    // Small delay to be polite to APIs
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


