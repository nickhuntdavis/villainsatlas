import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { SurfaceCard, StatusStrip } from '../ui/atoms';
import { typography, getThemeColors } from '../ui/theme';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchStatus: 'idle' | 'searching_baserow' | 'searching_gemini';
  statusMessage?: string | null;
  theme: 'dark' | 'light';
  isSidebarOpen?: boolean;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  isLoading,
  searchStatus,
  statusMessage,
  theme,
  isSidebarOpen = false,
}) => {
  const [query, setQuery] = useState('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [shuffledMessages, setShuffledMessages] = useState<string[]>([]);
  
  // All loading messages
  const allLoadingMessages = [
    'Evaluating Beauty Thresholds...',
    'Rasterising City Skeletons...',
    'Calibrating Monumental Mass...',
    'Scanning for Structural Arrogance...',
    'Resolving Decorative Excess...',
    'Detecting Overengineered Confidence...',
    'Sorting Slavic Sensibilities...',
    'Cross-Referencing Vibes...',
    'Reminding Nastya the Nick is crazy about her',
    'No really, Nick like "like" likes Nastya...',
    'Consulting the Lore...',
    'Reticulating Splines...',
    'Inverting Aesthetic Expectations...',
    'Searching building archives...',
    'Scraping Dark Web...'
  ];
  
  // Shuffle messages when loading starts
  useEffect(() => {
    if (isLoading && searchStatus !== 'idle') {
      // Keep the Nastya messages together as a pair
      const nastyaPair = [
        'Reminding Nastya the Nick is crazy about her',
        'No really, Nick like "like" likes Nastya'
      ];
      
      // Get all other messages (excluding the Nastya pair)
      const otherMessages = allLoadingMessages.filter(
        msg => !nastyaPair.includes(msg)
      );
      
      // Shuffle other messages using Fisher-Yates algorithm
      for (let i = otherMessages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherMessages[i], otherMessages[j]] = [otherMessages[j], otherMessages[i]];
      }
      
      // Insert the Nastya pair at a random position
      const insertPosition = Math.floor(Math.random() * (otherMessages.length + 1));
      const shuffled = [
        ...otherMessages.slice(0, insertPosition),
        ...nastyaPair,
        ...otherMessages.slice(insertPosition)
      ];
      
      setShuffledMessages(shuffled);
      setLoadingMessageIndex(0);
    } else {
      setLoadingMessageIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, searchStatus]);
  
  useEffect(() => {
    if (isLoading && searchStatus !== 'idle' && shuffledMessages.length > 0) {
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % shuffledMessages.length);
      }, 2500); // Change message every 2.5 seconds (longer than before)
      
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, searchStatus, shuffledMessages.length]);

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
        ? 'md:left-[calc(24rem+1.5rem)] md:right-6 md:flex md:items-center md:justify-center' 
        : 'md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto'
    }`}>
      <form onSubmit={handleSubmit} className="relative group pointer-events-auto w-full md:max-w-[480px]" role="search" aria-label="Search for buildings">
        <div 
          className="relative flex items-center justify-between bg-[#282C55] rounded-[10px] pl-4 pr-2 transition-all"
          style={{ 
            boxShadow: '0px 1px 29px 0px rgba(1,10,36,0.3)',
            height: '48px',
            width: '480px',
            maxWidth: '100%'
          }}
        >
          <label htmlFor="search-input" className="sr-only">Search for buildings</label>
          <input
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any place..."
            className="flex-1 bg-transparent border-none text-white focus:outline-none min-w-0 placeholder:text-white"
            disabled={isLoading}
            style={{ 
              fontSize: '16px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}
            aria-label="Search for buildings"
          />
          
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center p-3 rounded-[10px] transition-all hover:opacity-90 disabled:opacity-50"
            aria-label={isLoading ? "Searching..." : "Search"}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin text-white" aria-hidden="true" />
            ) : (
              <Search size={20} className="text-white" strokeWidth={2.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
      
      {/* Loading Status Text */}
      <StatusStrip
        theme={theme}
        statusText={isLoading && searchStatus !== 'idle' && shuffledMessages.length > 0 ? shuffledMessages[loadingMessageIndex] : (statusMessage || '')}
        isVisible={(isLoading && searchStatus !== 'idle') || (!!statusMessage && !isLoading)}
      />
    </div>
  );
};