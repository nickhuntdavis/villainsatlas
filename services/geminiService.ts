import { GoogleGenAI } from "@google/genai";
import { Building, ArchitecturalStyle, Coordinates } from "../types";
import { saveBuildingToBaserow, findExistingBuilding } from "./baserowService";

// Helper to get API base URL (environment-aware for dev/production)
const getApiBaseUrl = (): string => {
  const env = (import.meta as any).env || {};
  // In production, use relative URL (Netlify redirects handle routing)
  if (env.PROD) {
    // Production: use relative URL - Netlify redirects will route to functions
    // Or use explicit URL if VITE_API_URL is set (for custom deployments)
    return env.VITE_API_URL || '';
  }
  // Development: use localhost with port (Express server)
  const apiPort = env.VITE_API_PORT || '3001';
  return `http://localhost:${apiPort}`;
};

// Helper to extract JSON array from potentially markdown-formatted text
const extractJson = (str: string): string => {
  // Finds the first '[' and the last ']'
  const firstOpen = str.indexOf('[');
  const lastClose = str.lastIndexOf(']');
  
  if (firstOpen !== -1 && lastClose !== -1 && firstOpen < lastClose) {
    return str.substring(firstOpen, lastClose + 1);
  }
  return "[]";
};

// Helper: polite delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Geocode a location name to coordinates using Gemini
export const geocodeLocation = async (locationName: string): Promise<Coordinates | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key is missing for geocoding");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What are the latitude and longitude coordinates for ${locationName}? Return only valid JSON: {"lat": number, "lng": number}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" }
          },
          required: ["lat", "lng"]
        }
      }
    });

    const jsonText = response.text || "{}";
    const data = JSON.parse(jsonText);
    
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      return { lat: data.lat, lng: data.lng };
    }
    
    return null;
  } catch (error: any) {
    console.error("Geocoding error:", error);
    // Check for rate limit / quota issues
    const msg = error?.message || String(error || "");
    const isRateLimit =
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("RESOURCE_EXHAUSTED");

    if (isRateLimit) {
      const rateLimitError: any = new Error("Gemini geocoding rate limit reached.");
      rateLimitError.isRateLimit = true;
      rateLimitError.isGeocodeLimit = true;
      throw rateLimitError;
    }

    // For other errors, just return null so the app can fall back to Baserow / Gemini search centering
    return null;
  }
};

