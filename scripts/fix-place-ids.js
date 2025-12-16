// scripts/fix-place-ids.js
// One-off script to fix Baserow google_place_id values that point only to addresses
// instead of actual building POIs.
//
// Strategy:
// 1) Fetch all rows from Baserow.
// 2) For rows with a google_place_id:
//    - Call Places Details (fields=types,name,formatted_address,url).
//    - If the place "looks like" only an address (no POI/establishment types),
//      then:
//        a) Build a text query from name + city/country/location.
//        b) Call Find Place From Text to get better candidates.
//        c) Pick the first candidate that looks like a POI (has establishment / POI-type).
//        d) Update that row's google_place_id (and optionally Gmaps_url) to the new POI.
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/fix-place-ids.js

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

// Helper to decide if a place "looks like" just an address, not a POI
function looksLikeAddressPlace(types = []) {
  if (!Array.isArray(types)) return false;

  const poiIndicators = [
    "establishment",
    "point_of_interest",
    "museum",
    "city_hall",
    "tourist_attraction",
    "church",
    "university",
    "stadium",
    "library",
    "government_office",
    "place_of_worship",
    "courthouse",
    "city_hall",
  ];

  const addressish = [
    "street_address",
    "route",
    "premise",
    "subpremise",
    "postal_code",
    "neighborhood",
    "locality",
    "political",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "country",
  ];

  const hasPoi = types.some((t) => poiIndicators.includes(t));
  const onlyAddressish = types.every((t) => addressish.includes(t));

  // "Just address" = no POI types, and every type is in the address-ish set
  return !hasPoi && onlyAddressish;
}

// Get details for a place_id
async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=place_id,types,name,formatted_address,url&key=${MAPS_KEY}`;

  const res = await fetch(url);
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
  return data.result;
}

// Find a better POI candidate by text query
async function findBetterPlaceByText(query) {
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    query
  )}&inputtype=textquery&fields=place_id,types,name,formatted_address&key=${MAPS_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(
      `FindPlaceFromText error for "${query}": ${res.status} ${res.statusText}`
    );
    return null;
  }

  const data = await res.json();
  if (!data.candidates || !data.candidates.length) {
    console.warn(`No candidates for "${query}"`);
    return null;
  }

  // Prefer the first candidate that looks like a POI (not just address)
  for (const candidate of data.candidates) {
    const types = candidate.types || [];
    if (!looksLikeAddressPlace(types)) {
      return candidate;
    }
  }

  console.warn(`Only address-like candidates for "${query}"`);
  return null;
}

async function main() {
  console.log("Fetching rows from Baserow...");
  const rows = await fetchAllRows();
  console.log(`Fetched ${rows.length} rows from Baserow`);

  for (const row of rows) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const placeIdRaw = row.google_place_id;

    if (!placeIdRaw || String(placeIdRaw).trim() === "") continue;

    const placeId = String(placeIdRaw).trim();

    console.log(
      `\nChecking "${name}" (row ${rowId}) with google_place_id=${placeId}...`
    );

    try {
      const details = await getPlaceDetails(placeId);
      if (!details) {
        continue;
      }

      const types = details.types || [];
      if (!looksLikeAddressPlace(types)) {
        // Already a POI-ish place, leave it alone
        console.log("  ✔ Existing place_id looks like a POI, skipping");
        await sleep(150);
        continue;
      }

      console.log(
        `  ⚠ Existing place_id looks like an address only (types=${types.join(
          ","
        )})`
      );

      // Build a richer text query from name + city/country/location
      const city = row.city || "";
      const country = row.country || "";
      const location = row.location || "";

      const queryParts = [];
      if (name && name !== "(unnamed)") queryParts.push(name);
      if (location) queryParts.push(location);
      else if (city || country) queryParts.push(`${city} ${country}`.trim());

      const textQuery = queryParts.join(", ").trim();
      if (!textQuery) {
        console.warn("  No usable text query; skipping row");
        await sleep(150);
        continue;
      }

      console.log(`  Searching for better POI with query: "${textQuery}"`);
      const candidate = await findBetterPlaceByText(textQuery);
      if (!candidate) {
        await sleep(150);
        continue;
      }

      console.log(
        `  ➜ Found candidate POI: "${candidate.name}" (${candidate.place_id})`
      );

      // Optional: get its URL for Gmaps_url
      const newDetails = await getPlaceDetails(candidate.place_id);
      let patch = { google_place_id: candidate.place_id };
      if (newDetails && newDetails.url) {
        patch.Gmaps_url = newDetails.url;
      }

      const ok = await updateRow(rowId, patch);
      if (ok) {
        console.log(
          `  ✅ Updated row ${rowId} with new google_place_id (and Gmaps_url if available)`
        );
      }
    } catch (err) {
      console.warn(`  ⚠ Error processing row ${rowId}:`, err);
    }

    await sleep(400); // be polite to the APIs
  }

  console.log("\nPlace ID fix-up complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


