import { Building, Coordinates } from "../types";

const BASEROW_API_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID = process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const API_TOKEN = process.env.REACT_APP_BASEROW_API_TOKEN || "FhAvq74hSan4hSyyYB012Vp5eQmoOaGR";

// Helper to calculate distance in meters (Haversine formula)
const getDistance = (coord1: Coordinates, coord2: Coordinates): number => {
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

// Baserow row format (what we get from API)
interface BaserowRow {
  id: number;
  name?: string;
  city?: string;
  country?: string;
  lat?: string;
  lng?: string;
  google_place_id?: string;
  Gmaps_url?: string;
  image_url?: string;
  notes?: string;
  style?: string; // Architectural style
  architect?: string; // Architect name if available
  location?: string; // Full address/location
  is_prioritized?: boolean; // Whether building is prioritized (Art Deco by famous architect)
}

// Extended Building interface for saving (includes Baserow-specific fields)
interface BuildingForSave extends Building {
  city?: string;
  country?: string;
  googlePlaceId?: string;
}

// Helper function to extract URL from markdown link format [text](url) or just return URL if already plain
const extractUrlFromMarkdown = (urlString: string | undefined): string | undefined => {
  if (!urlString) return undefined;
  
  // Check if it's a markdown link format: [text](url) or [url](url)
  const markdownLinkMatch = urlString.match(/\[([^\]]*)\]\(([^)]+)\)/);
  if (markdownLinkMatch) {
    // Return the URL part (second capture group)
    return markdownLinkMatch[2];
  }
  
  // If not markdown, return as-is
  return urlString;
};

// Convert Baserow row to Building type
const baserowRowToBuilding = (row: BaserowRow): Building => {
  const lat = parseFloat(row.lat || "0");
  const lng = parseFloat(row.lng || "0");
  
  // Use location from Baserow if available, otherwise construct from city/country
  const location = row.location || (row.city && row.country 
    ? `${row.city}, ${row.country}` 
    : row.city || row.country || "Unknown Location");

  // Use is_prioritized from Baserow - only trust explicit value, don't derive
  // This ensures only buildings explicitly marked as prioritized get the special styling
  const isPrioritized = row.is_prioritized === true;

  // Extract image URL from markdown format if present
  const rawImageUrl = extractUrlFromMarkdown(row.image_url);
  // Allow all image URLs for display (previously only allowed Google Places)
  // This ensures images like Nick's can display even if not from Google Places
  const imageUrl = rawImageUrl || undefined;

  return {
    id: `baserow-${row.id}`,
    name: row.name || "Unnamed Building",
    location,
    city: row.city,
    country: row.country,
    description: row.notes || "",
    style: row.style as any, // Convert string to ArchitecturalStyle enum
    coordinates: { lat, lng },
    gmapsUrl: row.Gmaps_url,
    googlePlaceId: row.google_place_id,
    imageUrl: imageUrl,
    isPrioritized: !!isPrioritized,
    architect: row.architect || undefined,
  };
};

