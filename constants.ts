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
  // Soviet/Communist styles - Lime green palette variations
  'Stalinist Gothic': '#C1EF7B',      // Base lime green
  'Soviet Modernism': '#B5E86A',     // Slightly darker lime
  'Socialist Classicism': '#A9E159',  // Darker lime
  'Soviet Brutalism': '#9DDA48',      // Darkest lime
  
  // Brutalist variants - Orange/coral palette variations
  'Brutalism': '#FF8052',             // Base orange/coral
  'New Brutalism': '#FF8F65',         // Lighter orange
  'Concrete Brutalism': '#FF9E78',    // Lightest orange
  'Brutalist': '#FF8052',             // Alias
  
  // Deco variants - Purple palette variations
  'Dark Deco': '#9873D3',              // Base purple
  'Art Deco': '#8A65C8',               // Slightly darker purple
  'Streamlined Moderne': '#7C57BD',    // Darker purple
  'Gothic Deco': '#6E49B2',            // Darkest purple
  
  // Gothic variants - Light grey palette (no pink tones)
  'Gothic Revival': '#D4D4D4',        // Light grey
  'Neo-Gothic': '#C8C8C8',            // Medium-light grey
  'Gothic': '#BCBCBC',                 // Medium grey
  'Victorian Gothic': '#B0B0B0',       // Medium-dark grey
  'Industrial Gothic': '#A4A4A4',      // Dark grey
  
  // Cathedral - Yellow palette (variations)
  'Cathedral': '#FFD700',               // Gold/yellow
  'Cathedral (Gothic)': '#FFC700',     // Slightly darker gold
  'Cathedral (Romanesque)': '#FFB700', // Darker gold
  
  // Graveyard - Black
  'Graveyard': '#000000',               // Black
  
  // Other menacing styles - Grey-blue palette (complementary to existing palette)
  'Totalitarian': '#8B9DC3',           // Grey-blue
  'Fascist Architecture': '#7A8DB0',     // Darker grey-blue
  'Monumental': '#697D9D',              // Dark grey-blue
  'Fortress': '#9A9A9A',                // Neutral grey
  'Bunker': '#8E8E8E',                  // Darker neutral grey
  'Cyberpunk': '#828282',               // Dark neutral grey
  'Dystopian': '#767676',               // Darkest neutral grey
  'Disgusting': '#FF5D88',              // Red (same as Nick's heart and romantic locations)
  
  // Fallback
  'Other': '#909090',                   // Medium neutral grey
};