export const fetchLairs = async (locationQuery: string, userLat?: number, userLng?: number): Promise<Building[]> => {
  if (!process.env.API_KEY) {
    console.error("API Key is missing");
    throw new Error("API Key is missing. Please check your configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are 'The Archivist', a curator for "The Villain's Atlas". 
    Your mission is to identify ONLY the most extreme, imposing, and architecturally menacing buildings in the world.
    
    QUALITY OVER QUANTITY: These buildings should be rare, exceptional examples. Most cities will have ZERO qualifying buildings. Only the most extreme examples qualify.
    
    CRITICAL SELECTION CRITERIA (IN PRIORITY ORDER):
    
    PRIORITY 1 - ART DECO MASTERPIECES:
    - FIRST, search for historically significant Art Deco buildings by well-known architects (e.g., Empire State Building, Chrysler Building, Rockefeller Center, Daily News Building, American Radiator Building).
    - These should be included even if they don't meet all other criteria (they can be slightly less "evil" if historically significant).
    - Mark these with "isPrioritized": true and include "architect" name if well-known.
    - Only if NO historically significant Art Deco buildings exist, proceed to Priority 2.
    
    PRIORITY 2 - OTHER QUALIFYING BUILDINGS:
    1. SIZE & SCALE: Buildings must be LARGE-SCALE, monumental structures. Think skyscrapers, massive government buildings, enormous brutalist complexes. Small buildings do NOT qualify.
    2. ARCHITECTURAL STYLES - Accept any of these or their common synonyms/variants:
       - Soviet/Communist: Stalinist Gothic, Soviet Modernism, Socialist Classicism, Soviet Brutalism
       - Brutalist: Brutalism, New Brutalism, Concrete Brutalism, Raw Concrete
       - Deco: Dark Deco, Art Deco, Streamlined Moderne, Gothic Deco
       - Gothic: Gothic Revival, Neo-Gothic, Victorian Gothic, Industrial Gothic
       - Other Menacing: Totalitarian, Fascist Architecture, Monumental, Fortress, Bunker, Cyberpunk, Dystopian
       - Use the most accurate style name, even if it's a variant or synonym. Style naming is subjective - choose what best describes the building.
    3. AESTHETIC: Must be genuinely SCARY, OMINOUS, or POWER-PROJECTING. Think buildings that look like supervillain headquarters, dystopian government facilities, or dark citadels.
    4. RARITY: These are exceptional, noteworthy buildings. If a city has 5-8 qualifying buildings, you're being too lenient. Most cities will have 0-3 at most.
    
    REJECT IF:
    - Building is small or medium-sized (only large-scale structures)
    - Building is "pretty", "quaint", or aesthetically pleasing
    - Building is modern glass/steel (unless it's a massive brutalist exception)
    - Building is residential (unless it's a massive housing complex with imposing architecture)
    - Building is common or unremarkable
    
    REFERENCE: Think r/evilbuildings on Reddit. The Polish Palace of Culture and Science is a PERFECT example.
    
    CRITICAL OUTPUT INSTRUCTIONS:
    1. You MUST return a VALID JSON array of objects.
    2. Do NOT include Markdown code blocks (like \`\`\`json).
    3. Do NOT include conversational text.
    4. Each object must contain:
       - "name" (string)
       - "location" (string, full address)
       - "city" (string, city name only)
       - "country" (string, country name only)
       - "description" (string, short, evocative, noir-style - emphasize the imposing/scary nature)
       - "style" (string - use any appropriate style name from: Stalinist Gothic, Soviet Modernism, Socialist Classicism, Brutalism, New Brutalism, Dark Deco, Art Deco, Gothic Revival, Neo-Gothic, Totalitarian, Fascist Architecture, Monumental, Fortress, Industrial Gothic, Cyberpunk, Dystopian, or any other accurate variant/synonym. Style naming is subjective - use what best describes the building.)
       - "isPrioritized" (boolean, optional - true for historically significant Art Deco buildings by famous architects)
       - "architect" (string, optional - name of architect if well-known, e.g., "William Van Alen", "Shreve, Lamb & Harmon")
       - "lat" (number, latitude)
       - "lng" (number, longitude)
       - "imageUrl" (string, optional - try to find a valid public URL for an image of the building)
  `;

  const prompt = `Find buildings in or near ${locationQuery}. 
  
  SEARCH PRIORITY:
  1. FIRST: Search for historically significant Art Deco buildings by well-known architects (e.g., Empire State Building, Chrysler Building, Rockefeller Center). Include these even if slightly less extreme - they are prioritized.
  2. THEN: If no Art Deco masterpieces found, search for other extreme, large-scale, imposing buildings.
  
  QUALITY STANDARD: These should be rare, exceptional examples. Most cities will have 0-3 qualifying buildings at most. If you find more than 5, you're being too lenient - only include the MOST extreme examples.
  
  REQUIREMENTS (for non-prioritized buildings):
  - Must be LARGE-SCALE, monumental structures (think skyscrapers, massive government buildings, enormous complexes)
  - Must be genuinely SCARY, OMINOUS, or POWER-PROJECTING
  - Architectural styles: Accept Soviet/Communist styles (Stalinist Gothic, Soviet Modernism, etc.), Brutalism variants, Deco variants (Dark Deco, Art Deco), Gothic variants, or other menacing styles (Totalitarian, Monumental, Fortress, Cyberpunk, Dystopian, etc.)
  - Use the most accurate style name - style naming is subjective, so use variants/synonyms as appropriate
  - Reference: Think r/evilbuildings - Polish Palace of Culture and Science level of imposing
  
  Ensure they are real places using Google Maps data. 
  CRITICAL: For each building, attempt to find a valid, publicly accessible image URL. Use Google Search to find high-quality images of these buildings. The imageUrl should be a direct link to an image file (ending in .jpg, .jpeg, .png, .gif, or .webp) or a publicly accessible image URL.
  Provide their exact coordinates.
  IMPORTANT: Include separate "city" and "country" fields for each building.`;

  // Helper: enrich a newly-found building with Google Places Details/Photos
  const mapsApiKey =
    (typeof import.meta !== "undefined" &&
      // Vite-style env exposure
      ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
        (import.meta as any).env?.GOOGLE_MAPS_API_KEY ||
        (import.meta as any).env?.REACT_APP_GOOGLE_MAPS_API_KEY)) ||
    // Fallback for possible Node or non-Vite environments
    (process.env.VITE_GOOGLE_MAPS_API_KEY ||
     process.env.GOOGLE_MAPS_API_KEY || 
     process.env.REACT_APP_GOOGLE_MAPS_API_KEY);

  // Helper to find place ID using Places API text search if not already set
  const findPlaceId = async (building: Building): Promise<string | undefined> => {
    try {
      // Use proxy endpoint to avoid CORS issues
      const searchQuery = `${building.name}, ${building.location || building.city || ''}`.trim();
      const apiBaseUrl = getApiBaseUrl();
      const proxyUrl = `${apiBaseUrl}/api/places/find?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id`;
      
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
          return data.candidates[0].place_id;
        }
      }
    } catch (err) {
      console.warn(`Error finding place ID for "${building.name}":`, err);
    }
    return undefined;
  };

  const enrichWithPlaces = async (building: Building): Promise<Building> => {
    if (!mapsApiKey) {
      return building;
    }

    // Try to find place ID if not already set
    const placeId = await findPlaceId(building);
    if (!placeId) {
      console.warn(`⚠️ No place ID found for "${building.name}" - skipping Places enrichment`);
      return building;
    }
    console.log(`🔍 Found place ID for "${building.name}": ${placeId}`);

    try {
      // Use proxy endpoint to avoid CORS issues
      const apiBaseUrl = getApiBaseUrl();
      const proxyUrl = `${apiBaseUrl}/api/places/details?place_id=${encodeURIComponent(
        placeId
      )}&fields=place_id,url,photos,types`;

      const res = await fetch(proxyUrl);
      if (!res.ok) {
        console.warn(
          `Places Details error for ${placeId}: ${res.status} ${res.statusText}`
        );
        // Still return building with the found place ID
        return { ...building, googlePlaceId: placeId };
      }

      const data = await res.json();
      if (data.status !== "OK" || !data.result) {
        console.warn(
          `Places Details non-OK for ${placeId}:`,
          data.status
        );
        // Still return building with the found place ID
        return { ...building, googlePlaceId: placeId };
      }

      const result = data.result;
      const updated: Building = { ...building };

      // Use canonical place_id if provided
      if (result.place_id) {
        updated.googlePlaceId = result.place_id;
      }

      // Prefer canonical Google Maps URL from Places
      if (result.url) {
        updated.gmapsUrl = result.url;
      }

      // Always prefer Google Places Photos over any other image source
      if (Array.isArray(result.photos) && result.photos.length > 0) {
        const photoRef = result.photos[0].photo_reference;
        if (photoRef) {
          updated.imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
            photoRef
          )}&key=${mapsApiKey}`;
          console.log(`✅ Set Google Places image for "${building.name}" (place_id: ${placeId})`);
        } else {
          console.warn(`⚠️ No photo_reference found in photos array for "${building.name}" (place_id: ${placeId})`);
        }
      } else {
        console.warn(`⚠️ No photos found in Places API result for "${building.name}" (place_id: ${placeId})`);
      }
      
      // Log if building still has no image after enrichment attempt
      if (!updated.imageUrl && placeId) {
        console.warn(`⚠️ Building "${building.name}" saved without image despite having place_id: ${placeId}. Will be enriched on next load.`);
      }

      return updated;
    } catch (err) {
      console.warn(
        `Error enriching building "${building.name}" with Google Places:`,
        err
      );
      return building;
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        // Google Maps and Google Search can be used together
        tools: [{ googleMaps: {}, googleSearch: {} }], 
        toolConfig: userLat && userLng ? {
            retrievalConfig: {
                latLng: {
                    latitude: userLat,
                    longitude: userLng
                }
            }
        } : undefined,
        // Note: responseMimeType and responseSchema are NOT supported when using googleMaps/googleSearch tools
      },
    });

    const jsonText = response.text || "[]";
    const cleanedJson = extractJson(jsonText);
    
    let parsedData;
    try {
        parsedData = JSON.parse(cleanedJson);
    } catch (e) {
        console.warn("JSON Parse Error on:", jsonText);
        // Fallback or empty array if parsing fails
        parsedData = [];
    }

    // Extract grounding chunks to find official map links, place IDs, and images
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Map the parsed JSON to our internal Building type
    const buildings: Building[] = parsedData.map((item: any, index: number) => {
        let mapUrl: string | undefined = undefined;
        let placeId: string | undefined = undefined;
        let finalLat = item.lat; // Default to Gemini's coordinates
        let finalLng = item.lng; // Default to Gemini's coordinates
        
        // Try to match specific grounding chunks if possible
        // Prioritize name matching, then coordinate matching
        let matchedMapsChunk: any = null;
        
        // First, try to find exact or close name match
        matchedMapsChunk = groundingChunks.find((chunk: any) => {
            if (!chunk.maps || !chunk.maps.title) return false;
            const chunkTitle = chunk.maps.title.toLowerCase();
            const itemName = item.name.toLowerCase();
            // Check if names match (either direction)
            return chunkTitle.includes(itemName) || itemName.includes(chunkTitle);
        });
        
        // If no name match, try coordinate matching (within ~500m for better accuracy)
        if (!matchedMapsChunk) {
            matchedMapsChunk = groundingChunks.find((chunk: any) => {
                if (!chunk.maps || !chunk.maps.lat || !chunk.maps.lng) return false;
                // Match coordinates within ~500m (0.0045 degrees ≈ 500m at equator)
                const latDiff = Math.abs(chunk.maps.lat - item.lat);
                const lngDiff = Math.abs(chunk.maps.lng - item.lng);
                return latDiff < 0.0045 && lngDiff < 0.0045;
            });
        }

        if (matchedMapsChunk && matchedMapsChunk.maps) {
            const mapsData = matchedMapsChunk.maps as any;
            
            // Only use coordinates from Google Maps chunk if we have a strong match (name match)
            // For coordinate-only matches, the coordinates might be less reliable
            const isNameMatch = matchedMapsChunk.maps.title && 
                               (item.name.toLowerCase().includes(matchedMapsChunk.maps.title.toLowerCase()) ||
                                matchedMapsChunk.maps.title.toLowerCase().includes(item.name.toLowerCase()));
            
            if (isNameMatch && mapsData.lat && mapsData.lng) {
                // Only trust coordinates if we matched by name
                finalLat = mapsData.lat;
                finalLng = mapsData.lng;
            }
            // Otherwise, keep Gemini's coordinates as they might be more accurate for the described location
            
            if (mapsData.uri) {
                mapUrl = mapsData.uri;
            }
            
            // Extract place ID - prioritize direct placeId field
            if (mapsData.placeId || mapsData.place_id) {
                placeId = mapsData.placeId || mapsData.place_id;
            } else if (mapUrl) {
                // Try to extract place ID from Google Maps URL
                // Handle both place_id= and place/ formats
                const placeIdMatch = mapUrl.match(/(?:place_id=|place\/)([^&\/?]+)/);
                if (placeIdMatch) {
                    placeId = placeIdMatch[1];
                }
            }
        }
        
        // Clean place ID - remove "places/" prefix if present
        if (placeId) {
            placeId = placeId.replace(/^places\//, '').trim();
        }

        // Construct Google Maps URL - ALWAYS prioritize place name search
        // This is more reliable than coordinates and works better globally
        let finalGmapsUrl: string | undefined = undefined;
        
        // Build search query from building name and location
        const searchQuery = item.location || `${item.name}, ${item.city || ''}, ${item.country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|\s*,$/g, '').trim();
        const encodedQuery = encodeURIComponent(searchQuery);
        
        if (placeId) {
            // Best case: We have a place ID - use it with the name for best results
            const placeName = encodeURIComponent(item.name);
            finalGmapsUrl = `https://www.google.com/maps/search/?api=1&query=${placeName}&query_place_id=${placeId}`;
        } else if (mapUrl && (mapUrl.includes('place_id=') || mapUrl.includes('place/'))) {
            // Use the map URL if it already contains a place ID
            finalGmapsUrl = mapUrl;
        } else if (searchQuery) {
            // Primary method: Use place name + location search (most reliable)
            finalGmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
        } else if (mapUrl) {
            // Fallback to saved map URL if available
            finalGmapsUrl = mapUrl;
        } else {
            // Last resort: Use coordinates (only if we have no other option)
            finalGmapsUrl = `https://www.google.com/maps?q=${finalLat},${finalLng}`;
        }

        return {
            id: `bldg-${index}-${Date.now()}`,
            name: item.name,
            location: item.location || locationQuery,
            city: item.city || "",
            country: item.country || "",
            description: item.description,
            style: item.style as ArchitecturalStyle,
            coordinates: {
                lat: finalLat, // Use coordinates from Google Maps chunk if available
                lng: finalLng  // Use coordinates from Google Maps chunk if available
            },
            gmapsUrl: finalGmapsUrl,
            googlePlaceId: placeId,
            // imageUrl will be set later from Google Places Photos (never from web/Wikimedia)
            isPrioritized: item.isPrioritized === true,
            architect: item.architect || undefined
        };
    });

    // Enrich new buildings with Google Places details/photos (one call per building)
    const enrichedBuildings: Building[] = await Promise.all(
      buildings.map((b) => enrichWithPlaces(b))
    );
    // Be polite to the API in case of rapid subsequent calls
    await sleep(200);

    // Filter buildings by distance from search location (if coordinates provided)
    // Only include buildings within 50km of the search location
    let filteredBuildings = enrichedBuildings;
    if (userLat !== undefined && userLng !== undefined) {
      const searchLocation = { lat: userLat, lng: userLng };
      const maxDistance = 50000; // 50km in meters
      
      // Helper to calculate distance in meters (Haversine formula)
      const getDistance = (coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }) => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (coord1.lat * Math.PI) / 180;
        const φ2 = (coord2.lat * Math.PI) / 180;
        const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
        const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      
      filteredBuildings = enrichedBuildings.filter((b) => {
        const distance = getDistance(searchLocation, b.coordinates);
        return distance <= maxDistance;
      });
      
      if (filteredBuildings.length < enrichedBuildings.length) {
        console.log(`Filtered out ${enrichedBuildings.length - filteredBuildings.length} buildings outside 50km radius`);
      }
    }

    // Debug: Log building data for troubleshooting
    filteredBuildings.forEach((b, idx) => {
        console.log(`Building ${idx + 1} (${b.name}):`, {
            coordinates: b.coordinates,
            placeId: b.googlePlaceId || 'none',
            gmapsUrl: b.gmapsUrl || 'none',
            hasImage: !!b.imageUrl,
            location: b.location
        });
    });

    // Save new buildings to Baserow if they don't already exist (async, don't wait)
    // Use Promise.allSettled to handle all saves without blocking, but track results
    Promise.allSettled(
      filteredBuildings.map(async (building) => {
        try {
          const existing = await findExistingBuilding(building);
          if (!existing.exists) {
            // Create new entry only when there isn't already a Baserow row
            const savedBuilding = await saveBuildingToBaserow(building);
            console.log(`Saved "${building.name}" to Baserow with ID: ${savedBuilding.id}`);
            return savedBuilding;
          } else {
            console.log(`Skipped saving "${building.name}" – already exists in Baserow`);
            return null;
          }
        } catch (error) {
          console.warn(`Failed to save/update "${building.name}" in Baserow:`, error);
          // Don't throw - we still want to return the buildings even if save fails
          return null;
        }
      })
    ).then((results) => {
      // Log summary of save results
      const saved = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const skipped = results.filter(r => r.status === 'fulfilled' && r.value === null).length;
      console.log(`Baserow save summary: ${saved} saved, ${skipped} skipped, ${failed} failed`);
    });

    return filteredBuildings;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Check if it's a rate limit or quota error
    const errorMessage = error?.message || error?.toString() || '';
    const isRateLimit = errorMessage.includes('quota') || 
                       errorMessage.includes('rate limit') || 
                       errorMessage.includes('429') ||
                       errorMessage.includes('RESOURCE_EXHAUSTED') ||
                       errorMessage.includes('UNAVAILABLE') ||
                       errorMessage.toLowerCase().includes('model is overloaded') ||
                       error?.code === 503;
    
    if (isRateLimit) {
      const rateLimitError = new Error("Gemini API rate limit reached. Please try again later or use Baserow-only searches.");
      (rateLimitError as any).isRateLimit = true;
      (rateLimitError as any).isOverloaded = true;
      throw rateLimitError;
    }
    
    throw error;
  }
};

