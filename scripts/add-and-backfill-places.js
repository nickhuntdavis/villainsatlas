// scripts/add-and-backfill-places.js
// 1) Add a curated list of buildings as new rows in Baserow (if they don't already exist)
// 2) Backfill fields for those new rows ONLY using Google Places:
//    - country, city, lat, lng, google_place_id, image_url, notes, location
//    Architect is left untouched for manual curation.
//
// Usage:
//   node scripts/add-and-backfill-places.js
//
// Requirements:
//   .env.local with:
//     REACT_APP_BASEROW_API_TOKEN=...
//     REACT_APP_BASEROW_TABLE_ID=772747
//     GOOGLE_MAPS_API_KEY=...   (or REACT_APP_GOOGLE_MAPS_API_KEY)

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID =
  process.env.BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

if (!TABLE_ID || !BASEROW_TOKEN || !MAPS_KEY) {
  console.error(
    "Missing env vars. Need BASEROW_TABLE_ID / REACT_APP_BASEROW_TABLE_ID, BASEROW_TOKEN / REACT_APP_BASEROW_API_TOKEN, and GOOGLE_MAPS_API_KEY (or REACT_APP_GOOGLE_MAPS_API_KEY)."
  );
  process.exit(1);
}

// Curated list of places (name, city, styleHint)
// NOTE: This covers the structured "Name — City — Style" entries from your list.
// If you want to include the extra free-form lines at the bottom, we can add them later.
const PLACES = [
  ["Alex Theatre", "Glendale", "Art Deco"],
  ["American Radiator Building", "New York", "Art Deco"],
  ["Australian War Memorial", "Canberra", "Neoclassical / Art Deco"],
  ["Battersea Power Station", "London", "Art Deco / Industrial"],
  ["Boston Avenue United Methodist Church", "Tulsa", "Art Deco (Ecclesiastical)"],
  ["Brussels Town Hall", "Brussels", "Gothic"],
  ["Buffalo City Hall", "Buffalo", "Art Deco"],
  ["Burgos Cathedral", "Burgos", "Gothic"],
  ["Canterbury Cathedral", "Canterbury", "Gothic / Romanesque"],
  ["Carreras Cigarette Factory", "London", "Art Deco"],
  ["Cathedral de Sevilla", "Seville", "Gothic"],
  ["Cathedral of Barcelona", "Barcelona", "Gothic"],
  ["Cathedral of Learning", "Pittsburgh", "Gothic Revival"],
  ["Cathedral of Notre-Dame of Reims", "Reims", "Gothic"],
  ["Cathedral of Santa Maria del Fiore", "Florence", "Gothic / Renaissance"],
  ["Cathedral of Zagreb", "Zagreb", "Gothic Revival"],
  ["Chanin Building", "New York", "Art Deco"],
  ["Chicago Board of Trade Building", "Chicago", "Art Deco"],
  ["Chrysler Building", "New York", "Art Deco"],
  ["Church of Our Lady", "Bruges", "Gothic"],
  ["Cincinnati Union Terminal", "Cincinnati", "Art Deco"],
  ["Claridge’s", "London", "Art Deco"],
  ["Cologne Cathedral", "Cologne", "Gothic"],
  ["Corvin Castle", "Hunedoara", "Gothic / Renaissance"],
  ["Coutances Cathedral", "Coutances", "Gothic"],
  ["Daily Express Building", "London", "Art Deco"],
  ["Doge’s Palace", "Venice", "Venetian Gothic"],
  ["Duomo di Milano", "Milan", "Gothic"],
  ["Eastern Columbia Lofts", "Los Angeles", "Art Deco"],
  ["Edificio Kavanagh", "Buenos Aires", "Art Deco / Rationalist"],
  ["Eltham Palace", "London", "Art Deco / Tudor"],
  ["Empire State Building", "New York", "Art Deco"],
  ["Eros IMAX", "Mumbai", "Art Deco"],
  ["Express Building", "Manchester", "Art Deco"],
  ["Exeter Cathedral", "Exeter", "Gothic"],
  ["Fisher Building", "Detroit", "Art Deco"],
  ["Frankfurt Cathedral", "Frankfurt am Main", "Gothic"],
  ["Gasson Hall", "Newton", "Collegiate Gothic"],
  ["Gloucester Cathedral", "Gloucester", "Gothic"],
  ["Guardian Building", "Detroit", "Art Deco"],
  ["Griffith Observatory", "Los Angeles", "Art Deco / Moderne"],
  ["Hilton Moscow Leningradskaya", "Moscow", "Stalinist Empire"],
  ["Hoover Building", "Perivale", "Art Deco"],
  ["Hotel International", "Prague", "Art Deco / Functionalist"],
  ["Hotel Ukraine", "Kyiv", "Stalinist Empire"],
  ["Houston City Hall", "Houston", "Art Deco / Moderne"],
  ["King’s College Chapel", "Cambridge", "Perpendicular Gothic"],
  ["Kudrinskaya Square Building", "Moscow", "Stalinist Empire"],
  ["Kotelnicheskaya Embankment Building", "Moscow", "Stalinist Empire"],
  ["La Cathédrale Saint-Pierre", "Beauvais", "Gothic"],
  ["León Cathedral", "León", "Gothic"],
  ["Lincoln Cathedral", "Lincoln", "Gothic"],
  ["Louisiana State Capitol", "Baton Rouge", "Art Deco"],
  ["Los Angeles City Hall", "Los Angeles", "Art Deco"],
  ["Luhrs Tower", "Phoenix", "Art Deco"],
  ["LVQ Apartments", "Columbus", "Art Deco"],
  ["Mausoleum of Lenin", "Moscow", "Constructivist"],
  ["Mir Castle", "Mir", "Gothic / Renaissance"],
  ["Moskovskiy", "Saint Petersburg", "Stalinist Empire"],
  ["National Basilica of the Sacred Heart", "Ganshoren", "Art Deco"],
  ["National Diet Building", "Tokyo", "Imperial Neoclassical"],
  ["Nebraska State Capitol", "Lincoln", "Art Deco"],
  ["New India Assurance Building", "Kolkata", "Art Deco"],
  ["Niagara Mohawk Building", "Syracuse", "Art Deco"],
  ["Notre-Dame Cathedral", "Paris", "Gothic"],
  ["One Wall Street", "New York", "Art Deco"],
  ["Orvieto Cathedral", "Orvieto", "Gothic"],
  ["Our Lady of Chartres Cathedral", "Chartres", "Gothic"],
  ["Pace University Midtown Center", "New York", "Art Deco"],
  ["Palacio de Bellas Artes", "Mexico City", "Art Nouveau / Art Deco"],
  ["Palace of Culture and Science", "Warsaw", "Stalinist Socialist Realism"],
  ["Palais de Tokyo", "Paris", "Modernist / Art Deco"],
  ["Palais des Papes", "Avignon", "Gothic"],
  ["Paramount Theatre", "Oakland", "Art Deco"],
  ["Radio City Music Hall", "New York", "Art Deco"],
  ["Radisson Collection Hotel", "Moscow", "Stalinist Empire"],
  ["Rector’s Palace", "Dubrovnik", "Gothic / Renaissance"],
  ["Rockefeller Plaza", "New York", "Art Deco"],
  ["Roskilde Cathedral", "Roskilde", "Gothic / Brick Gothic"],
  ["Salisbury Cathedral", "Salisbury", "Gothic"],
  ["Sainte-Chapelle", "Paris", "Gothic"],
  ["Saint Mary’s Cathedral", "Sydney", "Gothic Revival"],
  ["Selimiye Camii", "Edirne", "Ottoman"],
  ["Shell-Haus", "Berlin", "Modernist"],
  ["Shukhov Tower", "Moscow", "Constructivist"],
  ["Siena Cathedral", "Siena", "Gothic"],
  ["St. Jane", "Chicago", "Art Deco"],
  ["St. Stephen’s Cathedral", "Vienna", "Gothic"],
  ["St. Vitus Cathedral", "Prague", "Gothic"],
  ["Strand Palace", "London", "Art Deco"],
  ["Teatro Eden", "Lisbon", "Art Deco"],
  ["Théâtre des Champs-Élysées", "Paris", "Early Modernist / Art Deco"],
  ["The Alexandra", "Birmingham", "Art Deco"],
  ["The Black Church", "Brașov", "Gothic"],
  ["The Eldorado", "New York", "Art Deco"],
  ["The State Kremlin Palace", "Moscow", "Soviet Modernism"],
  ["The Woolworth Building", "New York", "Gothic Revival / Art Deco"],
  ["Times Square Building", "Rochester", "Art Deco"],
  ["Tribune Tower", "Chicago", "Neo-Gothic"],
  ["Ulm Minster", "Ulm", "Gothic"],
  ["Vienna City Hall", "Vienna", "Neo-Gothic"],
  ["Wawel Cathedral", "Kraków", "Gothic / Renaissance"],
  ["Wells Cathedral", "Wells", "Gothic"],
  ["Westminster Abbey", "London", "Gothic"],
  ["Washington National Cathedral", "Washington, D.C.", "Gothic Revival"],

  // Additional entries from extended list
  ["German Observation Tower In Guernsey", "Guernsey", ""],
  ["The Iron Fountain In Armenia", "Armenia", ""],
  ['Benito Mussolini’s Headquarters "Palazzo Braschi" In Rome 1934', "Rome", ""],
  ["Hallgrímskirkja Church In Iceland", "Iceland", ""],
  ["Headquarters Of Caixa Geral De Depósitos", "Lisbon", ""],
  ["Brutalism In Berlin. A Building Cult", "Berlin", "Brutalism"],
  ["St. Nikolai Memorial Cathedral", "Hamburg", "Gothic"],
  ["Rynok Square", "Lviv", ""],
  ["DC Tower", "Vienna", ""],
  ["Three Gorges Dam", "", ""],

  ["Barbican Estate", "London", "Brutalism"],
  ["Boston City Hall", "Boston", "Brutalism"],
  ["Habitat 67", "Montreal", "Brutalist / Megastructure"],
  ["National Theatre", "London", "Brutalism"],

  ["30 Rockefeller Plaza", "New York", "Art Deco"],
  ["General Electric Building (570 Lexington Ave)", "New York", "Art Deco"],
  ["McGraw-Hill Building", "New York", "Art Deco / Streamline Moderne"],
  ["Marine Building", "Vancouver", "Art Deco"],
  ["Napier Municipal Theatre", "Napier", "Art Deco"],

  ["Moscow State University (Main Building)", "Moscow", "Stalinist Empire"],
  ["House of the Government", "Minsk", "Stalinist / Socialist Realism"],
  ["Palace of the Parliament", "Bucharest", "Socialist Realism"],

  ["St. Patrick’s Cathedral", "New York", "Gothic Revival"],
  ["Cologne City Hall Tower", "Cologne", "Gothic"],
  ["Chartreuse de Champmol", "Dijon", "Gothic"],

  ["Palace of Justice", "Brussels", "Neoclassical"],
  ["Supreme Court of the United States", "Washington, D.C.", "Neoclassical"],
  ["Altare della Patria", "Rome", "Monumental Neoclassical"],
  ["Palazzo della Civiltà Italiana", "Rome", "Rationalist"],
  ["Villa Savoye", "Poissy", "Modernist"],
  ["Einstein Tower", "Potsdam", "Expressionist"],
  ["Municipal Building", "New York", "Beaux-Arts / Civic Monumental"],
  ["Terminal Tower", "Cleveland", "Art Deco"],
  ["Carew Tower", "Cincinnati", "Art Deco"],

  // New curated entries from latest list
  ["Voortrekker Monument", "Pretoria", ""],
  ["Union Buildings", "Pretoria", ""],
  ["Mutual Building", "Cape Town", ""],
  ["Telkom Towers", "Pretoria", ""],
  ["Anstey’s Building", "Johannesburg", ""],
  ["Ponte City Apartments", "Johannesburg", ""],

  ["Ananta Samakhom Throne Hall", "Bangkok", ""],
  ["Burj Khalifa", "Dubai", ""],
  ["Former Supreme Court", "Singapore", ""],
  ["Sultan Abdul Samad Building", "Kuala Lumpur", ""],
  ["Hagia Sophia", "Istanbul", ""],
  ["Yivli Minare Mosque", "Antalya", ""],
  ["National Assembly Building", "Seoul", ""],
  ["Central Public Hall", "Osaka", ""],
  ["Former Supreme Court", "Hong Kong", ""],
  ["Abraj Al Bait", "Mecca", ""],
  ["Chhatrapati Shivaji Terminus", "Mumbai", ""],
  ["Provincial Hall", "Phuket", ""],
  ["Ruins of St. Paul’s", "Macau", ""],
  ["Chiang Kai-shek Memorial Hall", "Taipei", ""],
  ["Sanctuary of Truth", "Pattaya", ""],
  ["Customs House", "Shanghai", ""],
  ["Quba Mosque", "Medina", ""],
  ["Kingdom Centre", "Riyadh", ""],

  ["Cairo Tower", "Cairo", "Modernist Monumental"],
  ["Supreme Constitutional Court", "Cairo", "Neo-Pharaonic / Monumental"],

  ["Hassan II Mosque", "Casablanca", "Monumental Islamic"],

  ["African Union Headquarters", "Addis Ababa", "Monumental Modernist"],

  ["Cathedral of St Vincent de Paul", "Tunis", "Romanesque / Byzantine Revival"],

  ["National Mosque", "Abuja", "Monumental Islamic"],
  ["ECOWAS Secretariat", "Abuja", "Late Modernist / Brutalist"],

  ["Presidential Palace", "Khartoum", "Modernist Authoritarian"],

  ["National Heroes’ Acre", "Harare", "Socialist Realism / Monumental"],

  ["Kenyatta International Convention Centre (KICC)", "Nairobi", "Modernist Monumental"],

  ["Martyrs’ Memorial (Maqam Echahid)", "Algiers", "Monumental Modernism"],

  ["African Renaissance Monument", "Dakar", "Monumental Nationalist"],

  ["Russian State Library", "Moscow", "Stalinist Neoclassical"],
  ["House of Soviets", "Kaliningrad", "Brutalist"],
  ["Palace of Congresses (Tavrichesky Palace extension)", "Saint Petersburg", "Soviet Monumental"],
  ["Ministry of Defence Building", "Moscow", "Neo-Stalinist Monumental"],
];

