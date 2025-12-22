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
  CATHEDRAL = 'Cathedral',
  
  // Fallback
  OTHER = 'Other',
  
  // Special Style
  DISGUSTING = 'Disgusting'
}

export interface Comment {
  text: string; // Rich text content
  createdAt: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp if edited
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
  imageUrl?: string; // URL from Google Search (legacy, use imageUrls for multiple images)
  imageUrls?: string[]; // Array of image URLs (from Baserow file fields image_1, image_2, image_3)
  city?: string; // Extracted city name
  country?: string; // Extracted country name
  googlePlaceId?: string; // Google Place ID - use this to construct proper place URLs
  isPrioritized?: boolean; // True for historically significant Art Deco buildings by famous architects
  architect?: string; // Name of architect if well-known
  hasPurpleHeart?: boolean; // True for special romantic locations that get purple glowing hearts
  source?: string; // Source of building entry (e.g., 'manual' for manually added)
  favourites?: boolean; // True if building is marked as a favourite
  comments?: Comment[]; // Array of comments (mapped from comment_1 through comment_6 fields)
}

export interface MapViewState {
  center: Coordinates;
  zoom: number;
}