import React, { useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { Building, ArchitecturalStyle } from '../types';
import { getPrimaryStyleColor } from '../constants';
import { createMarkerIcon } from '../ui/atoms/MarkerIcon';

interface BuildingMarkerProps {
  building: Building;
  isSelected: boolean;
  onSelect: (building: Building) => void;
  onTripleClick?: () => void; // Callback for triple-click on Nick pin
}

export const BuildingMarker: React.FC<BuildingMarkerProps> = ({ building, isSelected, onSelect, onTripleClick }) => {
  const map = useMap();
  
  // Check if this is Nick - show red heart icon
  const isNick = building.name === "Nick";
  
  // Check if this is Palace of Culture and Science
  const isPalaceOfCulture = building.name === "Palace of Culture and Science";
  
  // Use primary (first) style for color - prioritized buildings are bigger and have glow but same color
  const color = getPrimaryStyleColor(building.style);

  const handleClick = () => {
    // Trigger hearts animation on single click for Nick pin
    if (isNick && onTripleClick) {
      onTripleClick();
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
    variant: isNick ? 'nick' : building.hasPurpleHeart ? 'purpleHeart' : 'standard',
    isPrioritized: building.isPrioritized && !isPalaceOfCulture && !building.hasPurpleHeart,
    isPalaceOfCulture: isPalaceOfCulture,
    hasPurpleHeart: building.hasPurpleHeart || false,
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