/**
 * Script to find and update cathedrals in Baserow
 * Sets their style to "Cathedral" if the name contains "cathedral" (case-insensitive)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASEROW_API_BASE = 'https://api.baserow.io/api/database/rows/table';
const TABLE_ID = process.env.BASEROW_TABLE_ID || process.env.VITE_BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID;
const API_TOKEN = process.env.BASEROW_API_TOKEN || process.env.VITE_BASEROW_API_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;

if (!TABLE_ID || !API_TOKEN) {
  console.error('Missing BASEROW_TABLE_ID or BASEROW_API_TOKEN environment variables');
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

async function main() {
  console.log('🔍 Fetching all buildings from Baserow...');
  const buildings = await fetchAllBuildings();
  console.log(`✅ Found ${buildings.length} total buildings\n`);

  // Find cathedrals (case-insensitive check)
  const cathedrals = buildings.filter((building) => {
    const name = (building.name || '').toLowerCase();
    return name.includes('cathedral');
  });

  console.log(`🏛️  Found ${cathedrals.length} cathedrals:\n`);

  if (cathedrals.length === 0) {
    console.log('No cathedrals found to update.');
    return;
  }

  // Show what will be updated
  cathedrals.forEach((cathedral) => {
    const currentStyle = cathedral.style || '(no style)';
    const currentStyleLower = (cathedral.style || '').toLowerCase();
    const styles = currentStyleLower.split(',').map(s => s.trim());
    const hasCathedral = styles.some(s => s.includes('cathedral'));
    
    if (!hasCathedral) {
      const newStyle = cathedral.style 
        ? `Cathedral, ${cathedral.style}`
        : 'Cathedral';
      console.log(`  - "${cathedral.name}" (ID: ${cathedral.id})`);
      console.log(`    Current style: ${currentStyle}`);
      console.log(`    Will update to: ${newStyle}\n`);
    }
  });

  // Ask for confirmation (in a real script, you might want to add a prompt)
  console.log('⚠️  This will add "Cathedral" as the primary style for all cathedrals');
  console.log('   (existing styles will be preserved as secondary styles)');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Update cathedrals
  let updated = 0;
  let failed = 0;

  for (const cathedral of cathedrals) {
    try {
      // Check if it already has "Cathedral" style (handles comma-separated styles)
      const currentStyle = (cathedral.style || '').toLowerCase();
      const styles = currentStyle.split(',').map(s => s.trim());
      const hasCathedral = styles.some(s => s.includes('cathedral'));
      
      if (hasCathedral) {
        console.log(`⏭️  Skipping "${cathedral.name}" - already has Cathedral style`);
        continue;
      }

      // Add Cathedral to existing styles (comma-separated) or set as new style
      // Cathedral becomes the primary (first) style for color purposes
      const newStyle = cathedral.style 
        ? `Cathedral, ${cathedral.style}`
        : 'Cathedral';
      
      await updateBuilding(cathedral.id, newStyle);
      console.log(`✅ Updated "${cathedral.name}" (ID: ${cathedral.id})`);
      console.log(`   Style changed from: "${cathedral.style || '(none)'}"`);
      console.log(`   Style changed to: "${newStyle}"`);
      updated++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Failed to update "${cathedral.name}" (ID: ${cathedral.id}):`, error.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated} cathedrals`);
  console.log(`   ❌ Failed: ${failed} cathedrals`);
  console.log(`   ⏭️  Skipped: ${cathedrals.length - updated - failed} cathedrals (already had Cathedral style)`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

