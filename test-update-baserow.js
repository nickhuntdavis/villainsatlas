/**
 * Test script to verify Baserow update functionality
 * Run with: node test-update-baserow.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Simple .env.local parser
function loadEnv() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const envPath = join(__dirname, '.env.local');
    const envFile = readFileSync(envPath, 'utf-8');
    
    const env = {};
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return env;
  } catch (error) {
    console.warn('⚠️  Could not read .env.local, using defaults or environment variables');
    return {};
  }
}

const env = loadEnv();
const TABLE_ID = env.REACT_APP_BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const API_TOKEN = env.REACT_APP_BASEROW_API_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN || "FhAvq74hSan4hSyyYB012Vp5eQmoOaGR";
const BASEROW_API_BASE = "https://api.baserow.io/api/database/rows/table";

async function testBaserowUpdate() {
  console.log('🧪 Testing Baserow Update Functionality...\n');

  try {
    // Step 1: Fetch all buildings to see current state
    console.log('📋 Step 1: Fetching current buildings from Baserow...');
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/?user_field_names=true`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const buildings = data.results || [];
    
    console.log(`✅ Found ${buildings.length} entries in Baserow\n`);

    if (buildings.length === 0) {
      console.log('⚠️  No buildings found. You need to search for buildings in the webapp first.');
      return;
    }

    // Step 2: Show current state of first few buildings
    console.log('📊 Current state of buildings (showing first 3):\n');
    buildings.slice(0, 3).forEach((building, i) => {
      console.log(`  ${i + 1}. ${building.name || 'Unnamed'}`);
      console.log(`     City: ${building.city || '❌ MISSING'}`);
      console.log(`     Country: ${building.country || '❌ MISSING'}`);
      console.log(`     Google Place ID: ${building.google_place_id || '❌ MISSING'}`);
      console.log(`     Google Maps URL: ${building.Gmaps_url ? '✅ Present' : '❌ MISSING'}`);
      console.log(`     Coordinates: ${building.lat || 'N/A'}, ${building.lng || 'N/A'}\n`);
    });

    // Step 3: Test update functionality
    if (buildings.length > 0) {
      const testBuilding = buildings[0];
      const rowId = testBuilding.id;
      
      console.log(`\n🔄 Step 2: Testing update on "${testBuilding.name}" (ID: ${rowId})...`);
      
      const updatePayload = {
        name: testBuilding.name,
        city: testBuilding.city || "Test City",
        country: testBuilding.country || "Test Country",
        lat: testBuilding.lat || "0",
        lng: testBuilding.lng || "0",
        google_place_id: testBuilding.google_place_id || "TEST_PLACE_ID",
        Gmaps_url: testBuilding.Gmaps_url || "https://maps.google.com/?q=test",
        image_url: testBuilding.image_url || "",
        notes: testBuilding.notes || "Updated by test script",
      };

      const updateResponse = await fetch(
        `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Token ${API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatePayload),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Update failed: ${updateResponse.status} - ${errorText}`);
      }

      const updatedData = await updateResponse.json();
      console.log('✅ Update successful!');
      console.log(`   Updated: ${updatedData.name}`);
      console.log(`   City: ${updatedData.city || 'N/A'}`);
      console.log(`   Country: ${updatedData.country || 'N/A'}`);
      console.log(`   Google Place ID: ${updatedData.google_place_id || 'N/A'}`);
      console.log(`   Google Maps URL: ${updatedData.Gmaps_url ? 'Present' : 'Missing'}\n`);
    }

    console.log('✅ All tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start the webapp: npm run dev');
    console.log('   2. Search for buildings in the webapp');
    console.log('   3. Check browser console for "Updated" or "Saved" messages');
    console.log('   4. Verify in Baserow that city, country, and Google Maps data are populated\n');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that REACT_APP_BASEROW_API_TOKEN is set in .env.local');
    console.error('   2. Verify the API token has write permissions');
    console.error('   3. Confirm the table ID (772747) is correct');
    process.exit(1);
  }
}

testBaserowUpdate();

