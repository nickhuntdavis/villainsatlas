import React, { useState } from 'react';
import { Building, Coordinates } from '../types';
import { X, MapPin, Navigation, ImageOff, User, MessageCircle, ThumbsDown, Bookmark } from 'lucide-react';
import { GENRE_COLORS, normalizeStyles, getPrimaryStyleColor } from '../constants';
import { typography, fontFamily } from '../ui/theme';
import { ImageGallery } from './ImageGallery';

interface BuildingDetailsProps {
  building: Building | null;
  onClose: () => void;
  theme: 'dark' | 'light';
  userLocation?: Coordinates | null;
  onDelete?: () => void;
  onFavourite?: () => void;
}

// Helper function to extract URL from markdown link format [text](url) or just return URL if already plain
const extractUrlFromMarkdown = (urlString: string | undefined): string | undefined => {
  if (!urlString) return undefined;
  
  // Check if it's a markdown link format: [text](url) or [url](url)
  const markdownLinkMatch = urlString.match(/\[([^\]]*)\]\(([^)]+)\)/);
  if (markdownLinkMatch) {
    // Return the URL part (second capture group)
    return markdownLinkMatch[2];
  }
  
  // If not markdown, return as-is
  return urlString;
};

// Helper to calculate distance in meters (Haversine formula)
const getDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Helper to format distance for display
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

