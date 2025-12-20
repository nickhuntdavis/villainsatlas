import { Coordinates } from '../types';

// Cache for reverse geocoding results to avoid repeated API calls
const reverseGeocodeCache = new Map<string, string>();

/**
 * Reverse geocode coordinates to get a formatted address string
 * Uses Nominatim (OpenStreetMap) API - free, no API key required
 * @param coordinates - Latitude and longitude
 * @returns Formatted address string or null if geocoding fails
 */
export const reverseGeocode = async (coordinates: Coordinates): Promise<string | null> => {
  try {
    // Check cache first
    const cacheKey = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
    if (reverseGeocodeCache.has(cacheKey)) {
      return reverseGeocodeCache.get(cacheKey) || null;
    }

    // Use Nominatim reverse geocoding API
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EvilAtlas/1.0', // Nominatim requires a User-Agent
      },
    });

    if (!response.ok) {
      console.warn(`Reverse geocoding failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (!data || !data.address) {
      return null;
    }

    // Format address from Nominatim response
    const address = data.address;
    const parts: string[] = [];

    // Build address string from most specific to least specific
    if (address.road) parts.push(address.road);
    if (address.house_number) parts[0] = `${address.house_number} ${parts[0] || ''}`.trim();
    if (address.suburb || address.neighbourhood) parts.push(address.suburb || address.neighbourhood);
    if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
    if (address.state) parts.push(address.state);
    if (address.country) parts.push(address.country);

    const formattedAddress = parts.length > 0 ? parts.join(', ') : data.display_name || null;

    // Cache the result
    if (formattedAddress) {
      reverseGeocodeCache.set(cacheKey, formattedAddress);
    }

    return formattedAddress;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return null;
  }
};

