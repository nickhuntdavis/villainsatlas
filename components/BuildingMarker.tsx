import React from 'react';
import { divIcon } from 'leaflet';
import { Marker, Popup, useMap } from 'react-leaflet';
import { Building, ArchitecturalStyle } from '../types';
import { GENRE_COLORS, normalizeStyle } from '../constants';

interface BuildingMarkerProps {
  building: Building;
  isSelected: boolean;
  onSelect: (building: Building) => void;
}

const createCustomIcon = (color: string, isSelected: boolean, isNick: boolean = false) => {
  const size = isSelected ? 32 : 24;
  
  let html: string;
  
  if (isNick) {
    // Red heart icon for Nick
    const heartColor = '#ef4444'; // Red-500
    html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
      ">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${heartColor}" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
    `;
  } else {
    // A sharp, angular pin shape using CSS
    html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        transform: rotate(45deg);
        border-radius: 0 50% 50% 50%;
        box-shadow: 0 4px 10px rgba(0,0,0,0.8);
        border: 2px solid #09090b; 
      " class="flex items-center justify-center relative group">
        <div style="
          width: 30%;
          height: 30%;
          background-color: #09090b;
          border-radius: 50%;
        "></div>
      </div>
    `;
  }

  return divIcon({
    html,
    className: 'custom-marker', // dummy class to remove default styles
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export const BuildingMarker: React.FC<BuildingMarkerProps> = ({ building, isSelected, onSelect }) => {
  const map = useMap();
  
  // Check if this is Nick - show red heart icon
  const isNick = building.name === "Nick";
  
  // Prioritized buildings (historically significant Art Deco) get red pins
  const color = building.isPrioritized 
    ? '#ef4444' // Red-500
    : (building.style ? (GENRE_COLORS[normalizeStyle(building.style)] || GENRE_COLORS['Other']) : GENRE_COLORS['Other']);

  const handleClick = () => {
    onSelect(building);
    map.flyTo([building.coordinates.lat, building.coordinates.lng], 15, {
      duration: 1.5,
      easeLinearity: 0.25
    });
  };

  return (
    <Marker
      position={[building.coordinates.lat, building.coordinates.lng]}
      icon={createCustomIcon(color, isSelected, isNick)}
      eventHandlers={{
        click: handleClick,
      }}
    >
       {/* We don't use standard Popup often in this design, opting for the side panel, 
           but we keep a minimal tooltip for hover. */}
    </Marker>
  );
};