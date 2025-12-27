// scripts/run-dedupe.js
// Run the updated dedupe function with fuzzy matching (10km, name portion sharing)
// Usage: node scripts/run-dedupe.js

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
  "FhAvq74hSan4hSyyYB012Vp5eQmoOaGR";

if (!BASEROW_TOKEN || BASEROW_TOKEN.length < 10) {
  console.error("ERROR: BASEROW_TOKEN is not set or invalid!");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to normalize names for fuzzy matching
const normalizeNameForMatch = (name) => {
  return (name || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
};

// Helper to extract base name (before parentheses or other separators)
const extractBaseName = (name) => {
  const cleaned = (name || "")
    .replace(/\s*\([^)]*\)/g, "") // Remove parentheses content
    .replace(/\s*\[[^\]]*\]/g, "") // Remove bracket content
    .replace(/\s*-\s*[^-]*$/g, "") // Remove content after dash
    .trim();
  return normalizeNameForMatch(cleaned);
};

// Helper to check if names share a significant portion
const namesSharePortion = (name1, name2) => {
  const base1 = extractBaseName(name1);
  const base2 = extractBaseName(name2);
  
  // If base names are the same or one contains the other, they share a portion
  if (base1 === base2) return true;
  if (base1.length >= 5 && base2.length >= 5) {
    // Check if one base name contains the other (for cases like "De Inktpot" in both names)
    if (base1.includes(base2) || base2.includes(base1)) {
      const shorter = Math.min(base1.length, base2.length);
      const longer = Math.max(base1.length, base2.length);
      // Require at least 60% overlap
      return shorter / longer >= 0.6;
    }
  }
  
  return false;
};

// Helper to check if building is one of the Seven Sisters in Russia
const isSevenSisters = (row) => {
  const name = (row.name || "").toLowerCase();
  const country = (row.country || "").toLowerCase();
  const city = (row.city || "").toLowerCase();
  
  // Check if it's in Russia and matches Seven Sisters pattern
  if (!country.includes("russia") && !country.includes("россия")) return false;
  
  // Seven Sisters are in Moscow
  if (!city.includes("moscow") && !city.includes("москва")) return false;
  
  // Check for Seven Sisters building names
  const sevenSistersKeywords = [
    "ministry", "ministry of foreign affairs", "hotel ukraina", "hotel leningradskaya",
    "kotelnicheskaya", "kudrinskaya", "red gates", "ministry of foreign affairs",
    "seven sisters", "stalinist", "высотка", "сталинская"
  ];
  
  return sevenSistersKeywords.some(keyword => name.includes(keyword));
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
      throw new Error(`Baserow error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    allRows.push(...data.results);

    // Ensure next URL uses https if provided
    url = data.next ? data.next.replace(/^http:/, "https:") : null;
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

  // Group duplicates using fuzzy matching (10km, name portion sharing)
  const duplicateGroups = [];
  const processed = new Set();

  for (let i = 0; i < rows.length; i++) {
    if (processed.has(rows[i].id)) continue;

    const group = [rows[i]];
    processed.add(rows[i].id);

    for (let j = i + 1; j < rows.length; j++) {
      if (processed.has(rows[j].id)) continue;

      // Skip if either building is a Seven Sisters building (exception)
      if (isSevenSisters(rows[i]) || isSevenSisters(rows[j])) {
        continue;
      }

      const lat1 = parseFloat(rows[i].lat || "0");
      const lng1 = parseFloat(rows[i].lng || "0");
      const lat2 = parseFloat(rows[j].lat || "0");
      const lng2 = parseFloat(rows[j].lng || "0");

      if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) continue;
      if (lat1 === 0 && lng1 === 0) continue;
      if (lat2 === 0 && lng2 === 0) continue;

      const distance = getDistance({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
      
      // Check if within 10km and names share a portion
      if (distance < 10000) { // 10km
        // Check if names share a significant portion
        if (namesSharePortion(rows[i].name || "", rows[j].name || "")) {
          group.push(rows[j]);
          processed.add(rows[j].id);
        }
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
    group.forEach((b, idx) => {
      console.log(`  ${idx + 1}. "${b.name}" at ${b.location || `${b.city || ""}, ${b.country || ""}`} (ID: ${b.id})`);
    });

    // Score each building in the group
    const scored = group.map((row) => ({
      row,
      score: getBuildingScore(row),
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    const keep = scored[0];
    const toDelete = scored.slice(1);

    console.log(`  ✅ Keeping: "${keep.row.name}" (score: ${keep.score.toFixed(1)})`);
    console.log(`  🗑️  Deleting ${toDelete.length} duplicate(s):`);

    for (const item of toDelete) {
      console.log(`    🗑️ Deleting: "${item.row.name}" (score: ${item.score.toFixed(1)}, row ID: ${item.row.id})`);
      try {
        await deleteRow(item.row.id);
        await sleep(300); // Rate limit protection
        totalDeleted++;
      } catch (error) {
        console.error(`    ❌ Error deleting row ${item.row.id}:`, error.message);
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

