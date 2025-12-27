import { Building, Coordinates, Comment } from "../types";
import { optimizeImage } from "../utils/imageOptimizer";

const BASEROW_API_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID = process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const API_TOKEN = process.env.REACT_APP_BASEROW_API_TOKEN;

if (!API_TOKEN) {
  console.error("CRITICAL: REACT_APP_BASEROW_API_TOKEN environment variable is required");
  throw new Error("Baserow API token is not configured. Please set REACT_APP_BASEROW_API_TOKEN environment variable.");
}

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

// Baserow file field format (what we get from API)
interface BaserowFileField {
  name: string;
  url: string;
  size?: number;
  mime_type?: string;
}

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
  image_1?: BaserowFileField[] | null; // File field - array of file objects
  image_2?: BaserowFileField[] | null;
  image_3?: BaserowFileField[] | null;
  notes?: string;
  style?: string; // Architectural style
  architect?: string; // Architect name if available
  location?: string; // Full address/location
  is_prioritized?: boolean; // Whether building is prioritized (Art Deco by famous architect)
  is_hidden?: boolean; // Whether building is hidden (soft-deleted)
  is_purple_heart?: boolean; // Whether building should have a purple glowing heart
  source?: string; // Source of building entry (e.g., 'manual')
  favourites?: boolean; // Whether building is marked as a favourite
  comment_1?: string; // Rich text comment field 1
  comment_2?: string; // Rich text comment field 2
  comment_3?: string; // Rich text comment field 3
  comment_4?: string; // Rich text comment field 4
  comment_5?: string; // Rich text comment field 5
  comment_6?: string; // Rich text comment field 6
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

// Upload a file to Baserow and return the file object
export const uploadFileToBaserow = async (file: File): Promise<BaserowFileField> => {
  try {
    // Optimize image before upload (only for image files)
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      try {
        fileToUpload = await optimizeImage(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.85,
          format: 'jpeg', // Convert to JPEG for better compression
        });
      } catch (optimizationError) {
        console.warn(`Failed to optimize image "${file.name}", uploading original:`, optimizationError);
        // Continue with original file if optimization fails
      }
    }
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    
    // Baserow file upload endpoint
    const uploadUrl = 'https://api.baserow.io/api/user-files/upload-file/';
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${API_TOKEN}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow file upload error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Baserow returns file object with name, url, size, mime_type
    return {
      name: data.name || fileToUpload.name,
      url: data.url || data.thumbnails?.url || data.original || '',
      size: data.size || fileToUpload.size,
      mime_type: data.mime_type || fileToUpload.type,
    };
  } catch (error) {
    console.error('Error uploading file to Baserow:', error);
    throw error;
  }
};

