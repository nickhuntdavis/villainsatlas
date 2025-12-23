/**
 * Script to backfill multiple styles for buildings that only have one style tag
 * Uses Gemini to check if buildings legitimately meet multiple architectural styles
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { GoogleGenAI } from '@google/genai';

const BASEROW_API_BASE = 'https://api.baserow.io/api/database/rows/table';
const TABLE_ID = process.env.BASEROW_TABLE_ID || process.env.VITE_BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID;
const API_TOKEN = process.env.BASEROW_API_TOKEN || process.env.VITE_BASEROW_API_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;
const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!TABLE_ID || !API_TOKEN) {
  console.error('Missing BASEROW_TABLE_ID or BASEROW_API_TOKEN environment variables');
  process.exit(1);
}

if (!API_KEY) {
  console.error('Missing API_KEY environment variable (needed for Gemini)');
  process.exit(1);
}

async function fetchAllBuildings() {
  const allRows = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/?user_field_names=true&page=${page}&size=${pageSize}`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Baserow API error: ${response.status}`);
    }

    const data = await response.json();
    allRows.push(...data.results);

    if (!data.next) break;
    page += 1;
  }

  return allRows;
}

async function updateBuilding(rowId, style) {
  const response = await fetch(
    `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Token ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ style }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update row ${rowId}: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function checkMultipleStyles(building) {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const systemInstruction = `
    You are an architectural expert analyzing buildings for "The Villain's Atlas".
    
    Your task is to determine if a building legitimately has MULTIPLE distinct architectural styles.
    
    ARCHITECTURAL STYLES (accept these or their variants):
    - Soviet/Communist: Stalinist Gothic, Soviet Modernism, Socialist Classicism, Soviet Brutalism
    - Brutalist: Brutalism, New Brutalism, Concrete Brutalism
    - Deco: Dark Deco, Art Deco, Streamlined Moderne, Gothic Deco
    - Gothic: Gothic Revival, Neo-Gothic, Victorian Gothic, Industrial Gothic
    - Cathedral: Cathedral (for cathedrals specifically)
    - Graveyard: Graveyard (for graveyards and cemeteries)
    - Other Menacing: Totalitarian, Fascist Architecture, Monumental, Fortress, Bunker, Cyberpunk, Dystopian
    
    CRITICAL: Only identify MULTIPLE styles if the building LEGITIMATELY exhibits distinct characteristics of multiple architectural movements. 
    For example:
    - A Gothic cathedral would be "Cathedral, Gothic Revival"
    - A Stalinist Gothic building might be "Stalinist Gothic, Socialist Classicism"
    - A Brutalist building with Deco elements might be "Brutalism, Art Deco"
    
    DO NOT add multiple styles if:
    - The building only has one clear style
    - The styles are just synonyms or variants of the same style
    - You're uncertain - err on the side of keeping a single style
    
    Return ONLY valid JSON with:
    {
      "hasMultipleStyles": boolean,
      "styles": string (comma-separated styles if multiple, or single style if not. First style is primary.)
    }
    
    Do NOT include Markdown code blocks or conversational text.
  `;

  const buildingInfo = `
    Building Name: ${building.name || 'Unknown'}
    Location: ${building.location || building.city || 'Unknown'}
    Current Style: ${building.style || '(none)'}
    Notes: ${building.notes || '(none)'}
    Architect: ${building.architect || '(none)'}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze this building and determine if it legitimately has multiple architectural styles:\n\n${buildingInfo}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            hasMultipleStyles: { type: 'boolean' },
            styles: { type: 'string' }
          },
          required: ['hasMultipleStyles', 'styles']
        }
      }
    });

    const jsonStr = response.text || '{}';
    const parsed = JSON.parse(jsonStr);

    return {
      hasMultipleStyles: parsed.hasMultipleStyles === true,
      styles: parsed.styles || building.style
    };
  } catch (error) {
    console.error(`  ⚠️  Gemini error for "${building.name}":`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Fetching all buildings from Baserow...');
  const buildings = await fetchAllBuildings();
  console.log(`✅ Found ${buildings.length} total buildings\n`);

  // Filter for buildings with only one style (not comma-separated)
  const singleStyleBuildings = buildings.filter((building) => {
    const style = (building.style || '').trim();
    if (!style) return false; // Skip buildings with no style
    // Check if style contains comma (indicating multiple styles)
    return !style.includes(',');
  });

  console.log(`📋 Found ${singleStyleBuildings.length} buildings with single style tags\n`);

  if (singleStyleBuildings.length === 0) {
    console.log('No buildings with single styles found to check.');
    return;
  }

  console.log('⚠️  This script will check each building with Gemini to see if it legitimately has multiple styles.');
  console.log('   Only buildings that CLEARLY have multiple distinct styles will be updated.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  let checked = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const building of singleStyleBuildings) {
    try {
      checked++;
      console.log(`\n[${checked}/${singleStyleBuildings.length}] Checking "${building.name}" (ID: ${building.id})`);
      console.log(`   Current style: "${building.style || '(none)'}"`);

      const result = await checkMultipleStyles(building);

      if (!result) {
        console.log(`   ⏭️  Skipped due to error`);
        skipped++;
        continue;
      }

      if (!result.hasMultipleStyles) {
        console.log(`   ✓ Single style confirmed: "${result.styles}"`);
        skipped++;
        continue;
      }

      // Check if the new styles are actually different from current
      const currentStyle = (building.style || '').trim().toLowerCase();
      const newStyles = result.styles.trim();
      const newStylesLower = newStyles.toLowerCase();

      // If it's the same style (just reformatted), skip
      if (currentStyle === newStylesLower || newStylesLower === currentStyle) {
        console.log(`   ⏭️  Styles unchanged: "${newStyles}"`);
        skipped++;
        continue;
      }

      console.log(`   ✨ Multiple styles detected: "${newStyles}"`);
      console.log(`   📝 Updating from "${building.style}" to "${newStyles}"`);

      await updateBuilding(building.id, newStyles);
      console.log(`   ✅ Updated successfully`);
      updated++;

      // Delay to avoid rate limits (both Baserow and Gemini)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Failed:`, error.message);
      failed++;
      // Still delay even on error to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   🔍 Checked: ${checked} buildings`);
  console.log(`   ✅ Updated: ${updated} buildings (found multiple styles)`);
  console.log(`   ⏭️  Skipped: ${skipped} buildings (single style confirmed or unchanged)`);
  console.log(`   ❌ Failed: ${failed} buildings`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

