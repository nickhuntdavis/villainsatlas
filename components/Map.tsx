import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents, CircleMarker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Coordinates, Building } from '../types';
import { MAP_TILE_URL_DARK, MAP_TILE_URL_LIGHT, MAP_ATTRIBUTION, DEFAULT_ZOOM, getPrimaryStyleColor, parseStyles, normalizeStyle } from '../constants';
import { BuildingMarker } from './BuildingMarker';
import { getThemeColors } from '../ui/theme';

// Component to handle map center updates when props change
const MapUpdater: React.FC<{ center: Coordinates }> = ({ center }) => {
  const map = useMap();
  const lastCenterRef = useRef<Coordinates | null>(null);
  const isInitialMountRef = useRef(true);
  const flyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Skip on initial mount - let MapContainer handle initial positioning
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastCenterRef.current = center;
      return;
    }
    
    // Clear any pending fly operations
    if (flyTimeoutRef.current) {
      clearTimeout(flyTimeoutRef.current);
    }
    
    // Only fly if center has changed significantly (more than 100 meters)
    // This prevents jumping back when center is set to the same or very similar location
    const shouldFly = !lastCenterRef.current || 
      Math.abs(center.lat - lastCenterRef.current.lat) > 0.001 || 
      Math.abs(center.lng - lastCenterRef.current.lng) > 0.001;
    
    if (shouldFly) {
      // Update last center immediately to prevent duplicate calls
      lastCenterRef.current = center;
      
      // Use a small timeout to debounce rapid center changes
      flyTimeoutRef.current = setTimeout(() => {
        map.flyTo([center.lat, center.lng], map.getZoom(), { duration: 2 });
        flyTimeoutRef.current = null;
      }, 50);
    }
    
    return () => {
      if (flyTimeoutRef.current) {
        clearTimeout(flyTimeoutRef.current);
        flyTimeoutRef.current = null;
      }
    };
  }, [center, map]);
  return null;
};

