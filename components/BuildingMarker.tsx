import React, { useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { Building, ArchitecturalStyle } from '../types';
import { GENRE_COLORS, normalizeStyle } from '../constants';
import { createMarkerIcon } from '../ui/atoms/MarkerIcon';

interface BuildingMarkerProps {
  building: Building;
  isSelected: boolean;
  onSelect: (building: Building) => void;
  onTripleClick?: () => void; // Callback for triple-click on Nick pin
}

export const BuildingMarker: React.FC<BuildingMarkerProps> = ({ building, isSelected, onSelect, onTripleClick }) => {
  const map = useMap();
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check if this is Nick - show red heart icon
  const isNick = building.name === "Nick";
  
  // Prioritized buildings (historically significant Art Deco) get red pins
  const color = building.isPrioritized 
    ? '#ef4444' // Red-500
    : (building.style ? (GENRE_COLORS[normalizeStyle(building.style)] || GENRE_COLORS['Other']) : GENRE_COLORS['Other']);

  const handleClick = () => {
    // Only track triple-click for Nick pin
    if (isNick && onTripleClick) {
      clickCountRef.current += 1;
      
      // Clear existing timer
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      
      // If we've reached 3 clicks, trigger the callback
      if (clickCountRef.current >= 3) {
        onTripleClick();
        clickCountRef.current = 0;
      } else {
        // Reset counter after 1 second if no more clicks
        clickTimerRef.current = setTimeout(() => {
          clickCountRef.current = 0;
        }, 1000);
      }
    }
    
    // Always do the normal click behavior
    onSelect(building);
    map.flyTo([building.coordinates.lat, building.coordinates.lng], 15, {
      duration: 1.5,
      easeLinearity: 0.25
    });
  };

  // Use the design system MarkerIcon atom
  const icon = createMarkerIcon({
    color,
    isSelected,
    variant: isNick ? 'nick' : 'standard',
  });

  return (
    <Marker
      position={[building.coordinates.lat, building.coordinates.lng]}
      icon={icon}
      eventHandlers={{
        click: handleClick,
      }}
    >
       {/* We don't use standard Popup often in this design, opting for the side panel, 
           but we keep a minimal tooltip for hover. */}
    </Marker>
  );
};