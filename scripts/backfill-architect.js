// scripts/backfill-architect.js
// Backfill architect information for buildings where available
// Uses web search to find architect information (Google Places API doesn't include architect)
//
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" GOOGLE_MAPS_API_KEY="..." node scripts/backfill-architect.js

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

if (!TABLE_ID || !BASEROW_TOKEN) {
  console.error(
    "Missing required env vars. Please set BASEROW_TABLE_ID and BASEROW_TOKEN."
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

// PATCH Baserow row with architect
async function updateRowArchitect(rowId, architect) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ architect }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn(`Failed to update architect for row ${rowId}: ${res.status} ${errorText}`);
    return false;
  }
  return true;
}

// Known architect mappings for famous buildings
// This is a curated list - we'll expand as needed
const KNOWN_ARCHITECTS = {
  "Empire State Building": "Shreve, Lamb & Harmon",
  "Chrysler Building": "William Van Alen",
  "Rockefeller Center": "Raymond Hood",
  "Daily News Building": "Raymond Hood",
  "American Radiator Building": "Raymond Hood",
  "Palace of Culture and Science": "Lev Rudnev",
  "Het Schip": "Michel de Klerk",
  "Aula Conference Centre": "Mecanoo",
  "Aula Conference Centre (Auditorium TU Delft)": "Mecanoo",
  "Auditorium TU Delft": "Mecanoo",
  "Villa Savoye": "Le Corbusier",
  "Einstein Tower": "Erich Mendelsohn",
  "Union Buildings": "Sir Herbert Baker",
  "House with Chimaeras": "Vladyslav Horodetsky",
  "Palacio de Bellas Artes": "Adamo Boari",
  "Hallgrímskirkja Church In Iceland": "Guðjón Samúelsson",
};

// Try to extract architect from building name and style
// For Art Deco buildings, we can sometimes infer from context
async function findArchitect(row) {
  const name = (row.name || "").trim();
  const style = (row.style || "").toLowerCase();
  const notes = (row.notes || "").toLowerCase();
  
  // Check known architects first
  if (KNOWN_ARCHITECTS[name]) {
    return KNOWN_ARCHITECTS[name];
  }
  
  // Check if architect is mentioned in notes
  // More specific patterns to avoid false positives
  const architectPatterns = [
    /architect[:\s]+([A-Z][a-zA-Z\s,&\.-]+?)(?:\.|,|$|designed|built)/i,
    /designed by ([A-Z][a-zA-Z\s,&\.-]+?)(?:\.|,|$|in|and)/i,
    /architect[:\s]+([A-Z][a-zA-Z\s,&\.-]+?)(?:\.|,|$)/i,
  ];
  
  for (const pattern of architectPatterns) {
    const match = notes.match(pattern);
    if (match && match[1]) {
      let architect = match[1].trim();
      
      // Clean up common false positives
      architect = architect
        .replace(/\s+(and|&|or)\s+.*$/i, '') // Remove "and X" or "& X"
        .replace(/^(with|by|the|a|an)\s+/i, '') // Remove leading articles
        .replace(/\s+(with|by|the|a|an)\s+.*$/i, '') // Remove trailing phrases
        .trim();
      
      // Validation - should be reasonable length, contain letters, and look like a name
      if (
        architect.length > 3 && 
        architect.length < 80 && 
        /[a-zA-Z]/.test(architect) &&
        !/^(power|fire|surreal|lotus|appointment|bombs|river|traditions|artists|gardens|ponds)/i.test(architect) &&
        /^[A-Z]/.test(architect) // Should start with capital letter
      ) {
        return architect;
      }
    }
  }
  
  // For Art Deco buildings, check if we have any hints
  if (style.includes("art deco") || style.includes("deco")) {
    // Some famous Art Deco architects
    const artDecoArchitects = [
      "William Van Alen",
      "Raymond Hood",
      "Shreve, Lamb & Harmon",
      "Ralph Walker",
      "Ely Jacques Kahn",
    ];
    
    // If notes mention any of these, return the first match
    for (const arch of artDecoArchitects) {
      if (notes.includes(arch.toLowerCase())) {
        return arch;
      }
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

  for (const row of rows) {
    const rowId = row.id;
    const name = row.name || "(unnamed)";
    const currentArchitect = String(row.architect || "").trim();

    // Skip if architect already set
    if (currentArchitect !== "") {
      skipped++;
      continue;
    }

    processed++;
    
    try {
      const architect = await findArchitect(row);
      
      if (architect) {
        const ok = await updateRowArchitect(rowId, architect);
        if (ok) {
          console.log(`✅ Row ${rowId} ("${name}"): ${architect}`);
          updated++;
        } else {
          console.log(`⚠️  Row ${rowId} ("${name}"): Failed to update`);
        }
      } else {
        // Don't log every skip to avoid noise
        if (processed % 50 === 0) {
          console.log(`   Processed ${processed} rows...`);
        }
      }
    } catch (err) {
      console.warn(`⚠️  Error processing row ${rowId}:`, err.message);
    }

    await sleep(100); // Be polite to the API
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Backfill complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already had architect): ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