// Convert Baserow row to Building type
const baserowRowToBuilding = (row: BaserowRow): Building => {
  const lat = parseFloat(row.lat || "0");
  const lng = parseFloat(row.lng || "0");
  
  // Use location from Baserow if available, otherwise construct from city/country
  const location = row.location || (row.city && row.country 
    ? `${row.city}, ${row.country}` 
    : row.city || row.country || "Unknown Location");

  // Use is_prioritized from Baserow - only trust explicit boolean true value
  // This ensures only buildings explicitly marked as prioritized get the special styling
  // Reject any truthy values that aren't exactly boolean true (handles strings, numbers, etc.)
  const isPrioritized = row.is_prioritized === true && typeof row.is_prioritized === 'boolean';

  // Check for purple heart buildings - either from Baserow field or by name
  const purpleHeartBuildings = [
    'Our First Date',
    'Our Kissing Station',
    'Not Tram 13',
    'Our first weekend away'
  ];
  const hasPurpleHeart = row.is_purple_heart === true || 
    purpleHeartBuildings.some(purpleName => row.name === purpleName);

  // Extract image URLs from file fields (image_1, image_2, image_3)
  const imageUrls: string[] = [];
  
  // Helper to extract URL from file field (can be array or single object)
  const extractFileUrl = (field: BaserowFileField[] | BaserowFileField | null | undefined): string | null => {
    if (!field) return null;
    if (Array.isArray(field) && field.length > 0) {
      return field[0].url || null;
    }
    if (typeof field === 'object' && 'url' in field) {
      return field.url || null;
    }
    return null;
  };
  
  // Extract URLs from file fields
  const img1Url = extractFileUrl(row.image_1);
  const img2Url = extractFileUrl(row.image_2);
  const img3Url = extractFileUrl(row.image_3);
  
  if (img1Url) imageUrls.push(img1Url);
  if (img2Url) imageUrls.push(img2Url);
  if (img3Url) imageUrls.push(img3Url);
  
  // Fallback to legacy image_url if no file field images
  const rawImageUrl = extractUrlFromMarkdown(row.image_url);
  const imageUrl = imageUrls.length > 0 ? undefined : (rawImageUrl || undefined);

  // Auto-detect Cathedral from notes if not already in style
  let style = row.style || "";
  const notes = (row.notes || "").toLowerCase();
  const name = (row.name || "").toLowerCase();
  const styleLower = style.toLowerCase();
  
  // Check if "cathedral" appears in notes or name but not in style
  if ((notes.includes("cathedral") || name.includes("cathedral")) && 
      !styleLower.includes("cathedral")) {
    // Add Cathedral as primary style
    style = style ? `Cathedral, ${style}` : "Cathedral";
  }

  // Parse comments from comment_1 through comment_6 fields
  const comments: Comment[] = [];
  const commentFields = [row.comment_1, row.comment_2, row.comment_3, row.comment_4, row.comment_5, row.comment_6];
  
  commentFields.forEach((commentHtml) => {
    if (commentHtml && commentHtml.trim()) {
      // Try to extract timestamp from data attributes using regex (works in Node.js)
      const timestampMatch = commentHtml.match(/data-timestamp="([^"]+)"/);
      const updatedMatch = commentHtml.match(/data-updated="([^"]+)"/);
      const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
      const updatedAt = updatedMatch ? updatedMatch[1] : undefined;
      
      // Extract the actual content (remove wrapper div if present)
      // Look for content wrapped in <div data-timestamp="...">...</div>
      // Use a more robust regex that handles nested tags
      const wrapperMatch = commentHtml.match(/<div[^>]*data-timestamp="[^"]*"[^>]*>([\s\S]*?)<\/div>$/);
      const content = wrapperMatch ? wrapperMatch[1] : commentHtml;
      
      comments.push({
        text: content.trim(),
        createdAt: timestamp,
        updatedAt: updatedAt || undefined,
      });
    }
  });

  return {
    id: `baserow-${row.id}`,
    name: row.name || "Unnamed Building",
    location,
    city: row.city,
    country: row.country,
    description: row.notes || "",
    style: style as any, // Convert string to ArchitecturalStyle enum
    coordinates: { lat, lng },
    gmapsUrl: row.Gmaps_url,
    googlePlaceId: row.google_place_id,
    imageUrl: imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    isPrioritized: !!isPrioritized,
    architect: row.architect || undefined,
    hasPurpleHeart: !!hasPurpleHeart,
    source: row.source || undefined,
    favourites: row.favourites || false,
    comments: comments.length > 0 ? comments : undefined,
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

    // Filter out hidden buildings
    const visibleRows = allRows.filter((row: any) => !row.is_hidden);
    return visibleRows.map(baserowRowToBuilding);
  } catch (error) {
    console.error("Error fetching from Baserow:", error);
    throw error;
  }
};

// Fetch all buildings from Baserow INCLUDING hidden ones (for duplicate checking)
// This is used internally to check for duplicates before saving
const fetchAllBuildingsIncludingHidden = async (limitPages?: number): Promise<Building[]> => {
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

    // Don't filter out hidden buildings - return all for duplicate checking
    return allRows.map(baserowRowToBuilding);
  } catch (error) {
    console.error("Error fetching from Baserow (including hidden):", error);
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
      // Filter out hidden buildings
      const visibleResults = data.results.filter((row: any) => !row.is_hidden);
      if (visibleResults.length > 0) {
        return baserowRowToBuilding(visibleResults[0]);
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching building by name:", error);
    throw error;
  }
};

