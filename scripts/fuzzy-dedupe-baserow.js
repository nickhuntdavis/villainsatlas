// scripts/fuzzy-dedupe-baserow.js
// Scan Baserow for duplicates using fuzzy matching logic
// Removes duplicates, preferring buildings with Google Place IDs and images
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" node scripts/fuzzy-dedupe-baserow.js

import dotenv from "dotenv";
const envResult = dotenv.config({ path: ".env.local" });
if (envResult.error) {
  console.warn("Warning: Could not load .env.local:", envResult.error.message);
}

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID =
  process.env.BASEROW_TABLE_ID ||
  process.env.REACT_APP_BASEROW_TABLE_ID ||
  "772747";
const BASEROW_TOKEN =
  process.env.REACT_APP_BASEROW_API_TOKEN || 
  process.env.BASEROW_TOKEN ||
  "FhAvq74hSan4hSyyYB012Vp5eQmoOaGR"; // Fallback token from baserowService.ts

// Verify token is set
if (!BASEROW_TOKEN || BASEROW_TOKEN.length < 10) {
  console.error("ERROR: BASEROW_TOKEN is not set or invalid!");
  process.exit(1);
}

if (!TABLE_ID || !BASEROW_TOKEN) {
  console.error(
    "Missing required env vars. Please set BASEROW_TABLE_ID and BASEROW_TOKEN."
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to normalize names for fuzzy matching
const normalizeName = (name) => {
  return (name || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
};

// Helper to calculate similarity between two normalized names
const nameSimilarity = (name1, name2) => {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (!norm1 || !norm2) return 0;

  // Exact match after normalization
  if (norm1 === norm2) return 1.0;

  // One contains the other (high similarity)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    return shorter / longer;
  }

  // Calculate word overlap
  const words1 = new Set(norm1.split(" ").filter((w) => w.length > 2));
  const words2 = new Set(norm2.split(" ").filter((w) => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter((w) => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
};

// Helper to calculate distance in meters (Haversine formula)
const getDistance = (coord1, coord2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Helper to check if two buildings are likely the same (fuzzy match)
const areLikelySame = (b1, b2) => {
  // Check name similarity
  const nameSim = nameSimilarity(b1.name, b2.name);
  if (nameSim < 0.6) return false; // Names too different

  // Check if coordinates are close (within 500m)
  const lat1 = parseFloat(b1.lat || "0");
  const lng1 = parseFloat(b1.lng || "0");
  const lat2 = parseFloat(b2.lat || "0");
  const lng2 = parseFloat(b2.lng || "0");

  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return false;
  if (lat1 === 0 && lng1 === 0) return false;
  if (lat2 === 0 && lng2 === 0) return false;

  const distance = getDistance({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
  return distance < 500;
};

// Helper to score building quality (prefer ones with Google Place ID and images)
const getBuildingScore = (row) => {
  let score = 0;
  if (row.google_place_id && String(row.google_place_id).trim() !== "") score += 10;
  if (row.image_url && String(row.image_url).trim() !== "") score += 5;
  if (row.Gmaps_url && String(row.Gmaps_url).trim() !== "") score += 2;
  if (row.notes && String(row.notes).trim() !== "") score += 1;
  // Prefer rows with more complete data
  if (row.city && String(row.city).trim() !== "") score += 0.5;
  if (row.country && String(row.country).trim() !== "") score += 0.5;
  if (row.location && String(row.location).trim() !== "") score += 0.5;
  return score;
};

// Fetch all rows from Baserow
async function fetchAllRows() {
  const allRows = [];
  let url = `${BASEROW_BASE}/${TABLE_ID}/?user_field_names=true&size=200`;

  while (url) {
    const headers = {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    };
    
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`API Error: ${res.status} ${res.statusText}`);
      console.error(`Response: ${errorText}`);
      console.error(`URL: ${url}`);
      console.error(`Token length: ${BASEROW_TOKEN?.length || 0}`);
      throw new Error(`Baserow error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    allRows.push(...data.results);

    // Ensure next URL uses https if provided
    url = data.next ? data.next.replace(/^http:/, 'https:') : null;
  }

  return allRows;
}

// Delete a row by ID
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
    throw new Error(`Baserow delete error ${res.status}: ${await res.text()}`);
  }

  return true;
}

async function main() {
  console.log("🔍 Fetching all buildings from Baserow...");
  const rows = await fetchAllRows();
  console.log(`✅ Found ${rows.length} total buildings\n`);

  // Group duplicates using fuzzy matching
  const duplicateGroups = [];
  const processed = new Set();

  for (let i = 0; i < rows.length; i++) {
    if (processed.has(rows[i].id)) continue;

    const group = [rows[i]];
    processed.add(rows[i].id);

    for (let j = i + 1; j < rows.length; j++) {
      if (processed.has(rows[j].id)) continue;

      if (areLikelySame(rows[i], rows[j])) {
        group.push(rows[j]);
        processed.add(rows[j].id);
      }
    }

    if (group.length > 1) {
      duplicateGroups.push(group);
    }
  }

  console.log(`📋 Found ${duplicateGroups.length} duplicate groups\n`);

  if (duplicateGroups.length === 0) {
    console.log("✅ No duplicates found!");
    return;
  }

  let totalDeleted = 0;
  let totalKept = 0;

  for (let i = 0; i < duplicateGroups.length; i++) {
    const group = duplicateGroups[i];
    console.log(`\n[${i + 1}/${duplicateGroups.length}] Processing duplicate group:`);

    // Score each building in the group
    const scored = group.map((row) => ({
      row,
      score: getBuildingScore(row),
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    const keep = scored[0];
    const toDelete = scored.slice(1);

    console.log(`   Keeping: "${keep.row.name}" (score: ${keep.score.toFixed(1)})`);
    console.log(`   - Has Google Place ID: ${!!keep.row.google_place_id}`);
    console.log(`   - Has image: ${!!keep.row.image_url}`);
    console.log(`   - Row ID: ${keep.row.id}`);

    for (const item of toDelete) {
      console.log(`   Deleting: "${item.row.name}" (score: ${item.score.toFixed(1)}, row ID: ${item.row.id})`);
      try {
        await deleteRow(item.row.id);
        await sleep(300); // Rate limit protection
        totalDeleted++;
      } catch (error) {
        console.error(`   ❌ Error deleting row ${item.row.id}:`, error.message);
      }
    }

    totalKept++;
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   ✅ Kept: ${totalKept} buildings`);
  console.log(`   🗑️  Deleted: ${totalDeleted} duplicates`);
  console.log(`   📝 Total processed: ${duplicateGroups.length} groups`);
}

main().catch(console.error);