// Component to fix map size issues on initial load and window resize
const MapSizeFixer: React.FC = () => {
  const map = useMap();
  
  useEffect(() => {
    // Fix size immediately after mount (with small delay to ensure CSS has applied)
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    // Also fix on window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);
  
  return null;
};

// Component to track map bounds and expose them via callback
interface MapBoundsTrackerProps {
  onBoundsRequest?: (getBounds: () => { north: number; south: number; east: number; west: number } | null) => void;
}

const MapBoundsTracker: React.FC<MapBoundsTrackerProps> = ({ onBoundsRequest }) => {
  const map = useMap();
  
  useEffect(() => {
    if (onBoundsRequest) {
      const getBounds = () => {
        try {
          const bounds = map.getBounds();
          if (bounds) {
            return {
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest()
            };
          }
        } catch (error) {
          console.error("Error getting map bounds:", error);
        }
        return null;
      };
      
      onBoundsRequest(getBounds);
    }
  }, [map, onBoundsRequest]);
  
  return null;
};

// Component to optimize LCP by adding fetchpriority to first map tile and improve tile loading
const LCPOptimizer: React.FC = () => {
  const map = useMap();
  
  useEffect(() => {
    // Find the first map tile image and add fetchpriority="high"
    const optimizeLCP = () => {
      const tileContainer = map.getContainer();
      if (tileContainer) {
        const tiles = tileContainer.querySelectorAll('img.leaflet-tile') as NodeListOf<HTMLImageElement>;
        // Set fetchpriority="high" on first few visible tiles for LCP
        tiles.forEach((tile, index) => {
          if (index < 4 && !tile.hasAttribute('fetchpriority')) {
            tile.setAttribute('fetchpriority', 'high');
          }
          // Ensure tiles load properly
          if (!tile.complete && tile.src) {
            tile.loading = 'eager' as any;
          }
          // Remove any background colors - pane should be transparent
          tile.style.backgroundColor = 'transparent';
        });
        
        // Remove background colors from tile containers - pane should be transparent
        const tileContainers = tileContainer.querySelectorAll('.leaflet-tile-container');
        tileContainers.forEach((container) => {
          (container as HTMLElement).style.backgroundColor = 'transparent';
        });
      }
    };
    
    // Try multiple times to catch tiles as they load
    optimizeLCP();
    const timeout1 = setTimeout(optimizeLCP, 50);
    const timeout2 = setTimeout(optimizeLCP, 200);
    const timeout3 = setTimeout(optimizeLCP, 500);
    
    // Also listen for tile load events
    const handleTileLoad = () => optimizeLCP();
    const handleTileError = () => optimizeLCP();
    map.on('tileload', handleTileLoad);
    map.on('tileerror', handleTileError);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      map.off('tileload', handleTileLoad);
      map.off('tileerror', handleTileError);
    };
  }, [map]);
  
  return null;
};

// Component to handle map clicks and long-press (3 seconds) to add new location
interface MapClickHandlerProps {
  enabled: boolean;
  onMapClick: (coordinates: Coordinates) => void;
  onLongPress?: (coordinates: Coordinates) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ enabled, onMapClick, onLongPress }) => {
  const map = useMap();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressCoordsRef = useRef<Coordinates | null>(null);
  const isLongPressRef = useRef(false);
  
  useMapEvents({
    click: (e) => {
      // Clear any pending long-press
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressCoordsRef.current = null;
      }
      
      // Only handle click if it wasn't a long-press
      if (!isLongPressRef.current && enabled) {
        // Check if click target is a marker - if so, don't trigger map click
        const target = e.originalEvent.target as HTMLElement;
        const isMarker = target.closest('.leaflet-marker-icon') || target.closest('.leaflet-popup');
        
        if (!isMarker) {
          onMapClick({
            lat: e.latlng.lat,
            lng: e.latlng.lng,
          });
        }
      }
      
      isLongPressRef.current = false;
    },
    mousedown: (e) => {
      if (!onLongPress) return;
      
      // Check if target is a marker - if so, don't trigger long-press
      const target = e.originalEvent.target as HTMLElement;
      const isMarker = target.closest('.leaflet-marker-icon') || target.closest('.leaflet-popup');
      
      if (!isMarker) {
        isLongPressRef.current = false;
        longPressCoordsRef.current = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        };
        
        // Start long-press timer (3 seconds)
        longPressTimerRef.current = setTimeout(() => {
          if (longPressCoordsRef.current) {
            isLongPressRef.current = true;
            onLongPress(longPressCoordsRef.current);
            longPressCoordsRef.current = null;
          }
        }, 3000);
      }
    },
    mouseup: () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressCoordsRef.current = null;
      }
    },
    mouseleave: () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressCoordsRef.current = null;
      }
    },
  });
  
  // Also handle touch events for mobile
  useEffect(() => {
    if (!onLongPress) return;
    
    const mapContainer = map.getContainer();
    let touchStartCoords: Coordinates | null = null;
    let touchTimer: NodeJS.Timeout | null = null;
    let isTouchLongPress = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const isMarker = target.closest('.leaflet-marker-icon') || target.closest('.leaflet-popup');
      
      if (!isMarker) {
        isTouchLongPress = false;
        const touch = e.touches[0];
        const latlng = map.containerPointToLatLng(map.mouseEventToContainerPoint(touch as any));
        touchStartCoords = { lat: latlng.lat, lng: latlng.lng };
        
        touchTimer = setTimeout(() => {
          if (touchStartCoords) {
            isTouchLongPress = true;
            onLongPress(touchStartCoords);
            touchStartCoords = null;
          }
        }, 3000);
      }
    };
    
    const handleTouchEnd = () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
        touchStartCoords = null;
      }
      isTouchLongPress = false;
    };
    
    mapContainer.addEventListener('touchstart', handleTouchStart);
    mapContainer.addEventListener('touchend', handleTouchEnd);
    mapContainer.addEventListener('touchcancel', handleTouchEnd);
    
    return () => {
      mapContainer.removeEventListener('touchstart', handleTouchStart);
      mapContainer.removeEventListener('touchend', handleTouchEnd);
      mapContainer.removeEventListener('touchcancel', handleTouchEnd);
      if (touchTimer) {
        clearTimeout(touchTimer);
      }
    };
  }, [map, enabled, onLongPress]);
  
  return null;
};

interface MapProps {
  center: Coordinates;
  buildings: Building[];
  selectedBuilding: Building | null;
  onSelectBuilding: (b: Building) => void;
  onBoundsRequest?: (getBounds: () => { north: number; south: number; east: number; west: number } | null) => void;
  theme: 'dark' | 'light';
  onNickTripleClick?: () => void;
  adminModeEnabled?: boolean;
  onMapClick?: (coordinates: Coordinates) => void;
  onMapLongPress?: (coordinates: Coordinates) => void;
  onEditBuilding?: (building: Building) => void;
  userLocation?: Coordinates | null;
}