// Save a building to Baserow
export const saveBuildingToBaserow = async (building: Building, imageFiles?: File[]): Promise<Building> => {
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

    // Upload files if provided
    const uploadedFiles: (BaserowFileField | null)[] = [null, null, null];
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < Math.min(imageFiles.length, 3); i++) {
        try {
          const uploadedFile = await uploadFileToBaserow(imageFiles[i]);
          uploadedFiles[i] = uploadedFile;
        } catch (error) {
          console.error(`Failed to upload image ${i + 1} for "${building.name}":`, error);
          // Continue with other images even if one fails
        }
      }
    }

    const payload: any = {
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
      is_purple_heart: building.hasPurpleHeart || false,
      source: building.source || "",
    };

    // Add file fields (Baserow expects array format for file fields)
    if (uploadedFiles[0]) payload.image_1 = [uploadedFiles[0]];
    if (uploadedFiles[1]) payload.image_2 = [uploadedFiles[1]];
    if (uploadedFiles[2]) payload.image_3 = [uploadedFiles[2]];

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
// IMPORTANT: This checks ALL buildings including hidden ones to prevent re-adding duplicates
export const findExistingBuilding = async (building: Building): Promise<{ exists: boolean; rowId?: number }> => {
  try {
    // Fetch ALL buildings including hidden ones for duplicate checking
    // This ensures we don't re-add buildings that were soft-deleted
    const allBuildings = await fetchAllBuildingsIncludingHidden();
    
    // Filter to nearby buildings (within 1km) for performance
    const nearby = allBuildings.filter((b) => {
      const distance = getDistance(b.coordinates, building.coordinates);
      return distance <= 1000; // 1km radius
    });
    
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
        const rowId = parseInt(rowIdMatch[1], 10);
        console.log(`⚠️ Building "${building.name}" already exists in Baserow (row ID: ${rowId}) - skipping save`);
        return { exists: true, rowId };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error("Error checking if building exists:", error);
    return { exists: false };
  }
};

// Hide (soft-delete) a building in Baserow
export const hideBuildingInBaserow = async (rowId: number): Promise<void> => {
  try {
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_hidden: true }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Error hiding building in Baserow:", error);
    throw error;
  }
};

// Toggle favourites status for a building in Baserow
// Also keeps is_prioritized in sync with favourites (favourites imply prioritized)
export const toggleFavouriteInBaserow = async (rowId: number, isFavourite: boolean): Promise<void> => {
  try {
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          favourites: isFavourite,
          is_prioritized: isFavourite,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Error toggling favourite in Baserow:", error);
    throw error;
  }
};

// Update an existing building in Baserow
export const updateBuildingInBaserow = async (rowId: number, building: Building, imageFiles?: File[]): Promise<Building> => {
  try {
    // Preserve existing comments when updating (don't overwrite them)
    // Fetch current row to get existing comments
    const currentResponse = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    const currentRow: BaserowRow = currentResponse.ok ? await currentResponse.json() : {} as BaserowRow;

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

    // Upload files if provided
    const uploadedFiles: (BaserowFileField | null)[] = [null, null, null];
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < Math.min(imageFiles.length, 3); i++) {
        try {
          const uploadedFile = await uploadFileToBaserow(imageFiles[i]);
          uploadedFiles[i] = uploadedFile;
        } catch (error) {
          console.error(`Failed to upload image ${i + 1} for "${building.name}":`, error);
          // Continue with other images even if one fails
        }
      }
    }

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
      // Preserve existing comments
      comment_1: currentRow.comment_1 || "",
      comment_2: currentRow.comment_2 || "",
      comment_3: currentRow.comment_3 || "",
      comment_4: currentRow.comment_4 || "",
      comment_5: currentRow.comment_5 || "",
      comment_6: currentRow.comment_6 || "",
      is_prioritized: building.isPrioritized || false,
      is_purple_heart: building.hasPurpleHeart || false,
      source: building.source || "",
    };

    // Add file fields if files were uploaded (Baserow expects array format for file fields)
    if (uploadedFiles[0]) basePayload.image_1 = [uploadedFiles[0]];
    if (uploadedFiles[1]) basePayload.image_2 = [uploadedFiles[1]];
    if (uploadedFiles[2]) basePayload.image_3 = [uploadedFiles[2]];

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

// Helper to extract base name (before parentheses or other separators)
const extractBaseName = (name: string): string => {
  // Remove content in parentheses, brackets, or after common separators
  const cleaned = name
    .replace(/\s*\([^)]*\)/g, '') // Remove parentheses content
    .replace(/\s*\[[^\]]*\]/g, '') // Remove bracket content
    .replace(/\s*-\s*[^-]*$/g, '') // Remove content after dash
    .trim();
  return normalizeNameForMatch(cleaned);
};

