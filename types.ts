export interface Coordinates {
  lat: number;
  lng: number;
}

export enum ArchitecturalStyle {
  // Soviet/Communist Styles
  STALINIST_GOTHIC = 'Stalinist Gothic',
  SOVIET_MODERNISM = 'Soviet Modernism',
  SOCIALIST_CLASSICISM = 'Socialist Classicism',
  SOVIET_BRUTALISM = 'Soviet Brutalism',
  
  // Brutalist Variants
  BRUTALISM = 'Brutalism',
  BRUTALIST = 'Brutalist',
  NEW_BRUTALISM = 'New Brutalism',
  CONCRETE_BRUTALISM = 'Concrete Brutalism',
  
  // Deco Variants
  DARK_DECO = 'Dark Deco',
  ART_DECO = 'Art Deco',
  STREAMLINED_MODERNE = 'Streamlined Moderne',
  GOTHIC_DECO = 'Gothic Deco',
  
  // Gothic Variants
  GOTHIC_REVIVAL = 'Gothic Revival',
  NEO_GOTHIC = 'Neo-Gothic',
  GOTHIC = 'Gothic',
  VICTORIAN_GOTHIC = 'Victorian Gothic',
  
  // Other Menacing Styles
  TOTALITARIAN = 'Totalitarian',
  FASCIST_ARCHITECTURE = 'Fascist Architecture',
  MONUMENTAL = 'Monumental',
  FORTRESS = 'Fortress',
  BUNKER = 'Bunker',
  INDUSTRIAL_GOTHIC = 'Industrial Gothic',
  CYBERPUNK = 'Cyberpunk',
  DYSTOPIAN = 'Dystopian',
  
  // Fallback
  OTHER = 'Other'
}

export interface Building {
  id: string;
  name: string;
  location: string;
  description: string;
  style?: ArchitecturalStyle; // Made optional since Baserow doesn't have this field
  coordinates: Coordinates;
  gmapsUrl?: string; // Google Maps URL (preferred over groundingUrl)
  groundingUrl?: string; // Deprecated: Use gmapsUrl instead
  imageUrl?: string; // URL from Google Search
  city?: string; // Extracted city name
  country?: string; // Extracted country name
  googlePlaceId?: string; // Google Place ID - use this to construct proper place URLs
  isPrioritized?: boolean; // True for historically significant Art Deco buildings by famous architects
  architect?: string; // Name of architect if well-known
}

export interface MapViewState {
  center: Coordinates;
  zoom: number;
}