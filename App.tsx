import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Map as AtlasMap } from './components/Map';
import { BuildingDetails } from './components/BuildingDetails';
import { SearchPanel } from './components/SearchPanel';
import { Building, Coordinates } from './types';
import { fetchLairs, geocodeLocation } from './services/geminiService';
import { fetchAllBuildings, fetchBuildingsNearLocation, fetchBuildingByName } from './services/baserowService';
import { DEFAULT_COORDINATES, TARGET_NEAREST_SEARCH_RADIUS } from './constants';
import { AlertTriangle, Info, Heart, Scan } from 'lucide-react';
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
      if (stored === 'light' || stored === 'dark') return stored;
    }
    return 'dark';
  });
  
  // Ref to store the map bounds getter function
  const getMapBoundsRef = useRef<(() => { north: number; south: number; east: number; west: number } | null) | null>(null);

  // Persist theme and expose as data attribute for potential global styling
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('evil-atlas-theme', theme);
    }
  }, [theme]);


  // Merge helper to keep markers persistent without duplicates
  const mergeBuildings = (existing: Building[], incoming: Building[]): Building[] => {
    const byId = new Map<string, Building>();
    existing.forEach((b) => {
      byId.set(b.id, b);
    });
    incoming.forEach((b) => {
      const current = byId.get(b.id);
      if (current) {
        byId.set(b.id, { ...current, ...b });
      } else {
        byId.set(b.id, b);
      }
    });
    return Array.from(byId.values());
  };

  // Helper to get nearby Baserow buildings, preferring in-memory cache
  const getBaserowBuildingsNear = useCallback(
    async (center: Coordinates, radiusMeters: number) => {
      if (allBaserowBuildings.length > 0) {
        // Filter by distance and validate coordinates
        return allBaserowBuildings.filter((b) => {
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
      }
      const fresh = await fetchBuildingsNearLocation(center, radiusMeters);
      if (fresh.length > 0) {
        setAllBaserowBuildings((prev) => mergeBuildings(prev, fresh));
      }
      return fresh;
    },
    [allBaserowBuildings]
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

  // Initial load of all Baserow buildings for caching and display on map
  useEffect(() => {
    const loadInitialBaserow = async () => {
      try {
        const all = await fetchAllBuildings();
        // Filter out buildings with invalid coordinates
        const validBuildings = all.filter((b) => 
          b.coordinates && 
          !isNaN(b.coordinates.lat) && 
          !isNaN(b.coordinates.lng) &&
          !(b.coordinates.lat === 0 && b.coordinates.lng === 0)
        );
        setAllBaserowBuildings(validBuildings);
        
        // Display buildings within initial map view (50km radius from default center)
        const initialRadius = 50000; // 50km
        const buildingsInView = validBuildings.filter((b) => 
          getDistance(DEFAULT_COORDINATES, b.coordinates) <= initialRadius
        );
        setBuildings(buildingsInView);
      } catch (err) {
        console.error("Error loading initial Baserow buildings:", err);
      }
    };
    loadInitialBaserow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
       () => {
         setError("Unable to retrieve location.");
         setLoading(false);
       }
     );
   }, []);

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
              await searchAndFindNearest(coords);
              resolve();
            },
            async () => {
              // Geolocation failed, use map center
              await searchAndFindNearest(center);
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
            performFind(coords);
            setLoading(false);
          },
          () => {
             // Fallback to center of screen
             performFind(center);
             setLoading(false);
          }
        );
      } else {
         performFind(center);
      }
    }
  }, [buildings, userLocation, center, searchAndFindNearest, findNearestBuilding]);

  const handleSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    setSelectedBuilding(null);
    setStatusMessage(null);
    
    let rateLimitError = false;
    let geocodedCoords: Coordinates | null = null;
    let statusMessage: string | null = null;
    
    try {
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
       setError("Connection to The Villain's Atlas Archives failed.");
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
    setSelectedBuilding(b);
  };

  const handleCloseDetails = () => {
    setSelectedBuilding(null);
  };

  const colors = getThemeColors(theme);
  
  return (
    <div className={`relative w-screen h-[100dvh] overflow-hidden flex flex-col ${colors.background.default}`}>
      
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
      />

      {/* Map Layer */}
      <div className="flex-1 relative z-0">
        <AtlasMap 
          center={center}
          buildings={buildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleSelectBuilding}
          onBoundsRequest={handleBoundsRequest}
          theme={theme}
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
      </div>

      {/* Detail Panel - Sliding Drawer */}
      <BuildingDetails 
        building={selectedBuilding} 
        onClose={handleCloseDetails} 
        theme={theme}
      />

      {/* The "N" Button - Bottom Left */}
      <button
        onClick={handleNButton}
        className="absolute bottom-4 md:bottom-6 left-4 md:left-6 z-10 w-14 h-14 transition-all flex items-center justify-center group hover:scale-105"
        title="The Architect"
      >
        <Heart size={20} className="group-hover:scale-110 transition-all fill-current text-red-500" />
      </button>


      {/* Intro / Empty State Overlay */}
      {firstLoad && !loading && (
        <div className="absolute inset-0 bg-[#010E36]/80 z-30 flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-[#282C55] p-12 shadow-xl relative rounded-[32px]">
             <h1 className={`${fontFamily.heading} text-[#FDFEFF] mb-3 pt-2 pb-2`} style={{ fontSize: 'clamp(32px, 3.5vw, 4.5rem)', lineHeight: '1.1' }}>the Sexy Building Atlas</h1>
             <p className={`${typography.body.sm} text-[#FDFEFF] mb-8`}>Global architecture finder</p>
             
             <div className={`space-y-4 ${typography.body.default} text-[#FDFEFF] mb-10`}>
               <p>The world is full of mediocre buildings. We don't care about those.</p>
               <p>We track the brutal, the ominous, and the architectural manifestations of power.</p>
             </div>

             <button
               onClick={handleLocateMe}
               className="w-full bg-[#d9d9d9] text-[#010E36] flex items-center justify-center group px-6 py-4 rounded-lg font-medium transition-all hover:opacity-90"
             >
                <Scan className="mr-2" size={18}/>
                Initialize Scan
             </button>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className={`absolute bottom-4 md:bottom-6 right-4 md:right-6 z-50 max-w-sm ${colors.background.surface} ${colors.border.default} ${colors.text.secondary} p-6 shadow-lg border rounded-lg flex items-start`}>
          <AlertTriangle className={`shrink-0 mr-3 ${colors.accent.primary}`} size={20} />
          <div className="flex-1">
            <h4 className={`${typography.label.button} ${colors.text.primary} mb-2`}>System Alert</h4>
            <p className={typography.body.sm}>{error}</p>
          </div>
          <button onClick={() => setError(null)} className={`ml-4 ${colors.text.muted} hover:opacity-80`}><Info size={16}/></button>
        </div>
      )}

      {/* Branding overlay (bottom right) - Removed for clean aesthetic */}
    </div>
  );
}

export default App;