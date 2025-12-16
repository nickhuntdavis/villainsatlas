// scripts/backfill-images-and-gmaps.js
// One-off script to:
// 1) Remove image_url values that point to Alamy or Wikimedia
// 2) For rows with no image_url, backfill image_url from Google Places Photos (when google_place_id is present)
// 3) Backfill Gmaps_url from Google Places Details
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-images-and-gmaps.js

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

// PATCH Baserow row with a partial payload
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
    console.warn(
      `Failed to update row ${rowId}: ${res.status} ${await res.text()}`
    );
    return false;
  }
  return true;
}

// For a given Google Place ID, fetch a representative photo URL and Maps URL
async function getPlaceData(placeId) {
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=photos,url&key=${MAPS_KEY}`;

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

async function main() {
  console.log("Fetching rows from Baserow...");
  const rows = await fetchAllRows();
  console.log(`Fetched ${rows.length} rows from Baserow`);

  // 1. Remove image_urls that include "alamy" or "wikimedia"
  console.log(
    'Step 1: Clearing image_url values that contain "alamy" or "wikimedia"...'
  );
  for (const row of rows) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const imageUrl = String(row.image_url || "").toLowerCase();

    if (imageUrl.includes("alamy") || imageUrl.includes("wikimedia")) {
      console.log(
        `  Clearing image_url for row ${rowId} ("${name}") — detected Alamy/Wikimedia`
      );
      await updateRow(rowId, { image_url: "" });
      await sleep(150);
    }
  }

  // 2 & 3. For rows with no image_url, backfill image_url and Gmaps_url from Google Places
  console.log(
    "Step 2 & 3: Backfilling image_url (if missing) and Gmaps_url from Google Places..."
  );

  for (const row of rows) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const placeId = row.google_place_id;
    const currentImageUrl = String(row.image_url || "").trim();

    // Only process rows that have no image_url AND have a place_id
    if (!placeId || String(placeId).trim() === "") continue;
    if (currentImageUrl !== "") continue;

    console.log(
      `  Processing "${name}" (row ${rowId}) with place_id=${placeId} (no current image_url)...`
    );

    try {
      const { photoUrl, mapsUrl } = await getPlaceData(placeId);

      const patch = {};
      if (photoUrl) {
        patch.image_url = photoUrl;
      }
      if (mapsUrl) {
        patch.Gmaps_url = mapsUrl;
      }

      if (Object.keys(patch).length === 0) {
        console.log(
          `    No photo or maps URL found for place_id=${placeId}; skipping update`
        );
      } else {
        const ok = await updateRow(rowId, patch);
        if (ok) {
          console.log(
            `    ✅ Updated row ${rowId} with${
              patch.image_url ? " image_url" : ""
            }${patch.image_url && patch.Gmaps_url ? " and" : ""}${
              patch.Gmaps_url ? " Gmaps_url" : ""
            }`
          );
        }
      }
    } catch (err) {
      console.warn(`    ⚠️ Error processing row ${rowId}:`, err);
    }

    await sleep(300); // be polite to the APIs
  }

  console.log("Cleanup and backfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


