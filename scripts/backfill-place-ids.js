// scripts/backfill-place-ids.js
// One-off script to backfill Baserow `google_place_id` fields using Google Places "Find Place From Text".
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-place-ids.js

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

// Call Places "Find Place From Text" to get a place_id for a text query
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

// PATCH Baserow row with google_place_id
async function updateRowPlaceId(rowId, placeId) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ google_place_id: placeId }),
  });

  if (!res.ok) {
    console.warn(`Failed to update place_id for row ${rowId}: ${res.status} ${await res.text()}`);
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

    // Skip if place_id already set
    if (placeId && String(placeId).trim() !== "") continue;

    const city = row.city || "";
    const country = row.country || "";
    const location = row.location || "";

    // Build a reasonable query string: prefer location, then name + city + country
    const parts = [];
    if (name) parts.push(name);
    if (city) parts.push(city);
    if (country) parts.push(country);

    const query = location && location.trim() !== "" ? location : parts.join(", ");
    if (!query || query.trim() === "") continue;

    console.log(`Processing "${name}" (row ${rowId}) with query="${query}" ...`);

    try {
      const foundPlaceId = await findPlaceIdForText(query);
      if (!foundPlaceId) {
        console.log(`  No place_id found for query="${query}"`);
        continue;
      }

      const ok = await updateRowPlaceId(rowId, foundPlaceId);
      if (ok) {
        console.log(`  ✅ Saved google_place_id for row ${rowId}: ${foundPlaceId}`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Error processing row ${rowId}:`, err);
    }

    // Small delay to be polite to APIs
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("Backfill of google_place_id complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