// Export function to fetch image for a building that has google_place_id but no imageUrl
export const fetchImageForBuilding = async (building: Building): Promise<Building> => {
  // Only fetch if building has place ID but no image
  if (!building.googlePlaceId) {
    console.warn(`⚠️ Building "${building.name}" has no googlePlaceId, skipping image fetch`);
    return building;
  }
  
  if (building.imageUrl) {
    console.log(`ℹ️ Building "${building.name}" already has imageUrl, skipping fetch`);
    return building;
  }

  const mapsApiKey =
    (typeof import.meta !== "undefined" &&
      ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
        (import.meta as any).env?.GOOGLE_MAPS_API_KEY ||
        (import.meta as any).env?.REACT_APP_GOOGLE_MAPS_API_KEY)) ||
    (process.env.VITE_GOOGLE_MAPS_API_KEY || 
     process.env.GOOGLE_MAPS_API_KEY || 
     process.env.REACT_APP_GOOGLE_MAPS_API_KEY);

  if (!mapsApiKey) {
    console.warn(`⚠️ No Google Maps API key found, cannot fetch image for "${building.name}"`);
    return building;
  }
  
  console.log(`🔍 Fetching Places details for "${building.name}" with place_id: ${building.googlePlaceId}`);

  // Check if API server is available (optional - don't block if it's not)
  // Only do health check in development
  const env = (import.meta as any).env || {};
  if (!env.PROD) {
    const apiBaseUrl = getApiBaseUrl();
    const healthCheckUrl = `${apiBaseUrl}/api/health`;
    
    try {
      const healthRes = await fetch(healthCheckUrl, { signal: AbortSignal.timeout(1000) });
      if (!healthRes.ok) {
        console.warn(`⚠️ API server health check failed. Skipping image fetch for "${building.name}"`);
        return building;
      }
    } catch (err) {
      // API server not running - silently skip image fetching
      console.debug(`API server not available, skipping image fetch for "${building.name}"`);
      return building;
    }
  }

  try {
    // Use proxy endpoint to avoid CORS issues
    const apiBaseUrl = getApiBaseUrl();
    const proxyUrl = `${apiBaseUrl}/api/places/details?place_id=${encodeURIComponent(
      building.googlePlaceId
    )}&fields=photos`;

    console.log(`🌐 Making Places API request via proxy for "${building.name}": ${proxyUrl}`);
    const res = await fetch(proxyUrl);
    console.log(`📡 Places API response status: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      console.warn(`⚠️ Places API HTTP error for "${building.name}" (place_id: ${building.googlePlaceId}): ${res.status} ${res.statusText}`);
      return building;
    }

    const data = await res.json();
    if (data.status !== "OK") {
      console.warn(`⚠️ Places API status error for "${building.name}" (place_id: ${building.googlePlaceId}): ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
      return building;
    }

    if (!data.result) {
      console.warn(`⚠️ Places API returned no result for "${building.name}" (place_id: ${building.googlePlaceId})`);
      return building;
    }

    const result = data.result;

    // Fetch image from Google Places Photos if available
    if (!Array.isArray(result.photos) || result.photos.length === 0) {
      console.warn(`⚠️ No photos array found for "${building.name}" (place_id: ${building.googlePlaceId})`);
      return building;
    }

    const photoRef = result.photos[0].photo_reference;
    if (!photoRef) {
      console.warn(`⚠️ No photo_reference in first photo for "${building.name}" (place_id: ${building.googlePlaceId})`);
      return building;
    }

    const imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(
      photoRef
    )}&key=${mapsApiKey}`;
    console.log(`✅ Fetched Google Places image for "${building.name}"`);
    return { ...building, imageUrl };
  } catch (err) {
    console.warn(`Error fetching image for "${building.name}":`, err);
    return building;
  }
};