import React, { useState, useEffect } from 'react';
import { Search, Loader2, Locate, Crosshair, MapPin, SunMedium, Moon } from 'lucide-react';
import { IconButton, PrimaryButton, SurfaceCard, StatusStrip } from '../ui/atoms';
import { typography, getThemeColors } from '../ui/theme';

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
  const colors = getThemeColors(theme);

  return (
    <div className="absolute top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-10 w-auto md:min-w-[720px] flex flex-col gap-2 pointer-events-none">
      <form onSubmit={handleSubmit} className="relative group pointer-events-auto">
        <div className="absolute inset-0 bg-red-900/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <SurfaceCard
          theme={theme}
          level="panel"
          withBlur
          withShadow
          className="relative flex items-center rounded-lg p-1 overflow-hidden focus-within:ring-1 transition-all"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ENTER SECTOR / CITY..."
            className={`flex-1 bg-transparent border-none px-4 py-3 ${typography.mono.default} focus:outline-none min-w-0 ${
              isDark
                ? 'text-zinc-100 placeholder-zinc-500'
                : 'text-zinc-900 placeholder-zinc-400'
            }`}
            disabled={isLoading}
          />
          
          <IconButton
            theme={theme}
            onClick={onLocateMe}
            icon={<Locate size={18} />}
            title="Scan Current Sector"
            variant="default"
          />
          
          <button
            type="button"
            onClick={onSearchArea}
            className={`flex items-center gap-2 px-3 py-2 transition-colors border-r ${typography.label.button} ${
              isDark
                ? 'text-red-500 hover:text-red-400 hover:bg-zinc-800/50 border-zinc-800'
                : 'text-red-600 hover:text-red-500 hover:bg-red-50 border-zinc-300'
            }`}
            title="Target Visible Area"
          >
            <MapPin size={16} className={colors.accent.primary} />
            <span className={`hidden sm:inline ${colors.accent.primary}`}>Here</span>
          </button>
          
          <button
            type="button"
            onClick={onFindNearest}
            className={`flex items-center gap-2 px-3 py-2 transition-colors border-r ${typography.label.button} ${
              isDark
                ? 'text-red-500 hover:text-red-400 hover:bg-zinc-800/50 border-zinc-800'
                : 'text-red-600 hover:text-red-500 hover:bg-red-50 border-zinc-300'
            }`}
            title="Target Nearest Lair"
          >
            <Crosshair size={16} className={colors.accent.primary} />
            <span className="hidden sm:inline">Nearest</span>
          </button>

          <IconButton
            theme={theme}
            onClick={onToggleTheme}
            icon={isDark ? <SunMedium size={16} /> : <Moon size={16} />}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            variant="subtle"
            className="px-3 py-2"
          />

          <PrimaryButton
            theme={theme}
            type="submit"
            disabled={isLoading}
            className="ml-1"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
          </PrimaryButton>
        </SurfaceCard>
      </form>
      
      {/* Loading Status Text */}
      <StatusStrip
        theme={theme}
        statusText={loadingMessages[loadingMessageIndex]}
        isVisible={isLoading && searchStatus !== 'idle'}
      />
    </div>
  );
};