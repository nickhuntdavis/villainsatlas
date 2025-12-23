// scripts/backfill-graveyard-place-ids.js
// Backfill Google Place IDs for the 50 most recently added graveyards in Baserow
// This script will:
// 1) Fetch all buildings from Baserow
// 2) Filter for buildings with style "Graveyard"
// 3) Sort by ID (descending) to get most recent
// 4) Take first 50 that don't have google_place_id
// 5) Search Google Places API and update Baserow
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-graveyard-place-ids.js

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
  console.log("Fetching all rows from Baserow...");
  const allRows = await fetchAllRows();
  console.log(`Fetched ${allRows.length} total rows from Baserow\n`);

  // Filter for graveyards
  const graveyards = allRows.filter((row) => {
    const style = String(row.style || "").trim();
    return style === "Graveyard" || style.toLowerCase().includes("graveyard") || style.toLowerCase().includes("cemetery");
  });

  console.log(`Found ${graveyards.length} graveyards in Baserow`);

  // Filter for graveyards without place_id
  const graveyardsWithoutPlaceId = graveyards.filter((row) => {
    const placeId = row.google_place_id;
    return !placeId || String(placeId).trim() === "";
  });

  console.log(`Found ${graveyardsWithoutPlaceId.length} graveyards without google_place_id`);

  // Sort by ID descending (most recent first) and take first 50
  const recentGraveyards = graveyardsWithoutPlaceId
    .sort((a, b) => b.id - a.id)
    .slice(0, 50);

  console.log(`Processing ${recentGraveyards.length} most recent graveyards without place_id\n`);

  let processed = 0;
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const row of recentGraveyards) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const city = row.city || "";
    const country = row.country || "";
    const location = row.location || "";

    // Build a reasonable query string: prefer location, then name + city + country
    const parts = [];
    if (name) parts.push(name);
    if (city) parts.push(city);
    if (country) parts.push(country);

    const query = location && location.trim() !== "" ? location : parts.join(", ");
    if (!query || query.trim() === "") {
      console.log(`⚠️  Skipping row ${rowId} ("${name}"): No query available`);
      continue;
    }

    processed++;
    console.log(`[${processed}/${recentGraveyards.length}] Processing "${name}" (row ${rowId})`);
    console.log(`   Query: "${query}"`);

    try {
      const foundPlaceId = await findPlaceIdForText(query);
      await sleep(300); // Be polite to the API

      if (!foundPlaceId) {
        console.log(`   ❌ No place_id found for query="${query}"`);
        notFound++;
        continue;
      }

      const ok = await updateRowPlaceId(rowId, foundPlaceId);
      await sleep(300); // Be polite to the API

      if (ok) {
        console.log(`   ✅ Saved google_place_id: ${foundPlaceId}\n`);
        updated++;
      } else {
        console.log(`   ⚠️  Failed to update Baserow\n`);
        errors++;
      }
    } catch (err) {
      console.warn(`   ⚠️  Error processing row ${rowId}:`, err.message);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Backfill complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Errors: ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