export const Map: React.FC<MapProps> = ({ center, buildings, selectedBuilding, onSelectBuilding, onBoundsRequest, theme, onNickTripleClick, adminModeEnabled = false, onMapClick, onMapLongPress, onEditBuilding, userLocation }) => {
  const isDark = theme === 'dark';
  const colors = getThemeColors(theme);
  const [showUserLocation, setShowUserLocation] = useState(true);
  // Store initial center only once using lazy initializer - never update it after mount
  const initialCenterRef = useRef<Coordinates | null>(null);
  if (initialCenterRef.current === null) {
    initialCenterRef.current = center;
  }
  
  // Auto-hide user location indicator after 10 seconds
  useEffect(() => {
    if (userLocation) {
      setShowUserLocation(true);
      const timer = setTimeout(() => {
        setShowUserLocation(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [userLocation]);

  return (
    <MapContainer
      key="map-container" // Stable key prevents remounting
      center={initialCenterRef.current ? [initialCenterRef.current.lat, initialCenterRef.current.lng] : [center.lat, center.lng]}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={true}
      zoomControl={false} // We'll add it manually to style or position it if needed
      className={`w-full h-full z-0 ${colors.background.surface}`}
      preferCanvas={false}
      fadeAnimation={true}
      zoomAnimation={true}
      markerZoomAnimation={true}
    >
      <TileLayer
        attribution="" // Hide attribution
        url={isDark ? MAP_TILE_URL_DARK : MAP_TILE_URL_LIGHT}
        maxZoom={19}
        minZoom={0}
        maxNativeZoom={18}
        tileSize={256}
        zoomOffset={0}
        keepBuffer={2}
        updateWhenZooming={true}
        updateWhenIdle={true}
        noWrap={false}
      />
      {/* Zoom controls hidden */}
      
      <MapSizeFixer />
      <MapUpdater center={center} />
      <MapBoundsTracker onBoundsRequest={onBoundsRequest} />
      <LCPOptimizer />
      {onMapClick && (
        <MapClickHandler enabled={true} onMapClick={onMapClick} onLongPress={onMapLongPress} />
      )}

      {/* User Location Indicator */}
      {userLocation && showUserLocation && (
        <>
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={8}
            pathOptions={{
              color: '#AA8BFF',
              fillColor: '#AA8BFF',
              fillOpacity: 0.6,
              weight: 2
            }}
          >
            <Popup>
              <div className="text-sm font-medium">You are here</div>
            </Popup>
          </CircleMarker>
          {/* Pulsing circle for user location */}
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={12}
            pathOptions={{
              color: '#AA8BFF',
              fillColor: 'transparent',
              fillOpacity: 0,
              weight: 2,
              opacity: 0.4
            }}
          />
        </>
      )}

      <MarkerClusterGroup
        chunkedLoading={false}
        maxClusterRadius={80}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
        removeOutsideVisibleBounds={true}
        iconCreateFunction={(cluster) => {
          // Get all buildings in this cluster
          const markers = cluster.getAllChildMarkers();
          const clusterBuildings = markers.map((marker: any) => {
            // Extract building from marker instance
            return (marker as any).building;
          }).filter(Boolean) as Building[];
          
          // Count styles to find most common
          const styleCounts: Record<string, number> = {};
          clusterBuildings.forEach(building => {
            if (building && building.style) {
              const styles = parseStyles(building.style);
              styles.forEach(style => {
                const normalized = normalizeStyle(style);
                styleCounts[normalized] = (styleCounts[normalized] || 0) + 1;
              });
            }
          });
          
          // Find most common style
          let mostCommonStyle = 'Other';
          let maxCount = 0;
          Object.entries(styleCounts).forEach(([style, count]) => {
            if (count > maxCount) {
              maxCount = count;
              mostCommonStyle = style;
            }
          });
          
          // Get color for most common style
          const clusterColor = getPrimaryStyleColor(mostCommonStyle);
          const count = cluster.getChildCount();
          
          // Create custom cluster icon with count and color
          const size = count < 10 ? 40 : count < 100 ? 50 : 60;
          
          return L.divIcon({
            html: `<div style="
              width: ${size}px;
              height: ${size}px;
              background-color: ${clusterColor};
              border: 3px solid #09090b;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #09090b;
              font-weight: bold;
              font-size: ${count < 10 ? '14px' : count < 100 ? '16px' : '18px'};
              box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            ">${count}</div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(size, size),
            iconAnchor: L.point(size / 2, size / 2),
          });
        }}
        onClusterClick={(cluster) => {
          // Auto-zoom to show all markers in cluster with padding
          const markers = cluster.getAllChildMarkers();
          if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            const bounds = group.getBounds();
            const map = cluster.layer._map;
            // Zoom to bounds with padding to ensure all markers are visible
            map.fitBounds(bounds.pad(0.15), {
              maxZoom: 18,
              duration: 1.5,
            });
          }
        }}
      >
        {buildings
          .filter((b, index, self) => 
            // Filter duplicates by ID - keep only the first occurrence
            index === self.findIndex((other) => other.id === b.id)
          )
          .map((b) => (
            <BuildingMarker
              key={b.id}
              building={b}
              isSelected={selectedBuilding?.id === b.id}
              onSelect={onSelectBuilding}
              onTripleClick={b.name === "Nick" ? onNickTripleClick : undefined}
              adminModeEnabled={adminModeEnabled}
              onEdit={onEditBuilding}
            />
          ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
};