// --- Helper functions ---

// Check if a row with the same name (and optional city) already exists in Baserow.
// Only treat it as existing if the name actually matches; then optionally match on city.
async function findExistingRowByNameAndCity(name, city) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/?user_field_names=true&filter__name=${encodeURIComponent(
    name
  )}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.warn(
      `Failed to check existing row for "${name}": ${res.status} ${await res.text()}`
    );
    return null;
  }

  const data = await res.json();
  if (!data.results || !data.results.length) return null;

  const normalizedName = name.trim().toLowerCase();

  // Only consider rows whose name actually matches
  const sameNameRows = data.results.filter(
    (row) => (row.name || "").trim().toLowerCase() === normalizedName
  );
  if (!sameNameRows.length) return null;

  if (!city) {
    return sameNameRows[0];
  }

  const lowerCity = city.toLowerCase();
  const cityMatch =
    sameNameRows.find(
      (row) => (row.city || "").toLowerCase() === lowerCity
    ) || sameNameRows[0];

  return cityMatch;
}

// Create a new Baserow row with minimal initial data (name + style).
async function createBaserowRow(name, styleHint) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/?user_field_names=true`;

  const payload = {
    name,
    style: styleHint || "",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to create row for "${name}": ${res.status} ${await res.text()}`);
  }

  return await res.json();
}

