import React from 'react';
import { divIcon } from 'leaflet';

export interface MarkerIconProps {
  color: string; // Hex color
  isSelected: boolean;
  variant?: 'standard' | 'nick'; // 'nick' = red heart icon
}

/**
 * Creates a Leaflet divIcon for building markers
 * This is used by BuildingMarker component
 */
export const createMarkerIcon = ({ color, isSelected, variant = 'standard' }: MarkerIconProps) => {
  const size = isSelected ? 32 : 24;
  
  let html: string;
  
  if (variant === 'nick') {
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
    // Standard sharp, angular pin shape (flipped upside down)
    html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        transform: rotate(225deg);
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

