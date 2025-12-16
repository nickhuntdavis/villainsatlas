// scripts/normalize-and-dedupe.js
// 1) Normalize city and country names across ALL Baserow rows.
// 2) Detect duplicate rows by `name` and delete the ones with the least information.
//
// Usage:
//   node scripts/normalize-and-dedupe.js
//
// Env requirements (.env.local):
//   REACT_APP_BASEROW_API_TOKEN=...
//   REACT_APP_BASEROW_TABLE_ID=772747

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID =
  process.env.BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;

if (!TABLE_ID || !BASEROW_TOKEN) {
  console.error(
    "Missing env vars. Need BASEROW_TABLE_ID / REACT_APP_BASEROW_TABLE_ID and BASEROW_TOKEN / REACT_APP_BASEROW_API_TOKEN."
  );
  process.exit(1);
}

// --- Normalization helpers ---

const COUNTRY_NORMALIZATION_MAP = {
  // United States variants
  "usa": "United States",
  "u.s.a.": "United States",
  "u.s.a": "United States",
  "us": "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  "america": "United States",

  // UK
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  "england": "United Kingdom", // often used interchangeably in sources

  // Germany / others (if needed, add more)
  "gdr": "Germany",
  "deutschland": "Germany",
};

const CITY_NORMALIZATION_MAP = {
  "köln": "Cologne",
  "cologne": "Cologne",
  "wien": "Vienna",
  "warschau": "Warsaw",
  "moskva": "Moscow",
  "moskou": "Moscow",
  "gns": "Guernsey", // just in case shorthand appears
};

function normalizeCountry(country) {
  if (!country) return country;
  const key = country.toLowerCase().trim();
  return COUNTRY_NORMALIZATION_MAP[key] || country;
}

function normalizeCity(city) {
  if (!city) return city;
  const key = city.toLowerCase().trim();
  return CITY_NORMALIZATION_MAP[key] || city;
}

// --- API helpers ---

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

    if (!data.next) break;
    page += 1;
  }

  return rows;
}

async function patchRow(rowId, updates) {
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
    console.warn(`  ⚠️ Failed to patch row ${rowId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

async function deleteRow(rowId) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`  ⚠️ Failed to delete row ${rowId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

// --- Duplicate scoring helper ---

function infoScore(row) {
  // Count how much useful data is present to decide which duplicate to keep
  let score = 0;

  const fields = [
    "city",
    "country",
    "lat",
    "lng",
    "google_place_id",
    "image_url",
    "notes",
    "location",
    "style",
    "architect",
  ];

  for (const f of fields) {
    const v = row[f];
    if (v !== null && v !== undefined && String(v).trim() !== "" && String(v) !== "0") {
      score += 1;
    }
  }

  // Heavier weight for notes / image / place_id
  if (row.notes && String(row.notes).trim() !== "") score += 2;
  if (row.image_url && String(row.image_url).trim() !== "") score += 2;
  if (row.google_place_id && String(row.google_place_id).trim() !== "") score += 2;

  return score;
}

// --- Main ---

async function main() {
  console.log(`Using Baserow table ${TABLE_ID}`);

  const rows = await fetchAllRows();
  console.log(`Fetched ${rows.length} rows`);

  // 1) Normalize city and country
  for (const row of rows) {
    const rowId = row.id;
    const origCity = row.city || "";
    const origCountry = row.country || "";

    const normCity = normalizeCity(origCity);
    const normCountry = normalizeCountry(origCountry);

    const updates = {};
    if (normCity && normCity !== origCity) updates["city"] = normCity;
    if (normCountry && normCountry !== origCountry) updates["country"] = normCountry;

    if (Object.keys(updates).length > 0) {
      console.log(
        `Normalizing row ${rowId} (${row.name || "unnamed"}):`,
        { from: { city: origCity, country: origCountry }, to: updates }
      );
      await patchRow(rowId, updates);
      // small delay
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  console.log("\nNormalization pass complete. Now checking for duplicates by name...");

  // 2) Identify and dedupe by name
  const byName = new Map();
  for (const row of rows) {
    const name = (row.name || "").trim();
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(row);
  }

  const duplicates = [];
  for (const [name, group] of byName.entries()) {
    if (group.length > 1) {
      duplicates.push({ name, group });
    }
  }

  if (!duplicates.length) {
    console.log("No duplicate names found.");
    return;
  }

  console.log(`Found ${duplicates.length} name groups with duplicates.`);

  for (const { name, group } of duplicates) {
    console.log(`\nDuplicate group for name="${name}" (count=${group.length})`);

    // Compute scores and select the best row to keep
    const scored = group.map((row) => ({
      row,
      score: infoScore(row),
    }));

    scored.sort((a, b) => b.score - a.score); // descending

    const keep = scored[0].row;
    const toDelete = scored.slice(1).map((s) => s.row);

    console.log(
      `  Keeping row id=${keep.id} with score=${scored[0].score}, deleting ${toDelete.length} duplicate(s).`
    );

    for (const r of toDelete) {
      console.log(`  Deleting row id=${r.id} (score=${infoScore(r)})`);
      await deleteRow(r.id);
      await new Promise((res) => setTimeout(res, 150));
    }
  }

  console.log("\nNormalization and deduplication complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