// Fetch all buildings from Baserow (with pagination)
// Optionally limit to first N pages for progressive loading
export const fetchAllBuildings = async (limitPages?: number): Promise<Building[]> => {
  try {
    const allRows: any[] = [];
    let page = 1;
    const pageSize = 200;

    while (true) {
      const response = await fetch(
        `${BASEROW_API_BASE}/${TABLE_ID}/?user_field_names=true&page=${page}&size=${pageSize}`,
        {
          headers: {
            Authorization: `Token ${API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Baserow API error: ${response.status}`);
      }

      const data = await response.json();
      allRows.push(...data.results);

      // If limitPages is set and we've reached it, stop fetching
      if (limitPages && page >= limitPages) {
        break;
      }

      if (!data.next) break; // no more pages
      page += 1;
    }

    return allRows.map(baserowRowToBuilding);
  } catch (error) {
    console.error("Error fetching from Baserow:", error);
    throw error;
  }
};

// Fetch buildings near a location (within radius in meters)
export const fetchBuildingsNearLocation = async (
  center: Coordinates,
  radiusMeters: number = 50000 // Default 50km
): Promise<Building[]> => {
  try {
    // Fetch all buildings (Baserow doesn't have native geo queries)
    const allBuildings = await fetchAllBuildings();
    
    // Filter by distance
    return allBuildings.filter((building) => {
      const distance = getDistance(center, building.coordinates);
      return distance <= radiusMeters;
    });
  } catch (error) {
    console.error("Error fetching buildings near location:", error);
    throw error;
  }
};

// Fetch building by name (exact match)
export const fetchBuildingByName = async (name: string): Promise<Building | null> => {
  try {
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/?user_field_names=true&filter__name=${encodeURIComponent(name)}`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Baserow API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return baserowRowToBuilding(data.results[0]);
    }
    return null;
  } catch (error) {
    console.error("Error fetching building by name:", error);
    throw error;
  }
};

// Save a building to Baserow
export const saveBuildingToBaserow = async (building: Building): Promise<Building> => {
  try {
    // Validate coordinates
    if (!building.coordinates || 
        typeof building.coordinates.lat !== 'number' || 
        typeof building.coordinates.lng !== 'number' ||
        isNaN(building.coordinates.lat) || 
        isNaN(building.coordinates.lng)) {
      throw new Error(`Invalid coordinates for building "${building.name}": ${JSON.stringify(building.coordinates)}`);
    }
    // Use city/country from building if available, otherwise try to parse from location
    let city = (building as BuildingForSave).city || "";
    let country = (building as BuildingForSave).country || "";
    
    // Fallback: try to parse from location string if city/country not provided
    if (!city || !country) {
      const locationParts = building.location.split(",").map(s => s.trim());
      // Try to intelligently parse - usually last part is country
      if (locationParts.length >= 2) {
        // If we don't have city, use first part
        if (!city) {
          city = locationParts[0];
        }
        // If we don't have country, use last part
        if (!country) {
          country = locationParts[locationParts.length - 1];
        }
      }
    }

    // Prioritize gmapsUrl over groundingUrl (for backward compatibility)
    const gmapsUrl = building.gmapsUrl || building.groundingUrl || "";

    const payload = {
      name: building.name,
      city: city || "",
      country: country || "",
      lat: building.coordinates.lat.toString(),
      lng: building.coordinates.lng.toString(),
      google_place_id: building.googlePlaceId || (building as BuildingForSave).googlePlaceId || "",
      Gmaps_url: gmapsUrl,
      image_url: building.imageUrl || "",
      notes: building.description || "",
      location: building.location || "",
      style: building.style || "",
      architect: building.architect || "",
      is_prioritized: building.isPrioritized || false,
    };

    // Log what we're saving for debugging
    console.log(`Saving "${building.name}" to Baserow:`, {
      hasPlaceId: !!payload.google_place_id,
      hasImage: !!payload.image_url,
      hasGmapsUrl: !!payload.Gmaps_url,
      coordinates: `${payload.lat}, ${payload.lng}`,
    });

    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/?user_field_names=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return baserowRowToBuilding(data);
  } catch (error) {
    console.error("Error saving to Baserow:", error);
    throw error;
  }
};

// Helper to normalize names for fuzzy matching
const normalizeNameForMatch = (name: string): string => {
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// Helper to calculate similarity between two normalized names
const nameSimilarity = (name1: string, name2: string): number => {
  const norm1 = normalizeNameForMatch(name1);
  const norm2 = normalizeNameForMatch(name2);
  
  // Exact match after normalization
  if (norm1 === norm2) return 1.0;
  
  // One contains the other (high similarity)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    return shorter / longer;
  }
  
  // Calculate word overlap
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
};

// Check if building already exists and return the Baserow row ID if found (with fuzzy matching)
export const findExistingBuilding = async (building: Building): Promise<{ exists: boolean; rowId?: number }> => {
  try {
    const nearby = await fetchBuildingsNearLocation(building.coordinates, 1000); // 1km radius
    
    // First try exact name match
    let existing = nearby.find(
      (b) => normalizeNameForMatch(b.name) === normalizeNameForMatch(building.name)
    );
    
    // If no exact match, try fuzzy matching
    if (!existing) {
      existing = nearby.find((b) => {
        const nameSim = nameSimilarity(b.name, building.name);
        if (nameSim < 0.6) return false; // Names too different
        
        // Also check if coordinates are close (within 500m)
        const distance = getDistance(b.coordinates, building.coordinates);
        return distance < 500;
      });
    }
    
    if (existing) {
      // Extract Baserow row ID from the building ID (format: "baserow-{id}")
      const rowIdMatch = existing.id.match(/^baserow-(\d+)$/);
      if (rowIdMatch) {
        return { exists: true, rowId: parseInt(rowIdMatch[1], 10) };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error("Error checking if building exists:", error);
    return { exists: false };
  }
};

// Update an existing building in Baserow
export const updateBuildingInBaserow = async (rowId: number, building: Building): Promise<Building> => {
  try {
    // Use city/country from building if available, otherwise try to parse from location
    let city = (building as BuildingForSave).city || "";
    let country = (building as BuildingForSave).country || "";
    
    // Fallback: try to parse from location string if city/country not provided
    if (!city || !country) {
      const locationParts = building.location.split(",").map(s => s.trim());
      if (locationParts.length >= 2) {
        if (!city) {
          city = locationParts[0];
        }
        if (!country) {
          country = locationParts[locationParts.length - 1];
        }
      }
    }

    // Prioritize gmapsUrl over groundingUrl (for backward compatibility)
    const gmapsUrl = building.gmapsUrl || building.groundingUrl || "";

    const basePayload: any = {
      name: building.name,
      city: city || "",
      country: country || "",
      lat: building.coordinates.lat.toString(),
      lng: building.coordinates.lng.toString(),
      google_place_id: (building as BuildingForSave).googlePlaceId || "",
      Gmaps_url: gmapsUrl,
      notes: building.description || "",
      location: building.location || "",
      style: building.style || "",
      architect: building.architect || "",
      is_prioritized: building.isPrioritized || false,
    };

    // Only update image_url when we explicitly have one; otherwise preserve existing Baserow value
    const payload = building.imageUrl
      ? { ...basePayload, image_url: building.imageUrl }
      : basePayload;

    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return baserowRowToBuilding(data);
  } catch (error) {
    console.error("Error updating building in Baserow:", error);
    throw error;
  }
};

// Check if building already exists (by name and approximate location) - kept for backward compatibility
export const buildingExists = async (building: Building): Promise<boolean> => {
  const result = await findExistingBuilding(building);
  return result.exists;
};

// Dedupe function that can be called from the frontend
// Returns list of deleted row IDs that should be blacklisted
export const dedupeBaserowBuildings = async (): Promise<number[]> => {
  try {
    const allBuildings = await fetchAllBuildings();
    console.log(`🔍 Found ${allBuildings.length} total buildings for dedupe check`);

    // Group duplicates using fuzzy matching
    const duplicateGroups: Building[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < allBuildings.length; i++) {
      if (processed.has(allBuildings[i].id)) continue;

      const group = [allBuildings[i]];
      processed.add(allBuildings[i].id);

      for (let j = i + 1; j < allBuildings.length; j++) {
        if (processed.has(allBuildings[j].id)) continue;

        // Check if buildings are likely the same
        // Require higher similarity (0.75) OR exact normalized name match for better accuracy
        const nameSim = nameSimilarity(allBuildings[i].name, allBuildings[j].name);
        const normalized1 = normalizeNameForMatch(allBuildings[i].name);
        const normalized2 = normalizeNameForMatch(allBuildings[j].name);
        const exactMatch = normalized1 === normalized2;
        
        // Require higher similarity threshold (0.75) OR exact match, and closer distance (300m)
        // This makes dedupe less aggressive to avoid false positives
        if (nameSim >= 0.75 || exactMatch) {
          const distance = getDistance(allBuildings[i].coordinates, allBuildings[j].coordinates);
          // Stricter distance: 300m instead of 500m to reduce false matches
          if (distance < 300) {
            group.push(allBuildings[j]);
            processed.add(allBuildings[j].id);
          }
        }
      }

      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    }

    console.log(`📋 Found ${duplicateGroups.length} duplicate groups`);

    if (duplicateGroups.length === 0) {
      return [];
    }

    const deletedIds: number[] = [];

    for (const group of duplicateGroups) {
      // Log the duplicate group for debugging
      console.log(`\n🔍 Duplicate group (${group.length} buildings):`);
      group.forEach((b, idx) => {
        console.log(`  ${idx + 1}. "${b.name}" at ${b.location || `${b.city || ''}, ${b.country || ''}`} (ID: ${b.id})`);
      });

      // Score each building in the group
      const scored = group.map((b) => ({
        building: b,
        score: getBuildingScore(b),
      }));

      // Sort by score (highest first)
      scored.sort((a, b) => b.score - a.score);

      const keep = scored[0].building;
      const toDelete = scored.slice(1);

      console.log(`  ✅ Keeping: "${keep.name}" (score: ${scored[0].score.toFixed(1)})`);
      console.log(`  🗑️  Deleting ${toDelete.length} duplicate(s):`);

      for (const item of toDelete) {
        // Extract Baserow row ID from the building ID (format: "baserow-{id}")
        const rowIdMatch = item.building.id.match(/^baserow-(\d+)$/);
        if (rowIdMatch) {
          const rowId = parseInt(rowIdMatch[1], 10);
          try {
            // Delete from Baserow
            const deleteUrl = `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;
            const deleteRes = await fetch(deleteUrl, {
              method: "DELETE",
              headers: {
                Authorization: `Token ${API_TOKEN}`,
                "Content-Type": "application/json",
              },
            });

            if (deleteRes.ok) {
              deletedIds.push(rowId);
              console.log(`    🗑️ Deleted: "${item.building.name}" (score: ${item.score.toFixed(1)}, row ID: ${rowId})`);
              // Small delay to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 300));
            } else {
              console.error(`❌ Failed to delete row ${rowId}: ${deleteRes.status}`);
            }
          } catch (error) {
            console.error(`❌ Error deleting row ${rowId}:`, error);
          }
        }
      }
    }

    console.log(`✅ Dedupe complete. Deleted ${deletedIds.length} duplicates.`);
    return deletedIds;
  } catch (error) {
    console.error("Error during dedupe:", error);
    throw error;
  }
};

// Helper to score building quality (prefer ones with Google Place ID and images)
const getBuildingScore = (b: Building): number => {
  let score = 0;
  if (b.googlePlaceId) score += 10;
  if (b.imageUrl) score += 5;
  if (b.gmapsUrl) score += 2;
  if (b.description) score += 1;
  // Prefer buildings with more complete data
  if (b.city) score += 0.5;
  if (b.country) score += 0.5;
  if (b.location) score += 0.5;
  return score;
};

