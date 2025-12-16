import React, { useState, useEffect } from 'react';
import { Search, Loader2, Locate, Crosshair, MapPin, SunMedium, Moon } from 'lucide-react';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  onLocateMe: () => void;
  onFindNearest: () => void;
  onSearchArea: () => void;
  isLoading: boolean;
  searchStatus: 'idle' | 'searching_baserow' | 'searching_gemini';
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  onLocateMe,
  onFindNearest,
  onSearchArea,
  isLoading,
  searchStatus,
  theme,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  // Rotating loading messages
  const loadingMessages = [
    'searching evil archives...',
    'searching dark web...',
    'querying evil database...',
    'parsing dark deco...',
    'reticulating splines...',
    'remind nastya that nick loves her'
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

  return (
    <div className="absolute top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-10 w-auto md:min-w-[720px] flex flex-col gap-2 pointer-events-none">
      <form onSubmit={handleSubmit} className="relative group pointer-events-auto">
        <div className="absolute inset-0 bg-red-900/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div
          className={`relative flex items-center backdrop-blur-md rounded-lg shadow-2xl p-1 overflow-hidden focus-within:ring-1 transition-all border
            ${
              isDark
                ? 'bg-zinc-900/90 border-zinc-700 focus-within:ring-red-900 focus-within:border-red-900'
                : 'bg-zinc-100/95 border-zinc-300 focus-within:ring-red-500 focus-within:border-red-500'
            }
          `}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ENTER SECTOR / CITY..."
            className={`flex-1 bg-transparent border-none px-4 py-3 text-sm font-mono uppercase tracking-wider focus:outline-none min-w-0
              ${
                isDark
                  ? 'text-zinc-100 placeholder-zinc-500'
                  : 'text-zinc-900 placeholder-zinc-400'
              }
            `}
            disabled={isLoading}
          />
          
          <button
            type="button"
            onClick={onLocateMe}
            className={`p-2 transition-colors border-r ${
              isDark
                ? 'text-zinc-500 hover:text-white border-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 border-zinc-300'
            }`}
            title="Scan Current Sector"
          >
            <Locate size={18} />
          </button>
          
          <button
            type="button"
            onClick={onSearchArea}
            className={`flex items-center gap-2 px-3 py-2 transition-colors border-r text-xs font-bold tracking-wider uppercase
              ${
                isDark
                  ? 'text-red-500 hover:text-red-400 hover:bg-zinc-800/50 border-zinc-800'
                  : 'text-red-600 hover:text-red-500 hover:bg-red-50 border-zinc-300'
              }
            `}
            title="Target Visible Area"
          >
            <MapPin size={16} />
            <span className="hidden sm:inline">Here</span>
          </button>
          
          <button
            type="button"
            onClick={onFindNearest}
            className={`flex items-center gap-2 px-3 py-2 transition-colors border-r text-xs font-bold tracking-wider uppercase
              ${
                isDark
                  ? 'text-red-500 hover:text-red-400 hover:bg-zinc-800/50 border-zinc-800'
                  : 'text-red-600 hover:text-red-500 hover:bg-red-50 border-zinc-300'
              }
            `}
            title="Target Nearest Lair"
          >
            <Crosshair size={16} />
            <span className="hidden sm:inline">Nearest</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className={`px-3 py-2 flex items-center justify-center text-xs font-bold tracking-wider uppercase transition-colors border-r
              ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border-zinc-800'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 border-zinc-300'
              }
            `}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunMedium size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className={`p-3 transition-colors rounded-md ml-1 ${
              isDark
                ? 'bg-zinc-800 hover:bg-red-900/80 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
          </button>
        </div>
      </form>
      
      {/* Loading Status Text */}
      {isLoading && searchStatus !== 'idle' && (
        <div className="pointer-events-auto mt-2 text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-red-500/80">
            {loadingMessages[loadingMessageIndex]}
          </p>
        </div>
      )}
    </div>
  );
};