// Use Places Find Place + Details to get detailed info
async function fetchPlaceDetailsForNameAndCity(name, city) {
  // Build a query: "Name, City"
  const query = city ? `${name}, ${city}` : name;

  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    query
  )}&inputtype=textquery&fields=place_id,formatted_address&key=${MAPS_KEY}`;

  let res = await fetch(findUrl);
  if (!res.ok) {
    console.warn(`FindPlace error for "${query}": ${res.status} ${res.statusText}`);
    return null;
  }

  let data = await res.json();
  const candidates = data.candidates || [];
  if (!candidates.length) {
    console.log(`  No candidates for query="${query}"`);
    return null;
  }

  const placeId = candidates[0].place_id;
  if (!placeId) {
    console.log(`  Candidate has no place_id for query="${query}"`);
    return null;
  }

  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=place_id,formatted_address,address_components,geometry,photos,editorial_summary&key=${MAPS_KEY}`;

  res = await fetch(detailsUrl);
  if (!res.ok) {
    console.warn(`Details error for place_id=${placeId}: ${res.status} ${res.statusText}`);
    return null;
  }

  data = await res.json();
  const result = data.result;
  if (!result) return null;

  const components = result.address_components || [];
  let country = "";
  let detectedCity = "";
  for (const c of components) {
    if (c.types.includes("country")) country = c.long_name;
    if (
      c.types.includes("locality") ||
      c.types.includes("postal_town") ||
      c.types.includes("administrative_area_level_1")
    ) {
      if (!detectedCity) detectedCity = c.long_name;
    }
  }

  const lat = result.geometry?.location?.lat ?? null;
  const lng = result.geometry?.location?.lng ?? null;
  const location = result.formatted_address || "";
  const notes = result.editorial_summary?.overview || "";

  let imageUrl = "";
  if (result.photos && result.photos.length > 0) {
    const photoRef = result.photos[0].photo_reference;
    if (photoRef) {
      imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
        photoRef
      )}&key=${MAPS_KEY}`;
    }
  }

  return {
    placeId,
    country,
    city: detectedCity,
    lat,
    lng,
    location,
    imageUrl,
    notes,
  };
}

// PATCH Baserow row with backfilled fields
async function updateBaserowRow(rowId, updates) {
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
    console.warn(`Failed to update row ${rowId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

// --- Main ---

async function main() {
  console.log(`Using Baserow table ${TABLE_ID}`);
  console.log(`Total curated places: ${PLACES.length}`);

  for (const [name, city, styleHint] of PLACES) {
    console.log(`\n=== Processing "${name}" (${city || "no city"}) ===`);

    // 1) Skip if a row with this name (and optional city) already exists
    try {
      const existing = await findExistingRowByNameAndCity(name, city);
      if (existing) {
        console.log(
          `  ⚠ Row already exists in Baserow (id=${existing.id}) — skipping creation/backfill`
        );
        continue;
      }
    } catch (e) {
      console.warn(`  ⚠️ Error checking existing row for "${name}":`, e);
    }

    // 2) Create a new row with name + style for this curated place
    let newRow;
    try {
      newRow = await createBaserowRow(name, styleHint);
      console.log(`  ✅ Created new Baserow row id=${newRow.id}`);
    } catch (e) {
      console.warn(`  ⚠️ Failed to create row for "${name}":`, e);
      continue;
    }

    const rowId = newRow.id;

    // 3) Fetch place details and backfill ONLY this new row
    let details;
    try {
      details = await fetchPlaceDetailsForNameAndCity(name, city);
    } catch (e) {
      console.warn(`  ⚠️ Places error for "${name}":`, e);
      continue;
    }

    if (!details) {
      console.log(`  No place details found for "${name}"`);
      continue;
    }

    const updates = {};

    if (details.country) updates["country"] = details.country;
    if (details.city) updates["city"] = details.city;
    if (typeof details.lat === "number" && typeof details.lng === "number") {
      updates["lat"] = String(details.lat);
      updates["lng"] = String(details.lng);
    }
    if (details.placeId) updates["google_place_id"] = details.placeId;
    if (details.location) updates["location"] = details.location;
    if (details.imageUrl) updates["image_url"] = details.imageUrl;
    if (details.notes) {
      updates["notes"] = details.notes;
    }

    // Architect is intentionally not touched.

    if (Object.keys(updates).length === 0) {
      console.log("  Nothing to update for this row.");
    } else {
      const ok = await updateBaserowRow(rowId, updates);
      if (ok) {
        console.log("  ✅ Backfilled new row with:", updates);
      }
    }

    // Small delay to be polite to APIs
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\nAdd-and-backfill script complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