// Helper to check if names share a significant portion
const namesSharePortion = (name1: string, name2: string): boolean => {
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
const isSevenSisters = (building: Building): boolean => {
  const name = building.name.toLowerCase();
  const country = building.country?.toLowerCase() || '';
  const city = building.city?.toLowerCase() || '';
  
  // Check if it's in Russia and matches Seven Sisters pattern
  if (!country.includes('russia') && !country.includes('россия')) return false;
  
  // Seven Sisters are in Moscow
  if (!city.includes('moscow') && !city.includes('москва')) return false;
  
  // Check for Seven Sisters building names
  const sevenSistersKeywords = [
    'ministry', 'ministry of foreign affairs', 'hotel ukraina', 'hotel leningradskaya',
    'kotelnicheskaya', 'kudrinskaya', 'red gates', 'ministry of foreign affairs',
    'seven sisters', 'stalinist', 'высотка', 'сталинская'
  ];
  
  return sevenSistersKeywords.some(keyword => name.includes(keyword));
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

        // Skip if either building is a Seven Sisters building (exception)
        if (isSevenSisters(allBuildings[i]) || isSevenSisters(allBuildings[j])) {
          continue;
        }

        const distance = getDistance(allBuildings[i].coordinates, allBuildings[j].coordinates);
        
        // Check if within 10km and names share a portion
        if (distance < 10000) { // 10km
          // Check if names share a significant portion
          if (namesSharePortion(allBuildings[i].name, allBuildings[j].name)) {
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

// Helper function to format comment HTML with timestamp metadata
const formatCommentHtml = (text: string, createdAt: string, updatedAt?: string): string => {
  const updatedAttr = updatedAt ? ` data-updated="${updatedAt}"` : '';
  return `<div data-timestamp="${createdAt}"${updatedAttr}>${text}</div>`;
};

// Helper function to convert comments array to Baserow comment fields
const commentsToBaserowFields = (comments: Comment[]): Record<string, string> => {
  const fields: Record<string, string> = {};
  const fieldNames = ['comment_1', 'comment_2', 'comment_3', 'comment_4', 'comment_5', 'comment_6'];
  
  comments.forEach((comment, index) => {
    if (index < fieldNames.length) {
      fields[fieldNames[index]] = formatCommentHtml(comment.text, comment.createdAt, comment.updatedAt);
    }
  });
  
  // Clear remaining fields
  for (let i = comments.length; i < fieldNames.length; i++) {
    fields[fieldNames[i]] = '';
  }
  
  return fields;
};

// Add a comment to a building
export const addCommentToBuilding = async (rowId: number, commentText: string): Promise<Building> => {
  try {
    // Fetch current building to get existing comments
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API error: ${response.status} - ${errorText}`);
    }

    const row: BaserowRow = await response.json();
    
    // Parse existing comments
    const existingComments: Comment[] = [];
    const commentFields = [row.comment_1, row.comment_2, row.comment_3, row.comment_4, row.comment_5, row.comment_6];
    commentFields.forEach((commentHtml) => {
      if (commentHtml && commentHtml.trim()) {
        const timestampMatch = commentHtml.match(/data-timestamp="([^"]+)"/);
        const updatedMatch = commentHtml.match(/data-updated="([^"]+)"/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
        const updatedAt = updatedMatch ? updatedMatch[1] : undefined;
        const wrapperMatch = commentHtml.match(/<div[^>]*data-timestamp="[^"]*"[^>]*>([\s\S]*?)<\/div>$/);
        const content = wrapperMatch ? wrapperMatch[1] : commentHtml;
        existingComments.push({
          text: content.trim(),
          createdAt: timestamp,
          updatedAt: updatedAt || undefined,
        });
      }
    });

    // Add new comment
    const newComment: Comment = {
      text: commentText,
      createdAt: new Date().toISOString(),
    };
    const updatedComments = [...existingComments, newComment];

    // Convert to Baserow fields
    const commentFieldsUpdate = commentsToBaserowFields(updatedComments);

    // Update building with new comments
    const updateResponse = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commentFieldsUpdate),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Baserow API error: ${updateResponse.status} - ${errorText}`);
    }

    const updatedRow: BaserowRow = await updateResponse.json();
    return baserowRowToBuilding(updatedRow);
  } catch (error) {
    console.error("Error adding comment to building:", error);
    throw error;
  }
};

// Update a comment at a specific index
export const updateCommentInBuilding = async (rowId: number, commentIndex: number, commentText: string): Promise<Building> => {
  try {
    // Fetch current building
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API error: ${response.status} - ${errorText}`);
    }

    const row: BaserowRow = await response.json();
    
    // Parse existing comments
    const existingComments: Comment[] = [];
    const commentFields = [row.comment_1, row.comment_2, row.comment_3, row.comment_4, row.comment_5, row.comment_6];
    commentFields.forEach((commentHtml) => {
      if (commentHtml && commentHtml.trim()) {
        const timestampMatch = commentHtml.match(/data-timestamp="([^"]+)"/);
        const updatedMatch = commentHtml.match(/data-updated="([^"]+)"/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
        const updatedAt = updatedMatch ? updatedMatch[1] : undefined;
        const wrapperMatch = commentHtml.match(/<div[^>]*data-timestamp="[^"]*"[^>]*>([\s\S]*?)<\/div>$/);
        const content = wrapperMatch ? wrapperMatch[1] : commentHtml;
        existingComments.push({
          text: content.trim(),
          createdAt: timestamp,
          updatedAt: updatedAt || undefined,
        });
      }
    });

    // Update comment at index
    if (commentIndex >= 0 && commentIndex < existingComments.length) {
      existingComments[commentIndex] = {
        ...existingComments[commentIndex],
        text: commentText,
        updatedAt: new Date().toISOString(),
      };
    } else {
      throw new Error(`Invalid comment index: ${commentIndex}`);
    }

    // Convert to Baserow fields
    const commentFieldsUpdate = commentsToBaserowFields(existingComments);

    // Update building
    const updateResponse = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commentFieldsUpdate),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Baserow API error: ${updateResponse.status} - ${errorText}`);
    }

    const updatedRow: BaserowRow = await updateResponse.json();
    return baserowRowToBuilding(updatedRow);
  } catch (error) {
    console.error("Error updating comment:", error);
    throw error;
  }
};

