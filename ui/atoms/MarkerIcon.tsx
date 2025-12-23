import React from 'react';
import { divIcon } from 'leaflet';

export interface MarkerIconProps {
  color: string; // Hex color
  isSelected: boolean;
  variant?: 'standard' | 'nick' | 'purpleHeart'; // 'nick' = red heart icon, 'purpleHeart' = purple heart icon
  isPrioritized?: boolean; // Prioritized buildings get glow and bounce
  isPalaceOfCulture?: boolean; // Palace of Culture gets special treatment
  zoom?: number; // Current zoom level for dynamic sizing
}

/**
 * Creates a Leaflet divIcon for building markers
 * This is used by BuildingMarker component
 */
export const createMarkerIcon = ({ color, isSelected, variant = 'standard', isPrioritized = false, isPalaceOfCulture = false, hasPurpleHeart = false, zoom = 13 }: MarkerIconProps & { hasPurpleHeart?: boolean }) => {
  let baseSize: number;
  let animationClass = '';
  let glowStyle = '';
  let sparkleStyle = '';
  
  // Helper function to convert hex to rgba with opacity
  const hexToRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };
  
  // Helper function to calculate size based on zoom level
  // Minimum size is 28px, scales up from zoom 0 to zoom 13+
  const calculateSize = (baseSize: number, zoom: number): number => {
    const MIN_SIZE = 28;
    const MIN_ZOOM = 0;
    const MAX_ZOOM = 13; // Full size at zoom 13 and above
    
    if (zoom >= MAX_ZOOM) {
      return baseSize;
    }
    
    // Linear interpolation: size scales from MIN_SIZE at MIN_ZOOM to baseSize at MAX_ZOOM
    const zoomRatio = Math.max(0, Math.min(1, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
    const scaledSize = MIN_SIZE + (baseSize - MIN_SIZE) * zoomRatio;
    
    return Math.max(MIN_SIZE, Math.round(scaledSize));
  };
  
  if (isPalaceOfCulture) {
    // Extra large size for Palace of Culture - heart icon with subtle glow
    // Increased to meet accessibility requirements (minimum 48px)
    baseSize = isSelected ? 56 : 48;
    animationClass = 'palace-pulse';
    const palaceColor = '#FF5D88'; // Same color as Nick
    const palaceGlowColor = hexToRgba(palaceColor, 0.2); // Very subtle glow
    sparkleStyle = `
      <style>
        @keyframes palacePulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 2px ${palaceGlowColor}) drop-shadow(0 0 4px ${palaceGlowColor});
          }
          50% {
            transform: scale(1.15);
            filter: drop-shadow(0 0 3px ${palaceGlowColor}) drop-shadow(0 0 6px ${palaceGlowColor});
          }
        }
        .palace-pulse {
          animation: palacePulse 3s ease-in-out infinite;
        }
      </style>
    `;
  } else if (variant === 'nick') {
    // Nick heart icon with subtle glow - bigger size
    // Increased to meet accessibility requirements (minimum 48px)
    baseSize = isSelected ? 56 : 48;
    animationClass = 'nick-glow';
    const nickColor = '#FF5D88';
    const nickGlowColor = hexToRgba(nickColor, 0.3);
    glowStyle = `
      <style>
        @keyframes nickGlow {
          0%, 100% {
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 3px ${nickGlowColor}) drop-shadow(0 0 6px ${nickGlowColor});
          }
          50% {
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 4px ${nickGlowColor}) drop-shadow(0 0 8px ${nickGlowColor});
          }
        }
        .nick-glow {
          animation: nickGlow 2s ease-in-out infinite;
        }
      </style>
    `;
  } else if (variant === 'purpleHeart' || hasPurpleHeart) {
    // Red heart icon for disgusting pins - 56px
    baseSize = 56;
    // No animation or glow for disgusting pins
  } else if (isPrioritized) {
    // Prioritized buildings get subtle glow and are bigger (no bounce)
    // 56px x 56px
    baseSize = 56;
    animationClass = 'prioritized-glow';
    const glowColor = hexToRgba(color, 0.3);
    glowStyle = `
      <style>
        @keyframes prioritizedGlow {
          0%, 100% {
            filter: drop-shadow(0 0 3px ${glowColor}) drop-shadow(0 0 6px ${glowColor});
          }
          50% {
            filter: drop-shadow(0 0 4px ${glowColor}) drop-shadow(0 0 8px ${glowColor});
          }
        }
        .prioritized-glow {
          animation: prioritizedGlow 2s ease-in-out infinite;
        }
      </style>
    `;
  } else {
    // Standard markers - 42px x 42px
    baseSize = 42;
  }
  
  // Calculate actual size based on zoom level (minimum 28px)
  const size = calculateSize(baseSize, zoom);
  
  let html: string;
  
  if (variant === 'nick' || isPalaceOfCulture) {
    // Heart icon for Nick and Palace of Culture - both use same color
    const heartColor = '#FF5D88';
    html = `
      ${glowStyle || sparkleStyle || ''}
      <div class="${animationClass}" style="
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
  } else if (variant === 'purpleHeart' || hasPurpleHeart) {
    // Red heart icon - no glow for disgusting pins
    const heartColor = '#FF5D88'; // Same red as Nick's heart
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
      ${glowStyle}
      <div class="${animationClass}" style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        transform: rotate(225deg);
        border-radius: 0 50% 50% 50%;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        border: 2px solid #09090b;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 30%;
          height: 30%;
          background-color: #09090b;
          border-radius: 50%;
        "></div>
      </div>
    `;
  }

  // Ensure minimum 48px touch target for accessibility
  // Visual size can be smaller, but touch target must be at least 48px
  const minTouchTarget = 48;
  const touchTargetSize = Math.max(size, minTouchTarget);
  const padding = (touchTargetSize - size) / 2;
  
  // Wrap the icon HTML in a container for proper spacing and accessibility
  const wrappedHtml = `
    <div style="
      width: ${touchTargetSize}px;
      height: ${touchTargetSize}px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${padding}px;
      box-sizing: border-box;
      cursor: pointer;
    ">
      ${html}
    </div>
  `;

  return divIcon({
    html: wrappedHtml,
    className: 'custom-marker', // dummy class to remove default styles
    iconSize: [touchTargetSize, touchTargetSize],
    iconAnchor: [touchTargetSize / 2, touchTargetSize / 2],
  });
};

