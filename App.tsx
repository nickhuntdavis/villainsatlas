import React, { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { Map as AtlasMap } from './components/Map';
import { SearchPanel } from './components/SearchPanel';
// Lazy load non-critical components for code splitting
const BuildingDetails = lazy(() => 
  import('./components/BuildingDetails').then(module => ({ default: module.BuildingDetails }))
);
const FallingHearts = lazy(() => 
  import('./components/FallingHearts').then(module => ({ default: module.FallingHearts }))
);
const POIConfirmationModal = lazy(() => 
  import('./components/POIConfirmationModal').then(module => ({ default: module.POIConfirmationModal }))
);
const DeleteBuildingModal = lazy(() => 
  import('./components/DeleteBuildingModal').then(module => ({ default: module.DeleteBuildingModal }))
);
const BuildingEditorModal = lazy(() => 
  import('./components/BuildingEditorModal').then(module => ({ default: module.BuildingEditorModal }))
);
import { AdminToggle } from './components/AdminToggle';
import { Building, Coordinates } from './types';
import { fetchLairs, geocodeLocation, fetchImageForBuilding, isPOIQuery, searchPOIByName, checkPOIStyleCriteria } from './services/geminiService';
import { fetchAllBuildings, fetchBuildingsNearLocation, fetchBuildingByName, updateBuildingInBaserow, dedupeBaserowBuildings, saveBuildingToBaserow, hideBuildingInBaserow } from './services/baserowService';
import { DEFAULT_COORDINATES, TARGET_NEAREST_SEARCH_RADIUS } from './constants';
import { AlertTriangle, Info, Heart, Scan, X } from 'lucide-react';
import { PrimaryButton } from './ui/atoms';
import { typography, getThemeColors, fontFamily } from './ui/theme';

function App() {
  const [center, setCenter] = useState<Coordinates>(DEFAULT_COORDINATES);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allBaserowBuildings, setAllBaserowBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstLoad, setFirstLoad] = useState(true);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching_baserow' | 'searching_gemini'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('evil-atlas-theme');
      // Default to 'dark' to match production. Reset 'light' to 'dark' if found.
      if (stored === 'light') {
        window.localStorage.setItem('evil-atlas-theme', 'dark');
        return 'dark';
      }
      if (stored === 'dark') return 'dark';
    }
    return 'dark';
  });
  const [showFallingHearts, setShowFallingHearts] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [poiConfirmationBuilding, setPOIConfirmationBuilding] = useState<Building | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [clickedCoordinates, setClickedCoordinates] = useState<Coordinates | null>(null);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [blacklistedBuildingIds, setBlacklistedBuildingIds] = useState<Set<number>>(() => {
    // Load blacklisted IDs from localStorage
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('evil-atlas-blacklisted-ids');
      if (stored) {
        try {
          const ids = JSON.parse(stored) as number[];
          return new Set(ids);
        } catch (e) {
          console.error('Failed to parse blacklisted IDs:', e);
        }
      }
    }
    return new Set<number>();
  });
  
  // Ref to store the map bounds getter function
  const getMapBoundsRef = useRef<(() => { north: number; south: number; east: number; west: number } | null) | null>(null);
  
  // Ref for dedupe button double-click detection
  const dedupeClickCountRef = useRef(0);
  const dedupeClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for backfill images button double-click detection
  const backfillClickCountRef = useRef(0);
  const backfillClickTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for force Gemini search button double-click detection
  const forceGeminiClickCountRef = useRef(0);
  const forceGeminiClickTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Store last search query for force Gemini
  const lastSearchQueryRef = useRef<string>('');

  // Persist theme and expose as data attribute for potential global styling
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('evil-atlas-theme', theme);
    }
  }, [theme]);

  // Keyboard handler for H key to toggle button visibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only toggle if not typing in an input/textarea
      if (e.key === 'h' || e.key === 'H') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          setButtonsVisible(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);


  // Helper to normalize names for fuzzy matching
  const normalizeName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  // Helper to calculate similarity between two normalized names (simple Levenshtein-like)
  const nameSimilarity = (name1: string, name2: string): number => {
    const norm1 = normalizeName(name1);
    const norm2 = normalizeName(name2);
    
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

  // Helper to check if two buildings are likely the same (fuzzy match)
  const areLikelySame = (b1: Building, b2: Building): boolean => {
    // Check name similarity
    const nameSim = nameSimilarity(b1.name, b2.name);
    if (nameSim < 0.6) return false; // Names too different
    
    // Check if coordinates are close (within 500m)
    const distance = getDistance(b1.coordinates, b2.coordinates);
    return distance < 500;
  };

  // Helper to score building quality (prefer ones with Google Place ID and images)
  const getBuildingScore = (b: Building): number => {
    let score = 0;
    if (b.googlePlaceId) score += 10;
    if (b.imageUrl) score += 5;
    if (b.gmapsUrl) score += 2;
    if (b.description) score += 1;
    return score;
  };

  // Merge helper to keep markers persistent without duplicates (with fuzzy matching)
  const mergeBuildings = (existing: Building[], incoming: Building[]): Building[] => {
    const byId = new Map<string, Building>();
    const processed = new Set<string>();
    
    // First, add all existing buildings
    existing.forEach((b) => {
      byId.set(b.id, b);
    });
    
    // Process incoming buildings
    incoming.forEach((incomingB) => {
      // Check for exact ID match first
      if (byId.has(incomingB.id)) {
        const existingB = byId.get(incomingB.id)!;
        // Prefer building with higher score (Google Place ID, images, etc.)
        if (getBuildingScore(incomingB) > getBuildingScore(existingB)) {
          byId.set(incomingB.id, { ...existingB, ...incomingB });
        } else {
          // Merge properties, keeping existing building as base
          byId.set(incomingB.id, { ...incomingB, ...existingB });
        }
        processed.add(incomingB.id);
        return;
      }
      
      // Check for fuzzy match with existing buildings
      let fuzzyMatch: Building | null = null;
      let bestScore = 0;
      
      for (const [id, existingB] of byId.entries()) {
        if (areLikelySame(existingB, incomingB)) {
          const incomingScore = getBuildingScore(incomingB);
          const existingScore = getBuildingScore(existingB);
          
          // Prefer the building with higher score
          if (incomingScore > existingScore || (incomingScore === existingScore && !processed.has(id))) {
            fuzzyMatch = existingB;
            bestScore = Math.max(incomingScore, existingScore);
          }
        }
      }
      
      if (fuzzyMatch) {
        // Merge into the existing building, preferring higher-scored properties
        const existingB = fuzzyMatch;
        const incomingScore = getBuildingScore(incomingB);
        const existingScore = getBuildingScore(existingB);
        
        if (incomingScore >= existingScore) {
          byId.set(existingB.id, { ...existingB, ...incomingB });
        } else {
          // Keep existing but merge in any missing properties
          byId.set(existingB.id, { ...incomingB, ...existingB });
        }
        processed.add(existingB.id);
      } else {
        // New building, add it
        byId.set(incomingB.id, incomingB);
      }
    });
    
    return Array.from(byId.values());
  };

  // Helper to filter out blacklisted buildings
  const filterBlacklistedBuildings = useCallback((buildings: Building[]): Building[] => {
    return buildings.filter((b) => {
      const rowIdMatch = b.id.match(/^baserow-(\d+)$/);
      if (rowIdMatch) {
        const rowId = parseInt(rowIdMatch[1], 10);
        return !blacklistedBuildingIds.has(rowId);
      }
      return true; // Keep non-Baserow buildings
    });
  }, [blacklistedBuildingIds]);

  // Helper to get nearby Baserow buildings, preferring in-memory cache
  const getBaserowBuildingsNear = useCallback(
    async (center: Coordinates, radiusMeters: number) => {
      let results: Building[] = [];
      
      if (allBaserowBuildings.length > 0) {
        // Filter by distance and validate coordinates
        results = allBaserowBuildings.filter((b) => {
          // Skip buildings with invalid coordinates
          if (!b.coordinates || 
              isNaN(b.coordinates.lat) || 
              isNaN(b.coordinates.lng) ||
              b.coordinates.lat === 0 && b.coordinates.lng === 0) {
            return false;
          }
          const distance = getDistance(center, b.coordinates);
          return distance <= radiusMeters;
        });
        
        // If no results found in cache, fetch from API for this area
        if (results.length === 0) {
          console.log(`No buildings in cache for this area, fetching from API...`);
          const fresh = await fetchBuildingsNearLocation(center, radiusMeters);
          if (fresh.length > 0) {
            // Add to cache
            setAllBaserowBuildings((prev) => mergeBuildings(prev, fresh));
            results = fresh;
          }
        }
      } else {
        // Cache is empty, fetch from API
        const fresh = await fetchBuildingsNearLocation(center, radiusMeters);
        if (fresh.length > 0) {
          setAllBaserowBuildings((prev) => mergeBuildings(prev, fresh));
        }
        results = fresh;
      }
      
      // Filter out blacklisted buildings
      results = filterBlacklistedBuildings(results);
      
      // Enrich buildings with images if they have google_place_id but no imageUrl
      // Only do this for a reasonable number of buildings to avoid API limits (limit to first 20)
      const buildingsNeedingImages = results.filter(b => b.googlePlaceId && !b.imageUrl).slice(0, 20);
      if (buildingsNeedingImages.length > 0) {
        const enrichedBuildings = await Promise.all(
          buildingsNeedingImages.map(b => fetchImageForBuilding(b))
        );
        
        // Update results with enriched versions
        const enrichedMap = new Map(enrichedBuildings.map(b => [b.id, b]));
        results = results.map(b => enrichedMap.get(b.id) || b);
        
        // Update cache with enriched buildings
        if (allBaserowBuildings.length > 0) {
          setAllBaserowBuildings((prev) => {
            const updated = new Map(prev.map(b => [b.id, b]));
            enrichedBuildings.forEach(b => updated.set(b.id, b));
            return Array.from(updated.values());
          });
        }
      }
      
      return results;
    },
    [allBaserowBuildings, filterBlacklistedBuildings]
  );

  // Clear status message shortly after search completes
  useEffect(() => {
    if (!loading && searchStatus === 'idle' && statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 1000); // Show briefly then clear
      return () => clearTimeout(timer);
    }
  }, [loading, searchStatus, statusMessage]);

  // Register service worker for Baserow API caching (production only)
  useEffect(() => {
    if ('serviceWorker' in navigator && (import.meta as any).env?.PROD) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.warn('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Initial load of all Baserow buildings for caching and display on map
  useEffect(() => {
    const loadInitialBaserow = async () => {
      try {
        // Phase 1: Load only first page (200 buildings) for immediate render
        // This prevents blocking initial render with multiple API calls
        const initialBuildings = await fetchAllBuildings(1); // Limit to first page only
        // Filter out buildings with invalid coordinates
        const validInitialBuildings = initialBuildings.filter((b) => 
          b.coordinates && 
          !isNaN(b.coordinates.lat) && 
          !isNaN(b.coordinates.lng) &&
          !(b.coordinates.lat === 0 && b.coordinates.lng === 0)
        );
        
        // Set initial buildings immediately for fast first render
        setAllBaserowBuildings(validInitialBuildings);
        
        // Display buildings within initial map view (50km radius from default center)
        const initialRadius = 50000; // 50km
        let buildingsInView = validInitialBuildings.filter((b) => {
          // Filter by distance
          const withinRadius = getDistance(DEFAULT_COORDINATES, b.coordinates) <= initialRadius;
          if (!withinRadius) return false;
          
          // Filter out blacklisted buildings
          const rowIdMatch = b.id.match(/^baserow-(\d+)$/);
          if (rowIdMatch) {
            const rowId = parseInt(rowIdMatch[1], 10);
            return !blacklistedBuildingIds.has(rowId);
          }
          return true;
        });
        
        // Phase 2: Load remaining pages in background after initial render
        // Use requestIdleCallback or setTimeout to defer non-critical loading
        const loadRemainingBuildings = async () => {
          try {
            const allBuildings = await fetchAllBuildings(); // Fetch all pages
            const validAllBuildings = allBuildings.filter((b) => 
              b.coordinates && 
              !isNaN(b.coordinates.lat) && 
              !isNaN(b.coordinates.lng) &&
              !(b.coordinates.lat === 0 && b.coordinates.lng === 0)
            );
            // Update with complete dataset
            setAllBaserowBuildings(validAllBuildings);
            
            // Update buildings in view if any new ones are in viewport
            const updatedBuildingsInView = validAllBuildings.filter((b) => {
              const withinRadius = getDistance(DEFAULT_COORDINATES, b.coordinates) <= initialRadius;
              if (!withinRadius) return false;
              
              const rowIdMatch = b.id.match(/^baserow-(\d+)$/);
              if (rowIdMatch) {
                const rowId = parseInt(rowIdMatch[1], 10);
                return !blacklistedBuildingIds.has(rowId);
              }
              return true;
            });
            
            // Only update if we found new buildings in view
            if (updatedBuildingsInView.length > buildingsInView.length) {
              setBuildings(updatedBuildingsInView);
            }
          } catch (err) {
            console.error("Error loading remaining Baserow buildings:", err);
          }
        };
        
        // Defer remaining building loads using requestIdleCallback or setTimeout
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            setTimeout(loadRemainingBuildings, 100); // Small delay to ensure initial render completes
          }, { timeout: 2000 });
        } else {
          setTimeout(loadRemainingBuildings, 500); // Fallback for browsers without requestIdleCallback
        }
        
        // Enrich buildings with images if they have google_place_id but no imageUrl
        // Do this in batches to avoid overwhelming the API (limit to first 20)
        const buildingsNeedingImages = buildingsInView.filter(b => b.googlePlaceId && !b.imageUrl).slice(0, 20);
        if (buildingsNeedingImages.length > 0) {
          console.log(`🖼️ Fetching images for ${buildingsNeedingImages.length} buildings with place IDs...`);
          const enrichedBuildings = await Promise.all(
            buildingsNeedingImages.map(b => fetchImageForBuilding(b))
          );
          
          // Save enriched images back to Baserow for permanent storage
          for (const enrichedBuilding of enrichedBuildings) {
            if (enrichedBuilding.imageUrl) {
              const originalBuilding = buildingsNeedingImages.find(b => b.id === enrichedBuilding.id);
              if (originalBuilding && !originalBuilding.imageUrl) {
                // Extract row ID from building.id (format: "baserow-{id}")
                const rowIdMatch = enrichedBuilding.id.match(/^baserow-(\d+)$/);
                if (rowIdMatch) {
                  const rowId = parseInt(rowIdMatch[1], 10);
                  try {
                    await updateBuildingInBaserow(rowId, enrichedBuilding);
                    console.log(`💾 Saved image URL to Baserow for "${enrichedBuilding.name}"`);
                  } catch (err) {
                    console.warn(`Failed to save image URL to Baserow for "${enrichedBuilding.name}":`, err);
                  }
                }
              }
            }
          }
          
          // Update buildingsInView with enriched versions
          const enrichedMap = new Map(enrichedBuildings.map(b => [b.id, b]));
          buildingsInView = buildingsInView.map(b => enrichedMap.get(b.id) || b);
          
          // Update cache with enriched buildings
          setAllBaserowBuildings((prev) => {
            const updated = new Map(prev.map(b => [b.id, b]));
            enrichedBuildings.forEach(b => updated.set(b.id, b));
            return Array.from(updated.values());
          });
        }
        
        setBuildings(buildingsInView);
      } catch (err) {
        console.error("Error loading initial Baserow buildings:", err);
      }
    };
    loadInitialBaserow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blacklistedBuildingIds]);

  // Helper to calculate distance in meters
  const getDistance = (coord1: Coordinates, coord2: Coordinates) => {
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

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    // If permission was previously denied, try again
    if (locationPermissionDenied) {
      setLocationPermissionDenied(false);
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newCenter = { lat: latitude, lng: longitude };
        setCenter(newCenter);
        setUserLocation(newCenter);
        
         try {
           // First, try Baserow
           setSearchStatus('searching_baserow');
           let baserowResults = await getBaserowBuildingsNear(newCenter, 50000); // 50km radius
           console.log(`Found ${baserowResults.length} buildings in Baserow`);
           
           let geminiResults: Building[] = [];
           let geminiNewCount = 0;
           let geminiWasCalled = false;
           let statusMsg: string | null = null;
           
           // Only try Gemini if we have LESS THAN 5 Baserow results
           if (baserowResults.length < 5) {
             try {
               setSearchStatus('searching_gemini');
               geminiWasCalled = true;
               geminiResults = await fetchLairs("Current Location", latitude, longitude);
               // Count only new buildings (not already in baserowResults)
               const baserowIds = new Set(baserowResults.map(b => b.id));
               geminiNewCount = geminiResults.filter(b => !baserowIds.has(b.id)).length;
               console.log(`Added ${geminiNewCount} new buildings from Gemini`);
             } catch (geminiErr: any) {
               // Check if it's a rate limit error
               const isGeminiRateLimit = geminiErr?.isRateLimit || 
                                        geminiErr?.message?.includes('rate limit') || 
                                        geminiErr?.message?.includes('quota');
               
               if (isGeminiRateLimit) {
                 console.warn("Gemini API rate limit reached, using Baserow results only");
               } else {
                 console.warn("Gemini search failed, using Baserow results only:", geminiErr);
               }
             }
           }
           
           // Enrich Gemini results with images if they have place IDs but no imageUrl
           // This ensures images are fetched even if enrichWithPlaces didn't work initially
           const geminiResultsNeedingImages = geminiResults.filter(b => b.googlePlaceId && !b.imageUrl);
           if (geminiResultsNeedingImages.length > 0) {
             console.log(`🖼️ Enriching ${geminiResultsNeedingImages.length} Gemini results with images...`);
             const enrichedGeminiResults = await Promise.all(
               geminiResultsNeedingImages.map(b => fetchImageForBuilding(b))
             );
             
             // Save enriched images back to Baserow for buildings that already exist in Baserow
             for (const enrichedBuilding of enrichedGeminiResults) {
               if (enrichedBuilding.imageUrl) {
                 const originalBuilding = geminiResultsNeedingImages.find(b => b.id === enrichedBuilding.id);
                 if (originalBuilding && !originalBuilding.imageUrl) {
                   // Only save if building already exists in Baserow (has baserow-{id} format)
                   const rowIdMatch = enrichedBuilding.id.match(/^baserow-(\d+)$/);
                   if (rowIdMatch) {
                     const rowId = parseInt(rowIdMatch[1], 10);
                     try {
                       await updateBuildingInBaserow(rowId, enrichedBuilding);
                       console.log(`💾 Saved image URL to Baserow for "${enrichedBuilding.name}"`);
                     } catch (err) {
                       console.warn(`Failed to save image URL to Baserow for "${enrichedBuilding.name}":`, err);
                     }
                   }
                 }
               }
             }
             
             // Update geminiResults with enriched versions
             const enrichedMap = new Map(enrichedGeminiResults.map(b => [b.id, b]));
             geminiResults = geminiResults.map(b => enrichedMap.get(b.id) || b);
           }
           
           // Merge results
           const results = mergeBuildings(baserowResults, geminiResults);
           
           // Set status messages
           if (baserowResults.length >= 5) {
             statusMsg = `${baserowResults.length} sexy buildings found in database`;
           } else if (baserowResults.length > 0) {
             statusMsg = `Only ${baserowResults.length} sexy buildings found in database, expanding search`;
             if (geminiWasCalled) {
               if (geminiNewCount > 0) {
                 statusMsg += `. ${geminiNewCount} new buildings found and added to database`;
               } else {
                 statusMsg = `Only ${baserowResults.length} sexy buildings found in database. There aren't any other buildings sexy enough in this area`;
               }
             }
           }
           
           // Sort results: prioritized buildings first
           const sortedResults = results.sort((a, b) => {
             if (a.isPrioritized && !b.isPrioritized) return -1;
             if (!a.isPrioritized && b.isPrioritized) return 1;
             return 0;
           });
           
           setBuildings((prev) => filterBlacklistedBuildings(mergeBuildings(prev, sortedResults)));
           if (statusMsg) {
             setStatusMessage(statusMsg);
           }
         } catch (err: any) {
           if (err?.isRateLimit || err?.message?.includes('rate limit') || err?.message?.includes('quota')) {
             setError("Too many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
           } else {
           setError("Systems failed to identify structures in this sector.");
           }
         } finally {
           setLoading(false);
           setSearchStatus('idle');
           setFirstLoad(false);
         }
       },
       (error) => {
         // User denied location permission or location unavailable
         setLocationPermissionDenied(true);
         setError("Location access denied. Please enable location services to use this feature.");
         setLoading(false);
         setSearchStatus('idle');
       }
     );
   }, [locationPermissionDenied]);

  // Helper function to find nearest building from a list
  const findNearestBuilding = useCallback((location: Coordinates, buildingsList: Building[]) => {
    let nearest: Building | null = null;
    let minDistance = Infinity;

    // Filter out "Nick" - it's a person entry, not a building
    const buildingsOnly = buildingsList.filter((b) => b.name !== "Nick");

    if (buildingsOnly.length === 0) {
      setError("No buildings available. Only person entries found.");
      return;
    }

    buildingsOnly.forEach((b) => {
        const dist = getDistance(location, b.coordinates);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = b;
        }
      });

      if (nearest) {
        setSelectedBuilding(nearest);
      setCenter(nearest.coordinates);
    }
  }, []);

  // Helper function to search and then find nearest
  const searchAndFindNearest = useCallback(async (location: Coordinates) => {
    setLoading(true);
    setError(null);
    setSelectedBuilding(null);

    try {
      // First, try Baserow within the configured Nearest radius
      setSearchStatus('searching_baserow');
      let results = await getBaserowBuildingsNear(location, TARGET_NEAREST_SEARCH_RADIUS);
      console.log(`Found ${results.length} buildings in Baserow within nearest search radius`);

      // Sort results: prioritized buildings first
      const sortedResults = results.sort((a, b) => {
        if (a.isPrioritized && !b.isPrioritized) return -1;
        if (!a.isPrioritized && b.isPrioritized) return 1;
        return 0;
      });
      
      setBuildings((prev) => mergeBuildings(prev, sortedResults));
      
      if (sortedResults.length > 0) {
        setCenter(location);
        // Automatically find nearest from the loaded results
        findNearestBuilding(location, sortedResults);
      } else {
        // Cheeky error message when no results within the (large) nearest radius
        setError("No ominous structures detected within 100km. Perhaps relocate to a more architecturally menacing location?");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.isRateLimit || err?.message?.includes('rate limit') || err?.message?.includes('quota')) {
        setError("SYSTEM ALERT\nToo many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
      } else {
        setError("Systems failed to identify structures in this sector.");
      }
    } finally {
      setLoading(false);
      setSearchStatus('idle');
      setFirstLoad(false);
    }
  }, [findNearestBuilding]);

  const handleFindNearest = useCallback(async () => {
    // If permission was previously denied, try again
    if (locationPermissionDenied) {
      setLocationPermissionDenied(false);
    }

    // Determine reference location first
    let referenceLocation: Coordinates;

    // If no buildings exist, automatically perform a search
    if (buildings.length === 0) {
      // Determine reference location
      if (userLocation) {
        referenceLocation = userLocation;
        await searchAndFindNearest(referenceLocation);
        return;
      } else if (navigator.geolocation) {
        // Try to get current position
        return new Promise<void>((resolve) => {
          setLoading(true);
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
              setUserLocation(coords);
              setLocationPermissionDenied(false);
              await searchAndFindNearest(coords);
              resolve();
            },
            async (error) => {
              // Geolocation failed - user denied or unavailable
              setLocationPermissionDenied(true);
              setError("Location access denied. Please enable location services to find the nearest building.");
              setLoading(false);
              resolve();
            }
          );
        });
      } else {
        // No geolocation available, use map center
        await searchAndFindNearest(center);
        return;
      }
    }

    // If buildings already exist, just find nearest
    const performFind = (location: Coordinates) => {
      findNearestBuilding(location, buildings);
    };

    if (userLocation) {
      performFind(userLocation);
    } else {
      // If no user location, try to get it, or default to map center
      if (navigator.geolocation) {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserLocation(coords);
            setLocationPermissionDenied(false);
            performFind(coords);
            setLoading(false);
          },
          (error) => {
             // Geolocation failed - user denied or unavailable
             setLocationPermissionDenied(true);
             setError("Location access denied. Please enable location services to find the nearest building.");
             setLoading(false);
          }
        );
      } else {
         performFind(center);
      }
    }
  }, [buildings, userLocation, center, searchAndFindNearest, findNearestBuilding, locationPermissionDenied]);

  const handleSearch = async (query: string) => {
    // Store the query for force Gemini button
    lastSearchQueryRef.current = query;
    
    setLoading(true);
    setError(null);
    setSelectedBuilding(null);
    setStatusMessage(null);
    
    let rateLimitError = false;
    let geocodedCoords: Coordinates | null = null;
    let statusMessage: string | null = null;
    
    try {
      // Check if this is a POI-specific search
      if (isPOIQuery(query)) {
        console.log(`🔍 Detected POI query: "${query}"`);
        setSearchStatus('searching_gemini');
        
        // Search for the POI using Google Places
        const poiBuilding = await searchPOIByName(query);
        
        if (!poiBuilding) {
          setLoading(false);
          setError(`Could not find "${query}"`);
          return;
        }
        
        // Check if it matches style criteria
        const styleCheck = await checkPOIStyleCriteria(poiBuilding);
        
        if (styleCheck.matches && styleCheck.building) {
          // Matches criteria - add it automatically
          const enrichedBuilding = styleCheck.building;
          
                // Check if it already exists in Baserow
                const existing = await fetchBuildingByName(enrichedBuilding.name);
                if (existing) {
                  // Already exists - just show it
                  setBuildings((prev) => mergeBuildings(prev, [existing]));
            setCenter(enrichedBuilding.coordinates);
            setLoading(false);
            setStatusMessage(`Found "${enrichedBuilding.name}" in database`);
            return;
          }
          
          // Save to Baserow
          try {
            const savedBuilding = await saveBuildingToBaserow(enrichedBuilding);
            console.log(`✅ Saved POI "${savedBuilding.name}" to Baserow`);
            
            // Add to map
            setBuildings((prev) => mergeBuildings(prev, [savedBuilding]));
            setCenter(savedBuilding.coordinates);
            setLoading(false);
            setStatusMessage(`Added "${savedBuilding.name}" to database`);
          } catch (saveErr) {
            console.error(`Failed to save POI "${enrichedBuilding.name}":`, saveErr);
            setError(`Found "${enrichedBuilding.name}" but failed to save`);
            setLoading(false);
          }
        } else {
          // Doesn't match criteria - show confirmation modal
          setPOIConfirmationBuilding(poiBuilding);
          setLoading(false);
        }
        return;
      }
      
      // First, geocode the location to get coordinates (using Nominatim - free, no API limits)
      geocodedCoords = await geocodeLocation(query);
      
      if (geocodedCoords) {
        // Move map to geocoded location
        setCenter(geocodedCoords);
        // Wait a bit for map to move (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Now perform building search
      setSearchStatus('searching_baserow');
      // First try Baserow
      let baserowResults: Building[] = [];
      
      if (geocodedCoords) {
        baserowResults = await getBaserowBuildingsNear(geocodedCoords, 50000); // 50km radius
        console.log(`Found ${baserowResults.length} buildings in Baserow`);
      }
      
      let geminiResults: Building[] = [];
      let geminiNewCount = 0;
      let geminiWasCalled = false;
      
      // Only try Gemini if we have LESS THAN 5 Baserow results
      if (geocodedCoords && baserowResults.length < 5) {
        try {
          setSearchStatus('searching_gemini');
          geminiWasCalled = true;
          geminiResults = await fetchLairs(query, geocodedCoords.lat, geocodedCoords.lng);
          // Count only new buildings (not already in baserowResults)
          const baserowIds = new Set(baserowResults.map(b => b.id));
          geminiNewCount = geminiResults.filter(b => !baserowIds.has(b.id)).length;
          console.log(`Added ${geminiNewCount} new buildings from Gemini`);
        } catch (geminiErr: any) {
          // Check if it's a rate limit error
          const isGeminiRateLimit = geminiErr?.isRateLimit || 
                                   geminiErr?.message?.includes('rate limit') || 
                                   geminiErr?.message?.includes('quota');
          
          if (isGeminiRateLimit) {
            rateLimitError = true;
            // Don't throw - we still want to show Baserow results and move the map
            console.warn("Gemini API rate limit reached, but continuing with available data");
          } else {
            // Don't throw - continue with Baserow results
            console.warn("Gemini search failed, using Baserow results only:", geminiErr);
          }
        }
      }
      
      // Enrich Gemini results with images if they have place IDs but no imageUrl
      const geminiResultsNeedingImages = geminiResults.filter(b => b.googlePlaceId && !b.imageUrl);
      if (geminiResultsNeedingImages.length > 0) {
        console.log(`🖼️ Enriching ${geminiResultsNeedingImages.length} Gemini results with images...`);
        const enrichedGeminiResults = await Promise.all(
          geminiResultsNeedingImages.map(b => fetchImageForBuilding(b))
        );
        
        // Save enriched images back to Baserow for buildings that already exist in Baserow
        for (const enrichedBuilding of enrichedGeminiResults) {
          if (enrichedBuilding.imageUrl) {
            const originalBuilding = geminiResultsNeedingImages.find(b => b.id === enrichedBuilding.id);
            if (originalBuilding && !originalBuilding.imageUrl) {
              // Only save if building already exists in Baserow (has baserow-{id} format)
              const rowIdMatch = enrichedBuilding.id.match(/^baserow-(\d+)$/);
              if (rowIdMatch) {
                const rowId = parseInt(rowIdMatch[1], 10);
                try {
                  await updateBuildingInBaserow(rowId, enrichedBuilding);
                  console.log(`💾 Saved image URL to Baserow for "${enrichedBuilding.name}"`);
                } catch (err) {
                  console.warn(`Failed to save image URL to Baserow for "${enrichedBuilding.name}":`, err);
                }
              }
            }
          }
        }
        
        // Update geminiResults with enriched versions
        const enrichedMap = new Map(enrichedGeminiResults.map(b => [b.id, b]));
        geminiResults = geminiResults.map(b => enrichedMap.get(b.id) || b);
      }
      
      // Merge results
      const results = mergeBuildings(baserowResults, geminiResults);
      
      // Set status messages based on results
      if (baserowResults.length >= 5) {
        statusMessage = `${baserowResults.length} sexy buildings found in database`;
      } else if (baserowResults.length > 0) {
        statusMessage = `Only ${baserowResults.length} sexy buildings found in database, expanding search`;
        if (geminiWasCalled) {
          if (geminiNewCount > 0) {
            statusMessage += `. ${geminiNewCount} new buildings found and added to database`;
          } else {
            statusMessage = `Only ${baserowResults.length} sexy buildings found in database. There aren't any other buildings sexy enough in this area`;
          }
        }
      }
      
      // Sort results: prioritized buildings first
      const sortedResults = results.sort((a, b) => {
        if (a.isPrioritized && !b.isPrioritized) return -1;
        if (!a.isPrioritized && b.isPrioritized) return 1;
        return 0;
      });
      
      setBuildings((prev) => mergeBuildings(prev, sortedResults));
      
      // Don't move map again - it's already at geocodedCoords
      // Show rate limit message if applicable
      if (rateLimitError) {
        setError("Too many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
      } else if (sortedResults.length === 0) {
        setError("No ominous structures detected in this sector.");
      }
      
      // Set status message
      if (statusMessage) {
        setStatusMessage(statusMessage);
      }
    } catch (err: any) {
       console.error(err);
       
       // Check if it's a rate limit error
       if (err?.isRateLimit || err?.message?.includes('rate limit') || err?.message?.includes('quota')) {
         // Only show error if we haven't already moved the map and shown results
         // If geocoding failed but we have results, don't show error here (it's already shown above)
         if (!rateLimitError) {
           setError("Too many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
         }
       } else if (err?.message?.includes('API Key')) {
         setError("API configuration error. Please check your Gemini API key.");
       } else {
       setError("Connection to AN Atlas Archives failed.");
       }
    } finally {
      setLoading(false);
      setSearchStatus('idle');
      setFirstLoad(false);
    }
  };

  // Handler for searching the visible map area
  const handleSearchArea = useCallback(async () => {
    if (!getMapBoundsRef.current) {
      setError("Map bounds not available. Please wait for map to load.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedBuilding(null);
    setStatusMessage(null);

    try {
      const bounds = getMapBoundsRef.current();
      if (!bounds) {
        setError("Unable to determine map bounds.");
        setLoading(false);
        return;
      }

      // Calculate center point from bounds
      const centerLat = (bounds.north + bounds.south) / 2;
      const centerLng = (bounds.east + bounds.west) / 2;
      const center = { lat: centerLat, lng: centerLng };

      // Calculate radius: distance from center to northeast corner
      const northeastCorner = { lat: bounds.north, lng: bounds.east };
      // Expand radius so edge buildings (and slightly beyond) are included
      const radius = getDistance(center, northeastCorner) * 1.5;

       // First, try Baserow
       setSearchStatus('searching_baserow');
       let baserowResults = await getBaserowBuildingsNear(center, radius);
       console.log(`Found ${baserowResults.length} buildings in Baserow for visible area`);
       
       let geminiResults: Building[] = [];
       let geminiNewCount = 0;
       let geminiWasCalled = false;
       let statusMsg: string | null = null;
       
       // Only try Gemini if we have LESS THAN 5 Baserow results
       if (baserowResults.length < 5) {
         try {
           setSearchStatus('searching_gemini');
           geminiWasCalled = true;
           // Construct a descriptive query for Gemini
           const areaDescription = `Visible map area centered at ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;
           geminiResults = await fetchLairs(areaDescription, centerLat, centerLng);
           // Count only new buildings (not already in baserowResults)
           const baserowIds = new Set(baserowResults.map(b => b.id));
           geminiNewCount = geminiResults.filter(b => !baserowIds.has(b.id)).length;
           console.log(`Added ${geminiNewCount} new buildings from Gemini`);
         } catch (geminiErr: any) {
           // Check if it's a rate limit error
           const isGeminiRateLimit = geminiErr?.isRateLimit || 
                                    geminiErr?.message?.includes('rate limit') || 
                                    geminiErr?.message?.includes('quota');
           
           if (isGeminiRateLimit) {
             console.warn("Gemini API rate limit reached, using Baserow results only");
           } else {
             console.warn("Gemini search failed, using Baserow results only:", geminiErr);
           }
         }
       }
       
       // Enrich Gemini results with images if they have place IDs but no imageUrl
       const geminiResultsNeedingImages = geminiResults.filter(b => b.googlePlaceId && !b.imageUrl);
       if (geminiResultsNeedingImages.length > 0) {
         console.log(`🖼️ Enriching ${geminiResultsNeedingImages.length} Gemini results with images...`);
         const enrichedGeminiResults = await Promise.all(
           geminiResultsNeedingImages.map(b => fetchImageForBuilding(b))
         );
         
         // Save enriched images back to Baserow for buildings that already exist in Baserow
         for (const enrichedBuilding of enrichedGeminiResults) {
           if (enrichedBuilding.imageUrl) {
             const originalBuilding = geminiResultsNeedingImages.find(b => b.id === enrichedBuilding.id);
             if (originalBuilding && !originalBuilding.imageUrl) {
               // Only save if building already exists in Baserow (has baserow-{id} format)
               const rowIdMatch = enrichedBuilding.id.match(/^baserow-(\d+)$/);
               if (rowIdMatch) {
                 const rowId = parseInt(rowIdMatch[1], 10);
                 try {
                   await updateBuildingInBaserow(rowId, enrichedBuilding);
                   console.log(`💾 Saved image URL to Baserow for "${enrichedBuilding.name}"`);
                 } catch (err) {
                   console.warn(`Failed to save image URL to Baserow for "${enrichedBuilding.name}":`, err);
                 }
               }
             }
           }
         }
         
         // Update geminiResults with enriched versions
         const enrichedMap = new Map(enrichedGeminiResults.map(b => [b.id, b]));
         geminiResults = geminiResults.map(b => enrichedMap.get(b.id) || b);
       }
       
       // Merge results
       const results = mergeBuildings(baserowResults, geminiResults);
       
       // Set status messages
       if (baserowResults.length >= 5) {
         statusMsg = `${baserowResults.length} sexy buildings found in database`;
       } else if (baserowResults.length > 0) {
         statusMsg = `Only ${baserowResults.length} sexy buildings found in database, expanding search`;
         if (geminiWasCalled) {
           if (geminiNewCount > 0) {
             statusMsg += `. ${geminiNewCount} new buildings found and added to database`;
           } else {
             statusMsg = `Only ${baserowResults.length} sexy buildings found in database. There aren't any other buildings sexy enough in this area`;
           }
         }
       }

      // Sort results: prioritized buildings first
      const sortedResults = results.sort((a, b) => {
        if (a.isPrioritized && !b.isPrioritized) return -1;
        if (!a.isPrioritized && b.isPrioritized) return 1;
        return 0;
      });
      
      setBuildings((prev) => mergeBuildings(prev, sortedResults));
      if (statusMsg) {
        setStatusMessage(statusMsg);
      }
      if (sortedResults.length > 0) {
        setCenter(center);
      } else {
        setError("No ominous structures detected in this sector.");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.isRateLimit || err?.message?.includes('rate limit') || err?.message?.includes('quota')) {
        setError("SYSTEM ALERT\nToo many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
      } else {
        setError("Systems failed to identify structures in this sector.");
      }
    } finally {
      setLoading(false);
      setSearchStatus('idle');
      setFirstLoad(false);
    }
  }, []);

  // Callback to receive map bounds getter function
  const handleBoundsRequest = useCallback((getBounds: () => { north: number; south: number; east: number; west: number } | null) => {
    getMapBoundsRef.current = getBounds;
  }, []);

  // The "N" button handler - fetches "Nick" from Baserow
  const handleNButton = useCallback(async () => {
    // Trigger falling hearts animation
    setShowFallingHearts(true);
    
    setLoading(true);
    setError(null);
    setSelectedBuilding(null);
    
    try {
      const nickEntry = await fetchBuildingByName("Nick");
      if (nickEntry) {
        setBuildings([nickEntry]);
        setCenter(nickEntry.coordinates);
        setSelectedBuilding(nickEntry);
        console.log("Found Nick:", nickEntry);
      } else {
        setError("Target 'Nick' not found in database.");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.isRateLimit || err?.message?.includes('rate limit') || err?.message?.includes('quota')) {
        setError("SYSTEM ALERT\nToo many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
      } else {
        setError("Failed to retrieve target.");
      }
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, []);

  const handleSelectBuilding = (b: Building) => {
    // Don't show building details if admin mode is enabled (edit modal will be shown instead)
    if (!adminModeEnabled) {
      setSelectedBuilding(b);
    }
  };

  const handleCloseDetails = () => {
    setSelectedBuilding(null);
  };

  // Admin mode handlers
  const handleMapClick = useCallback((coordinates: Coordinates) => {
    if (adminModeEnabled) {
      setClickedCoordinates(coordinates);
      setEditingBuilding(null);
      setShowEditorModal(true);
    }
  }, [adminModeEnabled]);

  const handleEditBuilding = useCallback((building: Building) => {
    if (adminModeEnabled) {
      setEditingBuilding(building);
      setClickedCoordinates(null);
      setShowEditorModal(true);
    }
  }, [adminModeEnabled]);

  const handleSaveBuilding = useCallback(async (buildingData: Building, imageFiles?: File[]) => {
    try {
      setLoading(true);
      
      if (editingBuilding) {
        // Update existing building
        const rowIdMatch = editingBuilding.id.match(/^baserow-(\d+)$/);
        if (!rowIdMatch) {
          throw new Error('Cannot update non-Baserow building');
        }
        
        const rowId = parseInt(rowIdMatch[1], 10);
        const updatedBuilding = await updateBuildingInBaserow(rowId, buildingData, imageFiles);
        
        // Update local state
        setBuildings(prev => prev.map(b => b.id === editingBuilding.id ? updatedBuilding : b));
        setAllBaserowBuildings(prev => prev.map(b => b.id === editingBuilding.id ? updatedBuilding : b));
        
        setStatusMessage(`Updated "${updatedBuilding.name}"`);
        console.log(`✅ Updated building "${updatedBuilding.name}" in Baserow`);
      } else {
        // Create new building
        const savedBuilding = await saveBuildingToBaserow(buildingData, imageFiles);
        
        // Add to local state
        setBuildings(prev => mergeBuildings(prev, [savedBuilding]));
        setAllBaserowBuildings(prev => mergeBuildings(prev, [savedBuilding]));
        
        // Move map to new building
        setCenter(savedBuilding.coordinates);
        
        setStatusMessage(`Added "${savedBuilding.name}" to database`);
        console.log(`✅ Added building "${savedBuilding.name}" to Baserow`);
      }
      
      setShowEditorModal(false);
      setEditingBuilding(null);
      setClickedCoordinates(null);
    } catch (error) {
      console.error('Failed to save building:', error);
      throw error;
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }, [editingBuilding]);

  // Handler for Nick triple-click - show falling hearts
  const handleNickTripleClick = useCallback(() => {
    setShowFallingHearts(true);
  }, []);

  // Handler for dedupe button double-click
  const handleDedupeButtonClick = useCallback(async () => {
    dedupeClickCountRef.current += 1;
    
    // Clear existing timer
    if (dedupeClickTimerRef.current) {
      clearTimeout(dedupeClickTimerRef.current);
    }
    
    // If we've reached 2 clicks, trigger dedupe
    if (dedupeClickCountRef.current >= 2) {
      dedupeClickCountRef.current = 0;
      
      try {
        setLoading(true);
        setStatusMessage("Running dedupe...");
        console.log("🔍 Starting dedupe process...");
        
        const deletedIds = await dedupeBaserowBuildings();
        
        if (deletedIds.length > 0) {
          // Add deleted IDs to blacklist
          setBlacklistedBuildingIds((prev) => {
            const updated = new Set(prev);
            deletedIds.forEach(id => updated.add(id));
            
            // Save to localStorage
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('evil-atlas-blacklisted-ids', JSON.stringify(Array.from(updated)));
            }
            
            return updated;
          });
          
          // Filter out blacklisted buildings from current view
          setBuildings((prev) => filterBlacklistedBuildings(prev));
          setAllBaserowBuildings((prev) => filterBlacklistedBuildings(prev));
          
          setStatusMessage(`Dedupe complete! Removed ${deletedIds.length} duplicates.`);
          console.log(`✅ Dedupe complete. Blacklisted ${deletedIds.length} IDs.`);
        } else {
          setStatusMessage("No duplicates found.");
        }
      } catch (error: any) {
        console.error("Dedupe error:", error);
        setError(`Dedupe failed: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } else {
      // Reset counter after 1 second if no more clicks
      dedupeClickTimerRef.current = setTimeout(() => {
        dedupeClickCountRef.current = 0;
      }, 1000);
    }
  }, [filterBlacklistedBuildings]);

  // Handler for force Gemini search button double-click - bypasses 5 building limit
  const handleForceGeminiSearchClick = useCallback(async () => {
    forceGeminiClickCountRef.current += 1;
    
    // Clear existing timer
    if (forceGeminiClickTimerRef.current) {
      clearTimeout(forceGeminiClickTimerRef.current);
    }
    
    // If we've reached 2 clicks, trigger force Gemini search
    if (forceGeminiClickCountRef.current >= 2) {
      forceGeminiClickCountRef.current = 0;
      
      try {
        setLoading(true);
        setError(null);
        setSelectedBuilding(null);
        setStatusMessage("Force searching with Gemini...");
        
        // Use last search query or current map center
        const query = lastSearchQueryRef.current || "buildings";
        
        // Get current map center
        const currentCenter = center;
        
        if (!currentCenter) {
          setError("Unable to determine map location.");
          setLoading(false);
          return;
        }
        
        setSearchStatus('searching_gemini');
        console.log(`🔍 Force Gemini search for "${query}" at ${currentCenter.lat}, ${currentCenter.lng}`);
        
        // Call Gemini directly, bypassing the 5 building check
        const geminiResults = await fetchLairs(query, currentCenter.lat, currentCenter.lng);
        
        if (geminiResults.length > 0) {
          // Enrich with images
          const geminiResultsNeedingImages = geminiResults.filter(b => b.googlePlaceId && !b.imageUrl);
          if (geminiResultsNeedingImages.length > 0) {
            console.log(`🖼️ Enriching ${geminiResultsNeedingImages.length} Gemini results with images...`);
            const enrichedGeminiResults = await Promise.all(
              geminiResultsNeedingImages.map(b => fetchImageForBuilding(b))
            );
            
            // Update results with enriched images
            const enrichedMap = new Map(enrichedGeminiResults.map(b => [b.id, b]));
            geminiResults.forEach((b, idx) => {
              const enriched = enrichedMap.get(b.id);
              if (enriched) {
                geminiResults[idx] = enriched;
              }
            });
          }
          
          // Merge with existing buildings
          const mergedBuildings = mergeBuildings(buildings, geminiResults);
          setBuildings(mergedBuildings);
          setAllBaserowBuildings(prev => mergeBuildings(prev, geminiResults));
          
          setStatusMessage(`Found ${geminiResults.length} buildings via Gemini`);
          console.log(`✅ Force Gemini search complete: ${geminiResults.length} buildings found`);
        } else {
          setStatusMessage("No buildings found via Gemini.");
        }
      } catch (err: any) {
        console.error("Error in force Gemini search:", err);
        const isRateLimit = err?.isRateLimit || 
                           err?.message?.includes('rate limit') || 
                           err?.message?.includes('quota');
        
        if (isRateLimit) {
          setError("SYSTEM ALERT\nToo many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
        } else {
          setError(`Force Gemini search failed: ${err?.message || 'Unknown error'}`);
        }
      } finally {
        setLoading(false);
        setSearchStatus('idle');
      }
    } else {
      // Reset counter after 1 second if no more clicks
      forceGeminiClickTimerRef.current = setTimeout(() => {
        forceGeminiClickCountRef.current = 0;
      }, 1000);
    }
  }, [center, buildings]);

  // Handler for backfill images button double-click
  const handleBackfillImagesButtonClick = useCallback(async () => {
    backfillClickCountRef.current += 1;
    
    // Clear existing timer
    if (backfillClickTimerRef.current) {
      clearTimeout(backfillClickTimerRef.current);
    }
    
    // If we've reached 2 clicks, trigger backfill
    if (backfillClickCountRef.current >= 2) {
      backfillClickCountRef.current = 0;
      
      try {
        if (!getMapBoundsRef.current) {
          setError("Map bounds not available. Please wait for map to load.");
          return;
        }

        const bounds = getMapBoundsRef.current();
        if (!bounds) {
          setError("Unable to determine map bounds.");
          return;
        }

        setLoading(true);
        setStatusMessage("Backfilling images...");
        console.log("🖼️ Starting image backfill for visible area...");
        
        // Get all buildings currently in view (from allBaserowBuildings)
        const buildingsInView = allBaserowBuildings.filter((building) => {
          if (!building.coordinates) return false;
          
          // Check if building is within bounds
          const lat = building.coordinates.lat;
          const lng = building.coordinates.lng;
          
          return lat >= bounds.south && 
                 lat <= bounds.north && 
                 lng >= bounds.west && 
                 lng <= bounds.east;
        });

        // Filter to buildings that have googlePlaceId but no imageUrl
        const buildingsNeedingImages = buildingsInView.filter(
          (b) => b.googlePlaceId && !b.imageUrl
        );

        if (buildingsNeedingImages.length === 0) {
          setStatusMessage("No buildings need image backfill in this area.");
          setLoading(false);
          setTimeout(() => setStatusMessage(null), 3000);
          return;
        }

        console.log(`Found ${buildingsNeedingImages.length} buildings needing images`);

        // Fetch images for each building and update Baserow
        let successCount = 0;
        let failCount = 0;
        const enrichedBuildingsMap = new Map<string, Building>();

        for (const building of buildingsNeedingImages) {
          try {
            console.log(`🔍 Attempting to fetch image for "${building.name}" (place_id: ${building.googlePlaceId || 'MISSING'})`);
            const enrichedBuilding = await fetchImageForBuilding(building);
            
            // If we got an image, update it in Baserow
            if (enrichedBuilding.imageUrl && enrichedBuilding.imageUrl !== building.imageUrl) {
              // Extract row ID from building ID (format: "baserow-{rowId}")
              const rowIdMatch = building.id.match(/^baserow-(\d+)$/);
              if (rowIdMatch) {
                const rowId = parseInt(rowIdMatch[1], 10);
                await updateBuildingInBaserow(rowId, enrichedBuilding);
                successCount++;
                enrichedBuildingsMap.set(building.id, enrichedBuilding);
                console.log(`✅ Backfilled image for "${building.name}"`);
              } else {
                console.warn(`⚠️ Could not extract row ID from building ID: ${building.id}`);
                failCount++;
              }
            } else {
              console.log(`ℹ️ No image available for "${building.name}"`);
              failCount++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error: any) {
            console.error(`Error backfilling image for "${building.name}":`, error);
            failCount++;
          }
        }

        // Update local state with enriched buildings
        if (successCount > 0 && enrichedBuildingsMap.size > 0) {
          setAllBaserowBuildings((prev) => {
            const updated = new Map(prev.map(b => [b.id, b]));
            enrichedBuildingsMap.forEach((enriched, id) => {
              updated.set(id, enriched);
            });
            return Array.from(updated.values());
          });

          // Also update buildings in current view
          setBuildings((prev) => {
            const updated = new Map(prev.map(b => [b.id, b]));
            enrichedBuildingsMap.forEach((enriched, id) => {
              updated.set(id, enriched);
            });
            return Array.from(updated.values());
          });
        }

        setStatusMessage(`Backfill complete! ${successCount} images added, ${failCount} skipped.`);
        console.log(`✅ Backfill complete. ${successCount} images added, ${failCount} skipped.`);
      } catch (error: any) {
        console.error("Backfill error:", error);
        setError(`Backfill failed: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
        setTimeout(() => setStatusMessage(null), 5000);
      }
    } else {
      // Reset counter after 1 second if no more clicks
      backfillClickTimerRef.current = setTimeout(() => {
        backfillClickCountRef.current = 0;
      }, 1000);
    }
  }, [allBaserowBuildings]);

  const colors = getThemeColors(theme);
  
  return (
    <>
      <style>{`
        /* Hide Leaflet attribution */
        .leaflet-control-attribution {
          display: none !important;
        }
        .dedupe-button {
          bottom: calc(1rem + 16px) !important;
        }
        @media (min-width: 768px) {
          .dedupe-button {
            bottom: calc(1.5rem + 16px) !important;
          }
        }
        .backfill-button {
          bottom: calc(1rem + 16px) !important;
          right: calc(1rem + 12px + 4px + 12px + 4px) !important; /* dedupe button width (12px) + gap (4px) + force gemini button width (12px) + gap (4px) */
        }
        @media (min-width: 768px) {
          .backfill-button {
            bottom: calc(1.5rem + 16px) !important;
            right: calc(1.5rem + 12px + 4px + 12px + 4px) !important; /* dedupe button width (12px) + gap (4px) + force gemini button width (12px) + gap (4px) */
          }
        }
        .force-gemini-button {
          bottom: calc(1rem + 16px) !important;
          right: calc(1rem + 12px + 4px) !important; /* dedupe button width (12px) + gap (4px) */
        }
        @media (min-width: 768px) {
          .force-gemini-button {
            bottom: calc(1.5rem + 16px) !important;
            right: calc(1.5rem + 12px + 4px) !important; /* dedupe button width (12px) + gap (4px) */
          }
        }
        .admin-toggle-button {
          bottom: calc(1rem + 16px) !important;
          right: calc(1rem + 12px + 4px + 12px + 4px + 12px + 4px) !important; /* force gemini (12px) + gap (4px) + backfill (12px) + gap (4px) + dedupe (12px) + gap (4px) */
        }
        @media (min-width: 768px) {
          .admin-toggle-button {
            bottom: calc(1.5rem + 16px) !important;
            right: calc(1.5rem + 12px + 4px + 12px + 4px + 12px + 4px) !important; /* force gemini (12px) + gap (4px) + backfill (12px) + gap (4px) + dedupe (12px) + gap (4px) */
          }
        }
      `}</style>
      <div className={`relative w-screen h-[100dvh] overflow-hidden flex flex-col ${colors.background.default}`} role="application" aria-label="AN Atlas - Architecture finder">
      
      {/* Search Bar - Floating */}
      <SearchPanel 
        onSearch={handleSearch} 
        onLocateMe={handleLocateMe}
        onFindNearest={handleFindNearest}
        onSearchArea={handleSearchArea}
        isLoading={loading}
        searchStatus={searchStatus}
        statusMessage={statusMessage}
        theme={theme}
        isSidebarOpen={!!selectedBuilding}
        locationPermissionDenied={locationPermissionDenied}
      />

      {/* Map Layer */}
      <main className="flex-1 relative z-0" aria-label="Map view">
        <AtlasMap 
          center={center}
          buildings={buildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleSelectBuilding}
          onBoundsRequest={handleBoundsRequest}
          theme={theme}
          onNickTripleClick={handleNickTripleClick}
          adminModeEnabled={adminModeEnabled}
          onMapClick={handleMapClick}
          onEditBuilding={handleEditBuilding}
        />
        {/* Map color overlay - only in dark mode */}
        {theme === 'dark' && (
          <>
            <div 
              className="absolute inset-0 pointer-events-none z-10"
              style={{ 
                backgroundColor: '#030919',
                mixBlendMode: 'exclusion'
              }}
            />
            <div 
              className="absolute inset-0 pointer-events-none z-10"
              style={{ 
                backgroundColor: '#010E36',
                opacity: 0.25
              }}
            />
          </>
        )}
      </main>

      {/* Detail Panel - Sliding Drawer */}
      {selectedBuilding && (
        <Suspense fallback={null}>
          <BuildingDetails 
            building={selectedBuilding} 
            onClose={handleCloseDetails} 
            theme={theme}
            userLocation={userLocation}
            onDelete={() => {
              if (selectedBuilding) {
                setBuildingToDelete(selectedBuilding);
              }
            }}
          />
        </Suspense>
      )}

      {/* The "N" Button - Bottom Left */}
      <button
        onClick={handleNButton}
        className="absolute bottom-4 md:bottom-6 left-4 md:left-6 z-10 w-14 h-14 transition-all flex items-center justify-center group hover:scale-105"
        title="The Architect"
        aria-label="The Architect"
      >
        <Heart size={20} className="group-hover:scale-110 transition-all fill-current" style={{ color: '#FF5D88' }} aria-hidden="true" />
      </button>


      {/* Intro / Empty State Overlay */}
      {firstLoad && !loading && (
        <>
          <style>{`
            @media (max-width: 530px) {
              .modal-title-line1 { font-size: 60px !important; }
              .modal-title-A { font-size: 72px !important; }
              .modal-title-isfor { font-size: 18px !important; margin-left: -8px !important; }
              .modal-title-line2 { font-size: 60px !important; }
              .modal-palace-img { display: none !important; }
            }
          `}</style>
          <div className="absolute inset-0 bg-[#010E36]/80 z-30 flex items-center justify-center p-8 overflow-visible">
            <div className="max-w-lg w-auto bg-[#282C55] shadow-xl relative rounded-[32px] overflow-visible" style={{ padding: '48px' }}>
               {/* Close button - top right */}
               <button
                 onClick={() => setFirstLoad(false)}
                 className="absolute top-4 right-4 p-2 text-[#BAB2CF] hover:text-[#FDFEFF] transition-colors opacity-60 hover:opacity-100"
                 aria-label="Close modal"
                 title="Close"
               >
                 <X size={18} strokeWidth={2} aria-hidden="true" />
               </button>
               
               <div className="absolute right-12 top-[6.2rem] max-[530px]:hidden">
                 <img 
                   src="/images/palace.svg" 
                   alt="Palace" 
                   className="w-auto modal-palace-img" 
                   style={{ height: 'calc(64px + 64px + 0.1em)' }} 
                 />
               </div>
               <h1 className={`${fontFamily.heading} text-[#FDFEFF] mb-8 pt-2 pb-2 max-[530px]:mb-6`} style={{ lineHeight: '0.9' }}>
                 <div className="modal-title-line1" style={{ fontSize: '7vw' }}>
                   <span className="modal-title-AN font-bold" style={{ fontSize: '7vw' }}>AN</span>
                 </div>
                 <div className="modal-title-line2" style={{ fontSize: '7vw' }}>Atlas</div>
               </h1>
             
             <div className={`space-y-4 ${typography.body.default} text-[#FDFEFF] mb-10 max-[530px]:mb-8`}>
               <p style={{ fontWeight: 'bold' }}>Mediocre buildings need not apply.</p>
               <p>This radar scans for the best of Art Deco, Brutalism, and Stalinist Gothic. Follow the deep red markers to find the ominous and the powerful.</p>
             </div>

             <button
               onClick={handleLocateMe}
               className="w-full bg-[#AA8BFF] text-[#010E36] flex items-center justify-center group px-6 py-4 rounded-lg font-bold transition-all hover:opacity-90"
               aria-label="Initialize scan to find buildings"
             >
                <Scan className="mr-2" size={18} strokeWidth={2.5} aria-hidden="true"/>
                Initialize Scan
             </button>
          </div>
          
          {/* Tracking status - below modal, side by side */}
          <div className="absolute top-[calc(50%+280px)] left-1/2 transform -translate-x-1/2 flex items-center gap-8 z-30 max-[530px]:flex-col max-[530px]:gap-4 max-[530px]:w-full max-[530px]:px-4 max-[530px]:bottom-20 max-[530px]:top-auto max-[530px]:left-1/2 max-[530px]:transform max-[530px]:-translate-x-1/2 max-[530px]:justify-center">
            <div className={`flex items-center gap-2 ${typography.body.sm} text-[#BAB2CF] max-[530px]:w-full max-[530px]:justify-center`}>
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></div>
              <span>Architecture tracking active</span>
            </div>
            <div className={`flex items-center gap-2 ${typography.body.sm} text-[#BAB2CF] max-[530px]:w-full max-[530px]:justify-center`}>
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></div>
              <span>Nick tracking active</span>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Error Toast */}
      {error && (
        <div className={`absolute bottom-4 md:bottom-6 right-4 md:right-6 z-50 max-w-sm ${colors.background.surface} ${colors.border.default} ${colors.text.secondary} p-6 shadow-lg border rounded-lg flex items-start`}>
          <AlertTriangle className={`shrink-0 mr-3 ${colors.accent.primary}`} size={20} />
          <div className="flex-1">
            <h4 className={`${typography.label.button} ${colors.text.primary} mb-2`}>System Alert</h4>
            <p className={typography.body.sm}>{error}</p>
          </div>
          <button onClick={() => setError(null)} className={`ml-4 ${colors.text.muted} hover:opacity-80`} aria-label="Close error message"><Info size={16} aria-hidden="true"/></button>
        </div>
      )}

      {/* Footer text - always visible at bottom center */}
      <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center">
        <p className={`${typography.body.sm} text-[#BAB2CF]`}>Anastasiia's Atlas with love from Nick</p>
      </div>

      {/* Subtle force Gemini search button - bottom right (left of backfill) */}
      {buttonsVisible && (
        <button
          onClick={handleForceGeminiSearchClick}
          className="absolute z-10 cursor-pointer transition-opacity hover:opacity-20 force-gemini-button"
          style={{ 
            width: '12px', 
            height: '12px', 
            opacity: 0.08
          }}
          aria-label="Force Gemini search (double-click)"
          title="Double-click to force Gemini search (bypasses 5 building limit)"
        >
          <div className="w-full h-full bg-white rounded-sm" />
        </button>
      )}

      {/* Subtle backfill images button - bottom right (left of dedupe) */}
      {buttonsVisible && (
        <button
          onClick={handleBackfillImagesButtonClick}
          className="absolute z-10 cursor-pointer transition-opacity hover:opacity-20 backfill-button"
          style={{ 
            width: '12px', 
            height: '12px', 
            opacity: 0.08
          }}
          aria-label="Backfill images (double-click)"
          title="Double-click to backfill images"
        >
          <div className="w-full h-full bg-white rounded-sm" />
        </button>
      )}

      {/* Subtle dedupe button - bottom right */}
      {buttonsVisible && (
        <button
          onClick={handleDedupeButtonClick}
          className="absolute right-4 md:right-6 z-10 cursor-pointer transition-opacity hover:opacity-20 dedupe-button"
          style={{ 
            width: '12px', 
            height: '12px', 
            opacity: 0.05
          }}
          aria-label="Dedupe buildings (double-click)"
          title="Double-click to dedupe"
        >
          <div className="w-full h-full bg-white rounded-sm" />
        </button>
      )}

      {/* Falling hearts animation */}
      {showFallingHearts && (
        <Suspense fallback={null}>
          <FallingHearts onComplete={() => setShowFallingHearts(false)} />
        </Suspense>
      )}

      {/* POI Confirmation Modal */}
      {poiConfirmationBuilding && (
        <Suspense fallback={null}>
          <POIConfirmationModal
            building={poiConfirmationBuilding}
            theme={theme}
            onConfirm={async () => {
              const building = poiConfirmationBuilding;
              setPOIConfirmationBuilding(null);
              setLoading(true);
              
              try {
                // Check if it already exists
                const existing = await fetchBuildingByName(building.name);
                if (existing) {
                  setBuildings((prev) => mergeBuildings(prev, [existing]));
                  setCenter(building.coordinates);
                  setLoading(false);
                  setStatusMessage(`Found "${building.name}" in database`);
                  return;
                }
                
                // Save to Baserow
                const savedBuilding = await saveBuildingToBaserow(building);
                console.log(`✅ Saved POI "${savedBuilding.name}" to Baserow`);
                
                // Add to map
                setBuildings((prev) => mergeBuildings(prev, [savedBuilding]));
                setCenter(savedBuilding.coordinates);
                setLoading(false);
                setStatusMessage(`Added "${savedBuilding.name}" to database`);
              } catch (err) {
                console.error(`Failed to save POI "${building.name}":`, err);
                setError(`Failed to save "${building.name}"`);
                setLoading(false);
              }
            }}
            onCancel={() => {
              setPOIConfirmationBuilding(null);
            }}
          />
        </Suspense>
      )}

      {/* Delete Building Modal */}
      {buildingToDelete && (
        <Suspense fallback={null}>
          <DeleteBuildingModal
            building={buildingToDelete}
            theme={theme}
            onConfirm={async () => {
              const building = buildingToDelete;
              setBuildingToDelete(null);
              
              // Extract Baserow row ID from building.id (format: "baserow-{id}")
              const rowIdMatch = building.id.match(/^baserow-(\d+)$/);
              if (!rowIdMatch) {
                console.error(`Cannot delete building "${building.name}": Invalid ID format`);
                setError(`Cannot delete building: Invalid ID format`);
                return;
              }
              
              const rowId = parseInt(rowIdMatch[1], 10);
              
              try {
                // Hide building in Baserow
                await hideBuildingInBaserow(rowId);
                console.log(`✅ Hidden building "${building.name}" in Baserow`);
                
                // Remove building from local state
                setBuildings((prev) => prev.filter(b => b.id !== building.id));
                
                // Close the building details panel
                setSelectedBuilding(null);
                
                // Show success message
                setStatusMessage(`Removed "${building.name}" from the map`);
              } catch (err) {
                console.error(`Failed to hide building "${building.name}":`, err);
                setError(`Failed to remove "${building.name}"`);
              }
            }}
            onCancel={() => {
              setBuildingToDelete(null);
            }}
          />
        </Suspense>
      )}

      {/* Building Editor Modal */}
      {showEditorModal && (
        <Suspense fallback={null}>
          <BuildingEditorModal
            building={editingBuilding}
            coordinates={clickedCoordinates}
            onSave={handleSaveBuilding}
            onCancel={() => {
              setShowEditorModal(false);
              setEditingBuilding(null);
              setClickedCoordinates(null);
            }}
            theme={theme}
          />
        </Suspense>
      )}

      {/* Admin Toggle */}
      {buttonsVisible && (
        <AdminToggle
          enabled={adminModeEnabled}
          onToggle={setAdminModeEnabled}
          theme={theme}
        />
      )}

      {/* Branding overlay (bottom right) - Removed for clean aesthetic */}
    </div>
    </>
  );
}

export default App;