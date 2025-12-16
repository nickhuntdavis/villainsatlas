import React, { useState } from 'react';
import { Building } from '../types';
import { X, MapPin, Navigation, ImageOff } from 'lucide-react';
import { GENRE_COLORS, normalizeStyle } from '../constants';

interface BuildingDetailsProps {
  building: Building | null;
  onClose: () => void;
  theme: 'dark' | 'light';
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

export const BuildingDetails: React.FC<BuildingDetailsProps> = ({ building, onClose, theme }) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state when building changes
  React.useEffect(() => {
    setImgError(false);
  }, [building]);

  if (!building) return null;
  
  const isDark = theme === 'dark';

  // Extract clean image URL (handle markdown format)
  const cleanImageUrl = extractUrlFromMarkdown(building.imageUrl);

  const normalizedStyle = building.style ? normalizeStyle(building.style) : 'Other';
  const styleColor = GENRE_COLORS[normalizedStyle] || GENRE_COLORS['Other'];

  return (
    <div
      className={`absolute bottom-0 left-0 w-full md:w-96 md:top-0 md:left-0 md:h-full md:border-r border-t md:border-t-0 backdrop-blur-sm p-0 z-20 flex flex-col shadow-2xl transition-all duration-300 ease-in-out h-auto max-h-[85vh] md:max-h-full overflow-y-auto custom-scrollbar
        ${
          isDark
            ? 'border-zinc-800 bg-zinc-950/95'
            : 'border-zinc-200 bg-white/95'
        }
      `}
    >
      
      {/* Image Header */}
      <div className={`relative w-full overflow-hidden shrink-0 ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
        {cleanImageUrl && !imgError ? (
          <div className="relative w-full h-full group">
             <img 
              src={cleanImageUrl}
              alt={building.name}
              className={`w-full h-auto max-h-[32rem] object-contain contrast-125 group-hover:grayscale-0 transition-all duration-700 ease-out ${
                isDark ? 'grayscale' : ''
              }`}
              onError={(e) => {
                console.warn('Image failed to load:', cleanImageUrl, e);
                setImgError(true);
              }}
            />
            <div
              className={`absolute inset-0 bg-gradient-to-t opacity-90 ${
                isDark
                  ? 'from-zinc-950 via-transparent to-transparent'
                  : 'from-white via-transparent to-transparent'
              }`}
            ></div>
          </div>
        ) : (
          <div
            className={`w-full h-full flex flex-col items-center justify-center pattern-grid-lg ${
              isDark ? 'text-zinc-700 bg-zinc-900' : 'text-zinc-400 bg-zinc-100'
            }`}
          >
             <ImageOff size={32} className="mb-2 opacity-50" />
             <span className="text-xs font-mono uppercase tracking-widest opacity-50">Visuals Classified</span>
          </div>
        )}
        
        <button 
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 backdrop-blur-md rounded-full transition-colors z-10 border ${
            isDark
              ? 'bg-black/50 hover:bg-black/80 text-zinc-300 hover:text-white border-white/10'
              : 'bg-white/80 hover:bg-white text-zinc-700 hover:text-black border-zinc-200'
          }`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-6 flex flex-col flex-1">
        {building.style && (
          <div className="flex justify-between items-start mb-4">
            <span 
              className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-1 rounded-sm border ${
                isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-100 border-zinc-300'
              }`}
              style={{ color: styleColor }}
            >
              {building.style}
            </span>
          </div>
        )}

        <h2
          className={`text-3xl font-black mb-2 uppercase tracking-tighter leading-none break-words ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}
        >
          {building.name}
        </h2>

        <div
          className={`flex items-center mb-6 text-sm ${
            isDark ? 'text-zinc-500' : 'text-zinc-600'
          }`}
        >
          <MapPin size={14} className="mr-1" />
          <span className="uppercase tracking-wide text-xs">{building.location}</span>
        </div>

        <div
          className={`prose prose-sm mb-8 border-l-2 pl-4 ${
            isDark ? 'prose-invert border-zinc-800' : 'border-zinc-200'
          }`}
        >
          <p
            className={`leading-relaxed italic text-sm ${
              isDark ? 'text-zinc-300' : 'text-zinc-700'
            }`}
          >
            "{building.description}"
          </p>
        </div>

        <div className="mt-auto space-y-3">
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
            let mapsUrl: string | undefined = undefined;

            if (building.googlePlaceId) {
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
                className={`flex items-center justify-center w-full py-3 uppercase text-xs font-bold tracking-widest transition-all group border
                  ${
                    isDark
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 hover:border-zinc-400'
                  }
                `}
              >
                <Navigation size={14} className="mr-2 group-hover:text-red-500" />
                Verify Intel (Google Maps)
              </a>
            ) : null;
          })()}
        </div>
        
        {/* Decorative Elements for Vibe */}
        <div
          className={`mt-8 pt-6 border-t ${
            isDark ? 'border-zinc-900' : 'border-zinc-200'
          }`}
        >
          <div
            className={`flex justify-between text-[10px] font-mono uppercase ${
              isDark ? 'text-zinc-600' : 'text-zinc-500'
            }`}
          >
             <span>Lat: {building.coordinates.lat.toFixed(4)}</span>
             <span>Lng: {building.coordinates.lng.toFixed(4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};