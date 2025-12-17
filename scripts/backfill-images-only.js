// scripts/backfill-images-only.js
// Backfill missing image_url ONLY from Google Places Photos API
// Only updates rows that:
// 1) Have a google_place_id
// 2) Don't have an image_url OR have a non-Google Places image_url
// 3) Can get a photo from Google Places API
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-images-only.js

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
    const errorText = await res.text();
    console.warn(`Failed to update image_url for row ${rowId}: ${res.status} ${errorText}`);
    return false;
  }
  return true;
}

// Check if image URL is from Google Places
function isGooglePlacesImage(imageUrl) {
  if (!imageUrl) return false;
  const url = String(imageUrl).toLowerCase();
  return (
    url.includes("maps.googleapis.com/maps/api/place/photo") ||
    url.includes("lh3.googleusercontent.com")
  );
}

// Get Place photo URL for a given place ID
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
    return null;
  }

  const result = data.result;
  const photos = result.photos;
  if (Array.isArray(photos) && photos.length > 0) {
    const photoRef = photos[0].photo_reference;
    if (photoRef) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
        photoRef
      )}&key=${MAPS_KEY}`;
    }
  }

  return null;
}

async function main() {
  console.log("Fetching rows from Baserow...");
  const rows = await fetchAllRows();
  console.log(`Fetched ${rows.length} rows from Baserow\n`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let noPlaceId = 0;
  let alreadyHasGoogleImage = 0;
  let noPhotoAvailable = 0;

  for (const row of rows) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const placeId = row.google_place_id;
    const currentImageUrl = String(row.image_url || "").trim();

    // Skip if no place_id
    if (!placeId || String(placeId).trim() === "") {
      noPlaceId++;
      continue;
    }

    // Skip if already has Google Places image
    if (currentImageUrl && isGooglePlacesImage(currentImageUrl)) {
      alreadyHasGoogleImage++;
      continue;
    }

    processed++;

    try {
      const photoUrl = await getPlacePhoto(placeId);
      await sleep(300); // Be polite to the API

      if (photoUrl) {
        const ok = await updateRowImage(rowId, photoUrl);
        if (ok) {
          console.log(`✅ Row ${rowId} ("${name}"): Updated image_url`);
          updated++;
        } else {
          console.log(`⚠️  Row ${rowId} ("${name}"): Failed to update`);
        }
        await sleep(300);
      } else {
        noPhotoAvailable++;
        if (processed % 20 === 0) {
          console.log(`   Processed ${processed} rows...`);
        }
      }
    } catch (err) {
      console.warn(`⚠️  Error processing row ${rowId}:`, err.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Backfill complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped - no place_id: ${noPlaceId}`);
  console.log(`   Skipped - already has Google image: ${alreadyHasGoogleImage}`);
  console.log(`   No photo available: ${noPhotoAvailable}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