export const BuildingDetails: React.FC<BuildingDetailsProps> = ({ building, onClose, theme, userLocation, onDelete, onFavourite }) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state when building changes
  React.useEffect(() => {
    setImgError(false);
  }, [building]);

  if (!building) return null;

  // Get images - prefer imageUrls array, fallback to legacy imageUrl
  const images = building.imageUrls && building.imageUrls.length > 0
    ? building.imageUrls
    : (building.imageUrl ? [extractUrlFromMarkdown(building.imageUrl)].filter(Boolean) as string[] : []);

  // Parse multiple styles (comma-separated) and get primary style color
  const styles = building.style ? normalizeStyles(building.style) : ['Other'];
  const styleColor = getPrimaryStyleColor(building.style);

  return (
    <aside
      className="absolute bottom-0 left-0 w-full md:w-96 md:top-0 md:left-0 md:h-full md:border-t-0 p-0 z-20 flex flex-col transition-all duration-300 ease-in-out h-auto max-h-[calc(100dvh-6rem-40px-1.5rem)] md:max-h-full overflow-y-auto bg-[#020716]"
      aria-label="Building details"
    >
      
      {/* Image Header - edge to edge, no padding */}
      <div className="relative w-full overflow-hidden shrink-0 bg-[#020716] m-0 p-0">
        {images.length > 0 ? (
          <ImageGallery images={images} buildingName={building.name} />
        ) : null}
      </div>

      <div className="p-8 flex flex-col flex-1">
        {building.style && (
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-wrap gap-2">
            {styles.map((style, index) => {
              const normalizedStyle = style;
              const tagColorHex = GENRE_COLORS[normalizedStyle] || GENRE_COLORS['Other'];
              // Convert hex to rgba with 20% opacity
              const hexToRgba = (hex: string, opacity: number) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
              };
              const tagColor = hexToRgba(tagColorHex, 0.2);
              // Display "Love 🤢" instead of "Disgusting"
              const displayText = style === 'Disgusting' ? 'Love 🤢' : style;
              return (
                <div
                  key={index}
                  className="rounded-[4px] px-3 py-1.5 inline-block"
                  style={{ backgroundColor: tagColor }}
                >
                  <span className="text-white text-sm font-medium">{displayText}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-[#010E36] text-[#A382FF] hover:opacity-80 rounded-full transition-colors"
            title="Close"
            aria-label="Close building details"
          >
            <X size={16} className="text-[#A382FF]" aria-hidden="true" />
          </button>
        </div>
        )}
        
        {!building.style && (
          <div className="flex justify-end mb-6">
            <button
              onClick={onClose}
              className="p-2 bg-[#010E36] text-[#A382FF] hover:opacity-80 rounded-full transition-colors"
              title="Close"
              aria-label="Close building details"
            >
              <X size={16} className="text-[#A382FF]" aria-hidden="true" />
            </button>
          </div>
        )}

        <h2 className={`${fontFamily.heading} mb-4 break-words text-white`} style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', lineHeight: '1.1' }}>
          {building.name}
        </h2>

        <div className={`flex items-center mb-4 ${typography.body.sm} text-white`}>
          <MapPin size={16} className="mr-2 text-white" aria-hidden="true" />
          <span className="text-white">{building.location}</span>
        </div>

        {building.architect && (
          <div className={`flex items-center mb-8 ${typography.body.sm} text-white`}>
            <User size={16} className="mr-2 shrink-0 text-white" aria-hidden="true" />
            <span className="text-white">
              Architect: <span className="font-medium">{building.architect}</span>
            </span>
          </div>
        )}

        <div className={`${typography.body.default} mb-8 pl-0`}>
          <p className="leading-relaxed text-white">
            {building.description}
          </p>
        </div>

        <div className="mt-auto space-y-3">
          {/* Message Nick button - only show for Nick */}
          {building.name?.toLowerCase() === 'nick' && (
            <a
              href="https://t.me/ne1080p"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-4 bg-[#0088cc] text-white rounded-[12px] transition-all group hover:opacity-90 font-bold"
              aria-label="Message Nick on Telegram"
            >
              <MessageCircle size={16} className="mr-2 text-white" strokeWidth={2.5} aria-hidden="true" />
              Message Nick
            </a>
          )}
          
          {(() => {
            // Build a strong search query that always includes the building name
            const nameAndLocationQuery = (
              building.name
                ? `${building.name}, ${building.location || `${building.city || ''}, ${building.country || ''}`}`
                : building.location || `${building.city || ''}, ${building.country || ''}`
            )
              .replace(/,\s*,/g, ',')
              .replace(/^,\s*|\s*,$/g, '')
              .trim();

            // Get the best Google Maps URL - prioritize place_id + name, then name+location search, then coordinates
            // Special case: "Nick" always uses coordinates, not POI search
            let mapsUrl: string | undefined = undefined;

            if (building.name?.toLowerCase() === 'nick' && building.coordinates) {
              // For Nick, always use coordinates directly
              mapsUrl = `https://www.google.com/maps?q=${building.coordinates.lat},${building.coordinates.lng}`;
            } else if (building.googlePlaceId) {
              // Best case: We have a place_id for the actual POI - use it with the name
              const cleanPlaceId = building.googlePlaceId.replace(/^places\//, '').trim();
              const placeName = encodeURIComponent(building.name);
              mapsUrl = `https://www.google.com/maps/search/?api=1&query=${placeName}&query_place_id=${cleanPlaceId}`;
            } else if (nameAndLocationQuery) {
              // Fallback: search by building name + location string
              const encodedQuery = encodeURIComponent(nameAndLocationQuery);
              mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
            } else if (building.coordinates) {
              // Last resort: coordinate-based URL (only if we have no other option)
              mapsUrl = `https://www.google.com/maps?q=${building.coordinates.lat},${building.coordinates.lng}`;
            }

            return mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-4 bg-[#A382FF] text-[#020716] rounded-[12px] transition-all group hover:opacity-90 font-bold"
                aria-label={`Show ${building.name} on Google Maps`}
              >
                <Navigation size={16} className="mr-2 text-[#020716]" strokeWidth={2.5} aria-hidden="true" />
                Show on Google Maps
              </a>
            ) : null;
          })()}
        </div>
        
        {/* Estimated Distance */}
        {userLocation && building && (
          <div className="mt-8 pt-6 border-t border-white/20">
            <div className={`${typography.body.sm} text-white flex items-center justify-between`}>
              <div>
                <span className="opacity-70">Estimated distance: </span>
                <span className="font-medium">{formatDistance(getDistance(userLocation, building.coordinates))}</span>
              </div>
              <div className="flex items-center gap-2">
                {onFavourite && (
                  <button
                    onClick={onFavourite}
                    className="p-1.5 hover:opacity-80 transition-opacity"
                    title={building.favourites ? "Remove from favourites" : "Add to favourites"}
                    aria-label={building.favourites ? "Remove from favourites" : "Add to favourites"}
                    style={{ color: building.favourites ? '#FFD700' : '#11162F' }}
                  >
                    <Bookmark size={16} strokeWidth={2} fill={building.favourites ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="p-1.5 hover:opacity-80 transition-opacity"
                    title="Remove this building"
                    aria-label="Remove this building"
                    style={{ color: '#11162F' }}
                  >
                    <ThumbsDown size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Coordinates */}
        <div className={`mt-8 pt-6 border-t border-white/20 ${userLocation ? '' : 'mt-8'}`}>
          <div className={`flex justify-between ${typography.mono.sm} text-white`}>
             <span>Lat: {building.coordinates.lat.toFixed(4)}</span>
             <span>Lng: {building.coordinates.lng.toFixed(4)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};