/**
 * Simple test script to verify Baserow connection
 * Run with: node test-baserow.js
 * 
 * Make sure .env.local exists with:
 * REACT_APP_BASEROW_API_TOKEN=your_token
 * REACT_APP_BASEROW_TABLE_ID=772747
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

async function testBaserow() {
  console.log('🔍 Testing Baserow Connection...\n');
  console.log(`Table ID: ${TABLE_ID}`);
  console.log(`API Token: ${API_TOKEN.substring(0, 10)}...${API_TOKEN.substring(API_TOKEN.length - 4)}\n`);

  try {
    // Test 1: Fetch all buildings
    console.log('📋 Test 1: Fetching all buildings...');
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
    console.log(`✅ Success! Found ${data.results?.length || 0} entries in Baserow\n`);

    if (data.results && data.results.length > 0) {
      console.log('📊 Sample entries:');
      data.results.slice(0, 3).forEach((entry, i) => {
        console.log(`\n  ${i + 1}. ${entry.name || 'Unnamed'}`);
        console.log(`     Location: ${entry.city || 'N/A'}, ${entry.country || 'N/A'}`);
        console.log(`     Coordinates: ${entry.lat || 'N/A'}, ${entry.lng || 'N/A'}`);
      });
    }

    // Test 2: Search for "Nick"
    console.log('\n\n🔍 Test 2: Searching for "Nick"...');
    const nickResponse = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/?user_field_names=true&filter__name=Nick`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!nickResponse.ok) {
      throw new Error(`HTTP ${nickResponse.status}: ${nickResponse.statusText}`);
    }

    const nickData = await nickResponse.json();
    if (nickData.results && nickData.results.length > 0) {
      console.log(`✅ Found "Nick" entry!`);
      const nick = nickData.results[0];
      console.log(`   Name: ${nick.name}`);
      console.log(`   Location: ${nick.city || 'N/A'}, ${nick.country || 'N/A'}`);
      console.log(`   Coordinates: ${nick.lat || 'N/A'}, ${nick.lng || 'N/A'}`);
    } else {
      console.log('⚠️  "Nick" entry not found in database');
    }

    console.log('\n\n✅ All Baserow tests passed!');
    console.log('🚀 You can now run the webapp with: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Baserow test failed:');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that REACT_APP_BASEROW_API_TOKEN is set in .env.local');
    console.error('   2. Verify the API token has read permissions');
    console.error('   3. Confirm the table ID (772747) is correct');
    process.exit(1);
  }
}

testBaserow();

