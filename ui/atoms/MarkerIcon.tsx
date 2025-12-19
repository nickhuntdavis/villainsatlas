import React from 'react';
import { divIcon } from 'leaflet';

export interface MarkerIconProps {
  color: string; // Hex color
  isSelected: boolean;
  variant?: 'standard' | 'nick' | 'purpleHeart'; // 'nick' = red heart icon, 'purpleHeart' = purple heart icon
  isPrioritized?: boolean; // Prioritized buildings get glow and bounce
  isPalaceOfCulture?: boolean; // Palace of Culture gets special treatment
}

/**
 * Creates a Leaflet divIcon for building markers
 * This is used by BuildingMarker component
 */
export const createMarkerIcon = ({ color, isSelected, variant = 'standard', isPrioritized = false, isPalaceOfCulture = false, hasPurpleHeart = false }: MarkerIconProps & { hasPurpleHeart?: boolean }) => {
  let size: number;
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
  
  if (isPalaceOfCulture) {
    // Extra large size for Palace of Culture - heart icon with subtle glow
    size = isSelected ? 48 : 40;
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
    // Nick heart icon with subtle glow
    size = isSelected ? 32 : 24;
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
    // Red heart icon with red glow (similar to isPrioritized but with heart icon)
    size = isSelected ? 42 : 32;
    animationClass = 'red-heart-glow';
    const redColor = '#FF5D88'; // Same red as Nick's heart
    const redGlowColor = hexToRgba(redColor, 0.4);
    glowStyle = `
      <style>
        @keyframes redHeartGlow {
          0%, 100% {
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 4px ${redGlowColor}) drop-shadow(0 0 8px ${redGlowColor});
          }
          50% {
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 6px ${redGlowColor}) drop-shadow(0 0 12px ${redGlowColor});
          }
        }
        .red-heart-glow {
          animation: redHeartGlow 2s ease-in-out infinite;
        }
      </style>
    `;
  } else if (isPrioritized) {
    // Prioritized buildings get subtle glow and are bigger (no bounce)
    // 150% bigger: 28px -> 42px, 36px -> 54px
    // Glow uses the pin's style color (not pink)
    size = isSelected ? 54 : 42;
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
    size = isSelected ? 32 : 24;
  }
  
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
    // Red heart icon with red glow
    const heartColor = '#FF5D88'; // Same red as Nick's heart
    html = `
      ${glowStyle}
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

  return divIcon({
    html,
    className: 'custom-marker', // dummy class to remove default styles
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

