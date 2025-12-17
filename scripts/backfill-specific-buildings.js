// scripts/backfill-specific-buildings.js
// Targeted backfill script for specific Baserow row IDs
// This script will:
// 1) Find google_place_id if missing (using Places "Find Place From Text")
// 2) Backfill image_url from Google Places Photos
// 3) Backfill Gmaps_url from Google Places Details
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-specific-buildings.js

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID =
  process.env.BASEROW_TABLE_ID ||
  process.env.REACT_APP_BASEROW_TABLE_ID ||
  "772747";
const BASEROW_TOKEN =
  process.env.BASEROW_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;
const MAPS_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

if (!TABLE_ID || !BASEROW_TOKEN || !MAPS_KEY) {
  console.error(
    "Missing required env vars. Please set BASEROW_TABLE_ID, BASEROW_TOKEN, and GOOGLE_MAPS_API_KEY."
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch a specific row by ID
async function fetchRowById(rowId) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Baserow error ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}

// PATCH Baserow row with updates
async function updateRow(rowId, patch) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update row ${rowId}: ${res.status} ${errorText}`);
  }
  return true;
}

// Find place ID using Places "Find Place From Text"
async function findPlaceIdForText(query) {
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    query
  )}&inputtype=textquery&fields=place_id,formatted_address&key=${MAPS_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`FindPlace error for "${query}": ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  const candidates = data.candidates || [];
  if (!candidates.length) return null;

  const best = candidates[0];
  return best.place_id || null;
}

// Get Place details (photos and URL) for a given place ID
async function getPlaceData(placeId) {
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=place_id,url,photos&key=${MAPS_KEY}`;

  const res = await fetch(detailsUrl);
  if (!res.ok) {
    console.warn(
      `Places Details error for ${placeId}: ${res.status} ${res.statusText}`
    );
    return { photoUrl: null, mapsUrl: null };
  }

  const data = await res.json();
  const result = data.result || {};

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

  return { photoUrl, mapsUrl };
}

async function backfillBuilding(rowId) {
  console.log(`\n📋 Processing row ${rowId}...`);
  
  try {
    // Fetch the row
    const row = await fetchRowById(rowId);
    const name = row.name || "(unnamed)";
    console.log(`   Building: "${name}"`);
    
    let placeId = row.google_place_id;
    const currentImageUrl = String(row.image_url || "").trim();
    const currentGmapsUrl = String(row.Gmaps_url || "").trim();
    
    // Step 1: Find place ID if missing
    if (!placeId || String(placeId).trim() === "") {
      console.log(`   ⚠️  No google_place_id found, searching...`);
      
      const city = row.city || "";
      const country = row.country || "";
      const location = row.location || "";
      
      // Build query: prefer location, then name + city + country
      const parts = [];
      if (name) parts.push(name);
      if (city) parts.push(city);
      if (country) parts.push(country);
      
      const query = location && location.trim() !== "" ? location : parts.join(", ");
      
      if (!query || query.trim() === "") {
        console.log(`   ❌ No query available for place search`);
        return;
      }
      
      console.log(`   🔍 Searching for place_id with query: "${query}"`);
      placeId = await findPlaceIdForText(query);
      await sleep(300);
      
      if (!placeId) {
        console.log(`   ❌ No place_id found for query`);
        return;
      }
      
      console.log(`   ✅ Found place_id: ${placeId}`);
      
      // Update row with place_id first
      await updateRow(rowId, { google_place_id: placeId });
      await sleep(300);
      console.log(`   ✅ Updated google_place_id in Baserow`);
    } else {
      console.log(`   ✅ Already has google_place_id: ${placeId}`);
    }
    
    // Step 2: Get Place details (photos and URL)
    console.log(`   🔍 Fetching Place details...`);
    const { photoUrl, mapsUrl } = await getPlaceData(placeId);
    await sleep(300);
    
    // Step 3: Update row with missing fields
    const patch = {};
    let hasUpdates = false;
    
    if (photoUrl && (!currentImageUrl || currentImageUrl === "")) {
      patch.image_url = photoUrl;
      hasUpdates = true;
      console.log(`   ✅ Found image_url`);
    } else if (photoUrl) {
      console.log(`   ℹ️  Image URL already exists, skipping`);
    } else {
      console.log(`   ⚠️  No photo found in Places`);
    }
    
    if (mapsUrl && (!currentGmapsUrl || currentGmapsUrl === "")) {
      patch.Gmaps_url = mapsUrl;
      hasUpdates = true;
      console.log(`   ✅ Found Gmaps_url`);
    } else if (mapsUrl) {
      console.log(`   ℹ️  Gmaps URL already exists, skipping`);
    } else {
      console.log(`   ⚠️  No Maps URL found in Places`);
    }
    
    if (hasUpdates) {
      await updateRow(rowId, patch);
      await sleep(300);
      console.log(`   ✅ Updated row ${rowId} with: ${Object.keys(patch).join(", ")}`);
    } else {
      console.log(`   ℹ️  No updates needed for row ${rowId}`);
    }
    
    console.log(`   ✅ Completed row ${rowId}`);
    
  } catch (error) {
    console.error(`   ❌ Error processing row ${rowId}:`, error.message);
  }
}

async function main() {
  const rowIds = [727, 728, 729];
  
  console.log("🚀 Starting targeted backfill for rows:", rowIds.join(", "));
  console.log("=" .repeat(60));
  
  for (const rowId of rowIds) {
    await backfillBuilding(rowId);
    await sleep(500); // Be polite between buildings
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Backfill complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

