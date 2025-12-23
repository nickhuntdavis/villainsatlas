import React, { useRef, useEffect, useState } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Building, ArchitecturalStyle } from '../types';
import { getPrimaryStyleColor } from '../constants';
import { createMarkerIcon } from '../ui/atoms/MarkerIcon';

interface BuildingMarkerProps {
  building: Building;
  isSelected: boolean;
  onSelect: (building: Building) => void;
  onTripleClick?: () => void; // Callback for triple-click on Nick pin
  adminModeEnabled?: boolean; // When true, clicking opens edit modal instead of building details
  onEdit?: (building: Building) => void; // Callback for edit mode
}

export const BuildingMarker: React.FC<BuildingMarkerProps> = ({ building, isSelected, onSelect, onTripleClick, adminModeEnabled = false, onEdit }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  
  // Track zoom level changes
  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
    zoom: () => {
      setZoom(map.getZoom());
    },
  });
  
  // Check if this is Nick - show red heart icon
  const isNick = building.name === "Nick";
  
  // Check if this is Palace of Culture and Science
  const isPalaceOfCulture = building.name === "Palace of Culture and Science";
  
  // Check if building has "Disgusting" style - show red heart icon
  const isDisgusting = building.style && building.style.toString().includes('Disgusting');
  
  // Use primary (first) style for color - prioritized buildings are bigger and have glow but same color
  const color = getPrimaryStyleColor(building.style);

  const handleClick = () => {
    // If admin mode is enabled, open edit modal instead of building details
    if (adminModeEnabled && onEdit) {
      onEdit(building);
      map.flyTo([building.coordinates.lat, building.coordinates.lng], 15, {
        duration: 1.5,
        easeLinearity: 0.25
      });
      return;
    }
    
    // Trigger hearts animation on single click for Nick pin or Palace of Culture
    if ((isNick || isPalaceOfCulture) && onTripleClick) {
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
  // Priority: Nick > Disgusting style > hasPurpleHeart > standard
  const icon = createMarkerIcon({
    color,
    isSelected,
    variant: isNick ? 'nick' : (isDisgusting || building.hasPurpleHeart) ? 'purpleHeart' : 'standard',
    isPrioritized: building.isPrioritized && !isPalaceOfCulture && !building.hasPurpleHeart && !isDisgusting,
    isPalaceOfCulture: isPalaceOfCulture,
    hasPurpleHeart: building.hasPurpleHeart || isDisgusting || false,
    zoom: zoom,
  });

  // Create accessible label for the marker
  const markerLabel = building.city && building.country
    ? `${building.name}, ${building.city}, ${building.country}`
    : building.location
    ? `${building.name}, ${building.location}`
    : building.name;

  // Ref callback to access the Leaflet marker instance and set accessibility attributes
  const markerRefCallback = (markerInstance: L.Marker | null) => {
    if (markerInstance) {
      const markerElement = markerInstance.getElement();
      if (markerElement) {
        const iconElement = markerElement.querySelector('.leaflet-marker-icon') as HTMLElement;
        if (iconElement) {
          // Add aria-label and title for accessibility
          iconElement.setAttribute('aria-label', markerLabel);
          iconElement.setAttribute('title', markerLabel);
          iconElement.setAttribute('role', 'button');
          // Ensure the icon element itself has proper touch target styling
          iconElement.style.minWidth = '48px';
          iconElement.style.minHeight = '48px';
          iconElement.style.display = 'flex';
          iconElement.style.alignItems = 'center';
          iconElement.style.justifyContent = 'center';
        }
      }
    }
  };

  return (
    <Marker
      key={`${building.id}-zoom-${Math.floor(zoom)}`}
      ref={markerRefCallback}
      position={[building.coordinates.lat, building.coordinates.lng]}
      icon={icon}
      title={markerLabel}
      eventHandlers={{
        click: handleClick,
      }}
      keyboard={true}
    >
       {/* We don't use standard Popup often in this design, opting for the side panel, 
           but we keep a minimal tooltip for hover. */}
    </Marker>
  );
};