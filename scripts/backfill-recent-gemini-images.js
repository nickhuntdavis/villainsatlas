// scripts/backfill-recent-gemini-images.js
// Backfill Google Places images for recently added Gemini-found buildings
// This script will:
// 1) Fetch all buildings from Baserow
// 2) Find buildings without Google Places images (but with google_place_id)
// 3) Fetch images from Google Places API and update Baserow
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-recent-gemini-images.js

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID =
  process.env.BASEROW_TABLE_ID ||
  process.env.REACT_APP_BASEROW_TABLE_ID ||
  "772747";
const BASEROW_TOKEN =
  process.env.REACT_APP_BASEROW_API_TOKEN || process.env.BASEROW_TOKEN;
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

// Helper to check if an image URL is from Google Places
function isGooglePlacesImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return false;
  return imageUrl.includes("maps.googleapis.com/maps/api/place/photo");
}

// Fetch all rows from Baserow
async function fetchAllRows() {
  const allRows = [];
  let url = `${BASEROW_BASE}/${TABLE_ID}/?user_field_names=true&size=200`;
  
  while (url) {
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
    allRows.push(...data.results);
    
    url = data.next || null;
  }

  return allRows;
}

// Get Place details (photos) for a given place ID
async function getPlacePhoto(placeId) {
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=photos&key=${MAPS_KEY}`;

  const res = await fetch(detailsUrl);
  if (!res.ok) {
    console.warn(
      `Places Details error for ${placeId}: ${res.status} ${res.statusText}`
    );
    return null;
  }

  const data = await res.json();
  if (data.status !== "OK" || !data.result) {
    console.warn(`Places Details non-OK for ${placeId}:`, data.status);
    return null;
  }

  const photos = data.result.photos;
  if (!Array.isArray(photos) || photos.length === 0) {
    return null;
  }

  const photoRef = photos[0].photo_reference;
  if (!photoRef) return null;

  // Construct photo URL
  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
    photoRef
  )}&key=${MAPS_KEY}`;

  return photoUrl;
}

// Update Baserow row with image_url
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
    const errorText = await res.text();
    throw new Error(`Baserow update error ${res.status}: ${errorText}`);
  }

  return await res.json();
}

async function main() {
  console.log("🔍 Fetching all buildings from Baserow...");
  const rows = await fetchAllRows();
  console.log(`✅ Found ${rows.length} total buildings\n`);

  // Filter for buildings that:
  // 1. Have a google_place_id
  // 2. Don't have a Google Places image (either no image_url or image_url is not from Google Places)
  const needsBackfill = rows.filter((row) => {
    const placeId = row.google_place_id;
    const imageUrl = String(row.image_url || "").trim();
    
    // Must have place ID
    if (!placeId || String(placeId).trim() === "") {
      return false;
    }
    
    // Must not already have a Google Places image
    if (imageUrl && isGooglePlacesImage(imageUrl)) {
      return false;
    }
    
    return true;
  });

  console.log(`📋 Found ${needsBackfill.length} buildings that need Google Places images\n`);

  if (needsBackfill.length === 0) {
    console.log("✅ All buildings already have Google Places images!");
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let noPhotoCount = 0;

  for (let i = 0; i < needsBackfill.length; i++) {
    const row = needsBackfill[i];
    const name = row.name || "(unnamed)";
    const placeId = row.google_place_id;
    const rowId = row.id;

    console.log(`\n[${i + 1}/${needsBackfill.length}] Processing "${name}" (row ${rowId})...`);
    console.log(`   Place ID: ${placeId}`);

    try {
      // Fetch photo from Google Places
      const photoUrl = await getPlacePhoto(placeId);
      await sleep(300); // Rate limit protection

      if (!photoUrl) {
        console.log(`   ⚠️  No photo found in Google Places`);
        noPhotoCount++;
        continue;
      }

      // Update Baserow
      await updateRowImage(rowId, photoUrl);
      await sleep(300); // Rate limit protection

      console.log(`   ✅ Updated with Google Places image`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   ✅ Successfully updated: ${successCount}`);
  console.log(`   ⚠️  No photo available: ${noPhotoCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📝 Total processed: ${needsBackfill.length}`);
}

main().catch(console.error);