// Delete a comment at a specific index
export const deleteCommentFromBuilding = async (rowId: number, commentIndex: number): Promise<Building> => {
  try {
    // Fetch current building
    const response = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Baserow API error: ${response.status} - ${errorText}`);
    }

    const row: BaserowRow = await response.json();
    
    // Parse existing comments
    const existingComments: Comment[] = [];
    const commentFields = [row.comment_1, row.comment_2, row.comment_3, row.comment_4, row.comment_5, row.comment_6];
    commentFields.forEach((commentHtml) => {
      if (commentHtml && commentHtml.trim()) {
        const timestampMatch = commentHtml.match(/data-timestamp="([^"]+)"/);
        const updatedMatch = commentHtml.match(/data-updated="([^"]+)"/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
        const updatedAt = updatedMatch ? updatedMatch[1] : undefined;
        const wrapperMatch = commentHtml.match(/<div[^>]*data-timestamp="[^"]*"[^>]*>([\s\S]*?)<\/div>$/);
        const content = wrapperMatch ? wrapperMatch[1] : commentHtml;
        existingComments.push({
          text: content.trim(),
          createdAt: timestamp,
          updatedAt: updatedAt || undefined,
        });
      }
    });

    // Remove comment at index
    if (commentIndex >= 0 && commentIndex < existingComments.length) {
      existingComments.splice(commentIndex, 1);
    } else {
      throw new Error(`Invalid comment index: ${commentIndex}`);
    }

    // Convert to Baserow fields
    const commentFieldsUpdate = commentsToBaserowFields(existingComments);

    // Update building
    const updateResponse = await fetch(
      `${BASEROW_API_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commentFieldsUpdate),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Baserow API error: ${updateResponse.status} - ${errorText}`);
    }

    const updatedRow: BaserowRow = await updateResponse.json();
    return baserowRowToBuilding(updatedRow);
  } catch (error) {
    console.error("Error deleting comment:", error);
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

