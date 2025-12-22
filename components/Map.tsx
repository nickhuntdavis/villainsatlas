import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinates, Building } from '../types';
import { MAP_TILE_URL_DARK, MAP_TILE_URL_LIGHT, MAP_ATTRIBUTION, DEFAULT_ZOOM } from '../constants';
import { BuildingMarker } from './BuildingMarker';
import { getThemeColors } from '../ui/theme';

// Component to handle map center updates when props change
const MapUpdater: React.FC<{ center: Coordinates }> = ({ center }) => {
  const map = useMap();
  const lastCenterRef = useRef<Coordinates | null>(null);
  
  useEffect(() => {
    const currentCenter = map.getCenter();
    const currentCoords = { lat: currentCenter.lat, lng: currentCenter.lng };
    
    // Only fly if center has changed significantly (more than 100 meters)
    // This prevents jumping back when center is set to the same or very similar location
    const shouldFly = !lastCenterRef.current || 
      Math.abs(center.lat - lastCenterRef.current.lat) > 0.001 || 
      Math.abs(center.lng - lastCenterRef.current.lng) > 0.001;
    
    if (shouldFly) {
      map.flyTo([center.lat, center.lng], map.getZoom(), { duration: 2 });
      lastCenterRef.current = center;
    }
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

// Component to handle map clicks (only when admin mode is enabled)
interface MapClickHandlerProps {
  enabled: boolean;
  onMapClick: (coordinates: Coordinates) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ enabled, onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (enabled) {
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
    },
  });
  
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
  onEditBuilding?: (building: Building) => void;
  userLocation?: Coordinates | null;
}

export const Map: React.FC<MapProps> = ({ center, buildings, selectedBuilding, onSelectBuilding, onBoundsRequest, theme, onNickTripleClick, adminModeEnabled = false, onMapClick, onEditBuilding, userLocation }) => {
  const isDark = theme === 'dark';
  const colors = getThemeColors(theme);
  const [showUserLocation, setShowUserLocation] = useState(true);
  
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
      center={[center.lat, center.lng]}
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
      {adminModeEnabled && onMapClick && (
        <MapClickHandler enabled={adminModeEnabled} onMapClick={onMapClick} />
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

      {buildings.map((b) => (
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
    </MapContainer>
  );
};