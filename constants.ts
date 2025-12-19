import { Coordinates } from "./types";

// Map tiles
export const MAP_TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const MAP_TILE_URL_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
// Default used where theme isn't explicitly passed (kept for backward compatibility)
export const MAP_TILE_URL = MAP_TILE_URL_DARK;
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const DEFAULT_COORDINATES: Coordinates = { lat: 51.5074, lng: -0.1278 }; // London (classic villain hub)
export const DEFAULT_ZOOM = 13;
export const TARGET_NEAREST_SEARCH_RADIUS = 2000000; // 2000km in meters (Baserow-only for Nearest)

// Helper function to normalize style names (handles variants and synonyms)
export const normalizeStyle = (style: string | undefined): string => {
  if (!style) return 'Other';
  const normalized = style.toLowerCase().trim();
  
  // Soviet/Communist styles
  if (normalized.includes('stalinist') || normalized.includes('soviet') || normalized.includes('socialist')) {
    if (normalized.includes('gothic')) return 'Stalinist Gothic';
    if (normalized.includes('modernism')) return 'Soviet Modernism';
    if (normalized.includes('classicism')) return 'Socialist Classicism';
    if (normalized.includes('brutalism') || normalized.includes('brutalist')) return 'Soviet Brutalism';
    return 'Stalinist Gothic';
  }
  
  // Brutalist variants
  if (normalized.includes('brutalism') || normalized.includes('brutalist')) {
    if (normalized.includes('new')) return 'New Brutalism';
    if (normalized.includes('concrete') || normalized.includes('raw')) return 'Concrete Brutalism';
    return 'Brutalism';
  }
  
  // Deco variants
  if (normalized.includes('deco')) {
    if (normalized.includes('dark') || normalized.includes('gothic')) return 'Dark Deco';
    if (normalized.includes('streamlined') || normalized.includes('moderne')) return 'Streamlined Moderne';
    return 'Art Deco';
  }
  
  // Gothic variants
  if (normalized.includes('gothic')) {
    if (normalized.includes('neo') || normalized.includes('revival')) return 'Gothic Revival';
    if (normalized.includes('victorian')) return 'Victorian Gothic';
    if (normalized.includes('industrial')) return 'Industrial Gothic';
    return 'Gothic Revival';
  }
  
  // Other menacing styles
  if (normalized.includes('totalitarian')) return 'Totalitarian';
  if (normalized.includes('fascist')) return 'Fascist Architecture';
  if (normalized.includes('monumental')) return 'Monumental';
  if (normalized.includes('fortress') || normalized.includes('bunker')) return 'Fortress';
  if (normalized.includes('cyberpunk') || normalized.includes('dystopian')) return normalized.includes('cyberpunk') ? 'Cyberpunk' : 'Dystopian';
  
  // Return original if no match (allows for new styles)
  return style;
};

export const GENRE_COLORS: Record<string, string> = {
  // Soviet/Communist - Lime green
  'Stalinist Gothic': '#C1EF7B',
  'Soviet Modernism': '#C1EF7B',
  'Socialist Classicism': '#C1EF7B',
  'Soviet Brutalism': '#C1EF7B',
  
  // Brutalist - Orange/coral
  'Brutalism': '#FF8052',
  'New Brutalism': '#FF8052',
  'Concrete Brutalism': '#FF8052',
  'Brutalist': '#FF8052', // Alias
  
  // Deco - Purple
  'Dark Deco': '#9873D3',
  'Art Deco': '#9873D3',
  'Streamlined Moderne': '#9873D3',
  'Gothic Deco': '#9873D3',
  
  // Gothic - Light grey/pink
  'Gothic Revival': '#DFD3D6',
  'Neo-Gothic': '#DFD3D6',
  'Gothic': '#DFD3D6',
  'Victorian Gothic': '#DFD3D6',
  'Industrial Gothic': '#DFD3D6',
  
  // Other menacing - Light grey/pink
  'Totalitarian': '#DFD3D6',
  'Fascist Architecture': '#DFD3D6',
  'Monumental': '#DFD3D6',
  'Fortress': '#DFD3D6',
  'Bunker': '#DFD3D6',
  'Cyberpunk': '#DFD3D6',
  'Dystopian': '#DFD3D6',
  
  // Fallback
  'Other': '#DFD3D6',
};