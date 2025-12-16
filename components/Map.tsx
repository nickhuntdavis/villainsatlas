import React, { useEffect } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { Coordinates, Building } from '../types';
import { MAP_TILE_URL_DARK, MAP_TILE_URL_LIGHT, MAP_ATTRIBUTION, DEFAULT_ZOOM } from '../constants';
import { BuildingMarker } from './BuildingMarker';

// Component to handle map center updates when props change
const MapUpdater: React.FC<{ center: Coordinates }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], map.getZoom(), { duration: 2 });
  }, [center, map]);
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

interface MapProps {
  center: Coordinates;
  buildings: Building[];
  selectedBuilding: Building | null;
  onSelectBuilding: (b: Building) => void;
  onBoundsRequest?: (getBounds: () => { north: number; south: number; east: number; west: number } | null) => void;
  theme: 'dark' | 'light';
}

export const Map: React.FC<MapProps> = ({ center, buildings, selectedBuilding, onSelectBuilding, onBoundsRequest, theme }) => {
  const isDark = theme === 'dark';

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={true}
      zoomControl={false} // We'll add it manually to style or position it if needed
      className={`w-full h-full z-0 ${isDark ? 'bg-zinc-950' : 'bg-zinc-100'}`}
    >
      <TileLayer
        attribution={MAP_ATTRIBUTION}
        url={isDark ? MAP_TILE_URL_DARK : MAP_TILE_URL_LIGHT}
      />
      <ZoomControl position="topright" />
      
      <MapUpdater center={center} />
      <MapBoundsTracker onBoundsRequest={onBoundsRequest} />

      {buildings.map((b) => (
        <BuildingMarker
          key={b.id}
          building={b}
          isSelected={selectedBuilding?.id === b.id}
          onSelect={onSelectBuilding}
        />
      ))}
    </MapContainer>
  );
};