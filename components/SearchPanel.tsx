import React, { useState, useEffect } from 'react';
import { Search, Loader2, Locate, Crosshair, Binoculars } from 'lucide-react';
import { SurfaceCard, StatusStrip } from '../ui/atoms';
import { typography, getThemeColors } from '../ui/theme';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  onLocateMe: () => void;
  onFindNearest: () => void;
  onSearchArea: () => void;
  isLoading: boolean;
  searchStatus: 'idle' | 'searching_baserow' | 'searching_gemini';
  statusMessage?: string | null;
  theme: 'dark' | 'light';
  isSidebarOpen?: boolean;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  onLocateMe,
  onFindNearest,
  onSearchArea,
  isLoading,
  searchStatus,
  statusMessage,
  theme,
  isSidebarOpen = false,
}) => {
  const [query, setQuery] = useState('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  // Rotating loading messages
  const loadingMessages = [
    'searching sexy building archives...',
    'searching dark web...',
    'querying evil database...',
    'parsing dark deco...',
    'reticulating splines...',
    'reminding Nastya that Nick loves her...'
  ];
  
  useEffect(() => {
    if (isLoading && searchStatus !== 'idle') {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 1500); // Change message every 1.5 seconds
      
      return () => clearInterval(interval);
    } else {
      setLoadingMessageIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, searchStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const isDark = theme === 'dark';
  const colors = getThemeColors(theme);

  return (
    <div className={`absolute top-6 left-6 right-6 z-10 flex flex-col gap-3 pointer-events-none transition-all duration-300 ${
      isSidebarOpen 
        ? 'md:left-[calc(24rem+1.5rem)] md:right-[3.25rem] md:w-auto md:flex md:items-center' 
        : 'md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto'
    }`}>
      <form onSubmit={handleSubmit} className={`relative group pointer-events-auto ${isSidebarOpen ? 'md:mx-auto md:w-full md:max-w-full' : 'md:w-full'}`} role="search" aria-label="Search for buildings">
        <div className={`relative flex items-center bg-[#282C55] rounded-[16px] pt-3 pb-3 pl-3 overflow-hidden transition-all ${!isSidebarOpen ? 'md:min-w-[720px]' : ''}`} style={{ filter: 'drop-shadow(0 6px 18px #020716)', paddingRight: '24px' }}>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-[#AA8BFF] text-[#010E36] px-3 py-2 rounded-[4px] flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-50"
            style={{ fontSize: '20px' }}
            aria-label={isLoading ? "Searching..." : "Search"}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={18} strokeWidth={2.5} aria-hidden="true" />
            )}
          </button>
          
          <label htmlFor="search-input" className="sr-only">Search for buildings</label>
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent border-none px-3 py-0 text-white focus:outline-none min-w-0 placeholder:text-white"
            disabled={isLoading}
            style={{ fontSize: '16px' }}
            aria-label="Search for buildings"
          />
          
          <button
            type="button"
            onClick={onLocateMe}
            className="flex items-center gap-2 px-0 py-0 transition-colors text-[#CDBAFF] ml-6"
            title="Jump to my location"
            aria-label="Jump to my location"
            style={{ fontSize: '16px' }}
          >
            <Locate size={16} className="text-[#CDBAFF]" aria-hidden="true" />
            <span className="hidden lg:inline uppercase" style={{ fontSize: '12px' }} aria-hidden="true">Me</span>
          </button>
          
          <button
            type="button"
            onClick={onFindNearest}
            className="flex items-center gap-2 px-0 py-0 transition-colors text-[#CDBAFF] ml-6"
            title="Jump to nearest building"
            aria-label="Jump to nearest building"
            style={{ fontSize: '16px' }}
          >
            <Crosshair size={16} className="text-[#CDBAFF]" aria-hidden="true" />
            <span className="hidden lg:inline uppercase" style={{ fontSize: '12px' }} aria-hidden="true">Nearest</span>
          </button>
          
          <button
            type="button"
            onClick={onSearchArea}
            className="flex items-center gap-2 px-0 py-0 transition-colors text-[#CDBAFF] ml-6"
            title="Scan current area"
            aria-label="Scan current area"
            style={{ fontSize: '16px' }}
          >
            <Binoculars size={16} className="text-[#CDBAFF]" aria-hidden="true" />
            <span className="hidden lg:inline uppercase" style={{ fontSize: '12px' }} aria-hidden="true">Scan here</span>
          </button>
        </div>
      </form>
      
      {/* Loading Status Text */}
      <StatusStrip
        theme={theme}
        statusText={isLoading && searchStatus !== 'idle' ? loadingMessages[loadingMessageIndex] : (statusMessage || '')}
        isVisible={(isLoading && searchStatus !== 'idle') || (!!statusMessage && !isLoading)}
      />
    </div>
  );
};