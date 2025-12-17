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
  // Soviet/Communist - Red tones
  'Stalinist Gothic': '#f872a8', // Updated accent color
  'Soviet Modernism': '#dc2626', // Red-600
  'Socialist Classicism': '#b91c1c', // Red-700
  'Soviet Brutalism': '#991b1b', // Red-800
  
  // Brutalist - Gray tones
  'Brutalism': '#a1a1aa', // Zinc-400
  'New Brutalism': '#71717a', // Zinc-500
  'Concrete Brutalism': '#52525b', // Zinc-600
  'Brutalist': '#a1a1aa', // Alias
  
  // Deco - Silver/Gray tones
  'Dark Deco': '#d4d4d8', // Zinc-300
  'Art Deco': '#e4e4e7', // Zinc-200
  'Streamlined Moderne': '#f4f4f5', // Zinc-100
  'Gothic Deco': '#a1a1aa', // Zinc-400
  
  // Gothic - Dark red/brown tones
  'Gothic Revival': '#7c2d12', // Red-900
  'Neo-Gothic': '#991b1b', // Red-800
  'Gothic': '#7c2d12', // Red-900
  'Victorian Gothic': '#9a3412', // Red-800
  'Industrial Gothic': '#6b1f1f', // Dark red
  
  // Other menacing - Various dark tones
  'Totalitarian': '#7f1d1d', // Red-950
  'Fascist Architecture': '#450a0a', // Very dark red
  'Monumental': '#3f3f46', // Zinc-700
  'Fortress': '#27272a', // Zinc-800
  'Bunker': '#18181b', // Zinc-900
  'Cyberpunk': '#10b981', // Emerald-500 (futuristic)
  'Dystopian': '#059669', // Emerald-600
  
  // Fallback
  'Other': '#71717a', // Zinc-500
};