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

// Helper function to parse comma-separated styles into an array
export const parseStyles = (style: string | undefined): string[] => {
  if (!style) return ['Other'];
  return style
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
};

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
  
  // Cathedral - check before other styles to catch cathedrals specifically
  if (normalized.includes('cathedral')) return 'Cathedral';
  
  // Graveyard/Cemetery - check before other styles
  if (normalized.includes('graveyard') || normalized.includes('cemetery')) return 'Graveyard';
  
  // Other menacing styles
  if (normalized.includes('totalitarian')) return 'Totalitarian';
  if (normalized.includes('fascist')) return 'Fascist Architecture';
  if (normalized.includes('monumental')) return 'Monumental';
  if (normalized.includes('fortress') || normalized.includes('bunker')) return 'Fortress';
  if (normalized.includes('cyberpunk') || normalized.includes('dystopian')) return normalized.includes('cyberpunk') ? 'Cyberpunk' : 'Dystopian';
  if (normalized.includes('disgusting')) return 'Disgusting';
  
  // Return original if no match (allows for new styles)
  return style;
};

// Helper function to normalize multiple styles (comma-separated)
export const normalizeStyles = (style: string | undefined): string[] => {
  if (!style) return ['Other'];
  const styles = parseStyles(style);
  return styles.map(s => normalizeStyle(s));
};

// Helper function to get primary (first) style color (used for pins)
export const getPrimaryStyleColor = (style: string | undefined): string => {
  if (!style) return GENRE_COLORS['Other'];
  const styles = parseStyles(style);
  const firstStyle = normalizeStyle(styles[0]);
  return GENRE_COLORS[firstStyle] || GENRE_COLORS['Other'];
};

export const GENRE_COLORS: Record<string, string> = {
  // Soviet/Communist styles - Bright cyan palette (color-blind friendly, high contrast on dark)
  'Stalinist Gothic': '#00FFFF',      // Bright cyan
  'Soviet Modernism': '#00E5E5',     // Slightly darker cyan
  'Socialist Classicism': '#00CCCC',  // Darker cyan
  'Soviet Brutalism': '#00B3B3',      // Darkest cyan
  
  // Brutalist variants - Bright orange palette (color-blind friendly, high contrast)
  'Brutalism': '#FF8C00',             // Bright orange
  'New Brutalism': '#FFA500',         // Lighter orange
  'Concrete Brutalism': '#FFB84D',    // Lightest orange
  'Brutalist': '#FF8C00',             // Alias
  
  // Deco variants - Bright magenta/pink palette (color-blind friendly, high contrast)
  'Dark Deco': '#FF00FF',              // Bright magenta
  'Art Deco': '#FF33FF',               // Slightly lighter magenta
  'Streamlined Moderne': '#FF66FF',    // Lighter magenta
  'Gothic Deco': '#FF99FF',            // Lightest magenta
  
  // Gothic variants - Bright yellow palette (color-blind friendly, high contrast)
  'Gothic Revival': '#FFD700',        // Bright gold/yellow
  'Neo-Gothic': '#FFE44D',            // Lighter yellow
  'Gothic': '#FFFF00',                 // Pure yellow
  'Victorian Gothic': '#FFCC00',       // Darker yellow
  'Industrial Gothic': '#FFB300',      // Darkest yellow
  
  // Cathedral - Bright white/light cyan palette (high contrast)
  'Cathedral': '#FFFFFF',               // White (maximum contrast)
  'Cathedral (Gothic)': '#E6F3FF',     // Very light cyan
  'Cathedral (Romanesque)': '#CCE7FF', // Light cyan
  
  // Graveyard - Bright red (high contrast, distinguishable from other colors)
  'Graveyard': '#FF0000',               // Bright red
  
  // Other menacing styles - Bright blue/green palette (color-blind friendly)
  'Totalitarian': '#0080FF',           // Bright blue
  'Fascist Architecture': '#0066CC',     // Darker blue
  'Monumental': '#004C99',              // Dark blue
  'Fortress': '#00FF00',                // Bright green
  'Bunker': '#00CC00',                  // Darker green
  'Cyberpunk': '#00FF80',               // Bright green-cyan
  'Dystopian': '#00CC66',               // Darker green-cyan
  'Disgusting': '#FF5D88',              // Bright pink (same as Nick's heart and romantic locations)
  
  // Fallback - Bright cyan-blue (high contrast)
  'Other': '#00BFFF',                   // Deep sky blue
};