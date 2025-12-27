import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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

  // Memoize handleClick to prevent ref callback from changing on every render
  const handleClick = useCallback(() => {
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
  }, [adminModeEnabled, onEdit, building, map, isNick, isPalaceOfCulture, onTripleClick, onSelect]);

  // Create accessible label for the marker
  const markerLabel = building.city && building.country
    ? `${building.name}, ${building.city}, ${building.country}`
    : building.location
    ? `${building.name}, ${building.location}`
    : building.name;

  // Memoize icon to prevent unnecessary recreation (only recreate when dependencies change)
  // Use the design system MarkerIcon atom
  // Priority: Nick > Disgusting style > hasPurpleHeart > standard
  const icon = useMemo(() => createMarkerIcon({
    color,
    isSelected,
    variant: isNick ? 'nick' : (isDisgusting || building.hasPurpleHeart) ? 'purpleHeart' : 'standard',
    isPrioritized: building.isPrioritized && !isPalaceOfCulture && !building.hasPurpleHeart && !isDisgusting,
    isPalaceOfCulture: isPalaceOfCulture,
    hasPurpleHeart: building.hasPurpleHeart || isDisgusting || false,
    zoom: zoom,
  }), [color, isSelected, isNick, isDisgusting, building.hasPurpleHeart, building.isPrioritized, isPalaceOfCulture, zoom]);

  // Store marker ref to attach click handler manually
  const markerRef = useRef<L.Marker | null>(null);
  
  // Ref callback to access the Leaflet marker instance and set accessibility attributes
  // Use useCallback to prevent the ref from being recreated on every render
  const markerRefCallback = useCallback((markerInstance: L.Marker | null) => {
    markerRef.current = markerInstance;
    
    if (markerInstance) {
      // Store building data on marker for cluster access (only once)
      if (!(markerInstance as any).building) {
        (markerInstance as any).building = building;
      }
      
      // Manually attach click handler to work with MarkerClusterGroup
      // Remove any existing click handlers first to prevent duplicates
      markerInstance.off('click');
      markerInstance.on('click', (e) => {
        // Prevent cluster from handling this click
        if (e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        handleClick();
      });
      
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
          // Ensure pointer events work
          iconElement.style.pointerEvents = 'auto';
          iconElement.style.cursor = 'pointer';
        }
      }
    }
  }, [building, markerLabel, handleClick]);

  return (
    <Marker
      key={building.id}
      ref={markerRefCallback}
      position={[building.coordinates.lat, building.coordinates.lng]}
      icon={icon}
      title={markerLabel}
      keyboard={true}
    >
       {/* We don't use standard Popup often in this design, opting for the side panel, 
           but we keep a minimal tooltip for hover. */}
    </Marker>
  );
};