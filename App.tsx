import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Map as AtlasMap } from './components/Map';
import { BuildingDetails } from './components/BuildingDetails';
import { SearchPanel } from './components/SearchPanel';
import { Building, Coordinates } from './types';
import { fetchLairs, geocodeLocation } from './services/geminiService';
import { fetchAllBuildings, fetchBuildingsNearLocation, fetchBuildingByName } from './services/baserowService';
import { DEFAULT_COORDINATES, TARGET_NEAREST_SEARCH_RADIUS } from './constants';
import { AlertTriangle, Info, Heart } from 'lucide-react';
import { PrimaryButton } from './ui/atoms';

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

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

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
        return allBaserowBuildings.filter((b) => getDistance(center, b.coordinates) <= radiusMeters);
      }
      const fresh = await fetchBuildingsNearLocation(center, radiusMeters);
      if (fresh.length > 0) {
        setAllBaserowBuildings((prev) => mergeBuildings(prev, fresh));
      }
      return fresh;
    },
    [allBaserowBuildings]
  );

  // Initial load of all Baserow buildings so markers can persist across searches
  useEffect(() => {
    const loadInitialBaserow = async () => {
      try {
        const all = await fetchAllBuildings();
        setAllBaserowBuildings(all);
        setBuildings((prev) => (prev.length === 0 ? all : mergeBuildings(prev, all)));
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

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newCenter = { lat: latitude, lng: longitude };
        setCenter(newCenter);
        setUserLocation(newCenter);
        
        try {
          // First, try Baserow
          setSearchStatus('searching_baserow');
          let results = await getBaserowBuildingsNear(newCenter, 50000); // 50km radius
          
          // If no results in Baserow, fall back to Gemini
          if (results.length === 0) {
            console.log("No buildings in Baserow, querying Gemini...");
            setSearchStatus('searching_gemini');
            results = await fetchLairs("Current Location", latitude, longitude);
          } else {
            console.log(`Found ${results.length} buildings in Baserow`);
          }
          
          // Sort results: prioritized buildings first
          const sortedResults = results.sort((a, b) => {
            if (a.isPrioritized && !b.isPrioritized) return -1;
            if (!a.isPrioritized && b.isPrioritized) return 1;
            return 0;
          });
          
          setBuildings((prev) => mergeBuildings(prev, sortedResults));
          if (sortedResults.length > 0) {
             setCenter(newCenter);
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
    
    let rateLimitError = false;
    let geocodedCoords: Coordinates | null = null;
    
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
      let results: Building[] = [];
      
      if (geocodedCoords) {
        results = await getBaserowBuildingsNear(geocodedCoords, 50000); // 50km radius
      }
      
      // If no results in Baserow, try Gemini (but handle rate limits gracefully)
      if (results.length === 0) {
        try {
          setSearchStatus('searching_gemini');
          const geminiResults = await fetchLairs(query, geocodedCoords?.lat, geocodedCoords?.lng);
          results = geminiResults;
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
            // Re-throw non-rate-limit errors
            throw geminiErr;
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
      
      // Move map to results if we have them, or to geocoded location
      if (sortedResults.length > 0) {
        if (geocodedCoords) {
          setCenter(geocodedCoords);
      } else {
          setCenter(sortedResults[0].coordinates);
        }
      } else if (geocodedCoords) {
        // Even if no results, move map to searched location
        setCenter(geocodedCoords);
      }
      
      // Show rate limit message if applicable (but only AFTER map has moved and we've tried to get results)
      if (rateLimitError) {
        setError("Too many new searches a day will alert the authorities! Wait until midnight to search some more, or browse buildings already visible");
      } else if (sortedResults.length === 0) {
        setError("No ominous structures detected in this sector.");
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
      let results = await getBaserowBuildingsNear(center, radius);
      
      // If no results in Baserow, fall back to Gemini
      if (results.length === 0) {
        console.log("No buildings in Baserow for visible area, querying Gemini...");
        setSearchStatus('searching_gemini');
        // Construct a descriptive query for Gemini
        const areaDescription = `Visible map area centered at ${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`;
        results = await fetchLairs(areaDescription, centerLat, centerLng);
      } else {
        console.log(`Found ${results.length} buildings in Baserow for visible area`);
      }

      // Sort results: prioritized buildings first
      const sortedResults = results.sort((a, b) => {
        if (a.isPrioritized && !b.isPrioritized) return -1;
        if (!a.isPrioritized && b.isPrioritized) return 1;
        return 0;
      });
      
      setBuildings((prev) => mergeBuildings(prev, sortedResults));
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

  return (
    <div className={`relative w-screen h-screen overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-black' : 'bg-zinc-100'}`}>
      
      {/* Search Bar - Floating */}
      <SearchPanel 
        onSearch={handleSearch} 
        onLocateMe={handleLocateMe}
        onFindNearest={handleFindNearest}
        onSearchArea={handleSearchArea}
        isLoading={loading}
        searchStatus={searchStatus}
        theme={theme}
        onToggleTheme={handleToggleTheme}
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
        className="absolute bottom-6 left-6 z-20 w-12 h-12 bg-zinc-900/90 hover:bg-red-900/90 border border-zinc-700 hover:border-red-600 text-white transition-all backdrop-blur-md shadow-lg flex items-center justify-center group"
        title="The Architect"
      >
        <Heart size={20} className="text-red-500 group-hover:scale-110 group-hover:text-red-400 transition-all fill-red-500 group-hover:fill-red-400" />
      </button>

      {/* Intro / Empty State Overlay */}
      {firstLoad && !loading && (
        <div className="absolute inset-0 bg-black/80 z-30 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 shadow-2xl relative overflow-hidden">
             {/* Decorative stripe */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-red-600 to-red-900"></div>

             <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">The Villain's Atlas</h1>
             <p className="text-zinc-400 font-mono text-sm mb-6 uppercase tracking-widest">Global Lair Surveillance System</p>
             
             <div className="space-y-4 text-zinc-300 mb-8">
               <p>The world is full of "pretty" buildings. We don't care about those.</p>
               <p>We track the brutal, the ominous, and the architectural manifestations of power.</p>
             </div>

             <PrimaryButton 
               theme={theme}
               onClick={handleLocateMe}
               fullWidth
               className="py-4 font-bold uppercase tracking-widest flex items-center justify-center group"
             >
                <AlertTriangle className="mr-2 group-hover:animate-pulse" size={18}/>
                Initialize Scan
             </PrimaryButton>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-6 right-6 z-50 max-w-sm bg-red-950/90 border-l-4 border-red-600 text-red-200 p-4 shadow-lg backdrop-blur-md flex items-start animate-in slide-in-from-bottom-5">
          <AlertTriangle className="shrink-0 mr-3" size={20} />
          <div>
            <h4 className="font-bold uppercase text-xs tracking-wider mb-1">System Alert</h4>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto hover:text-white"><Info size={16}/></button>
        </div>
      )}

      {/* Branding overlay (bottom right) */}
      <div className="absolute bottom-2 right-2 z-10 opacity-30 pointer-events-none">
        <h1 className="text-6xl font-black text-white tracking-tighter leading-none select-none">ATLAS</h1>
      </div>
    </div>
  );
}

export default App;