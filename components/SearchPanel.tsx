import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { SurfaceCard, StatusStrip } from '../ui/atoms';
import { typography, getThemeColors } from '../ui/theme';
import { Building } from '../types';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchStatus: 'idle' | 'searching_baserow' | 'searching_gemini';
  statusMessage?: string | null;
  theme: 'dark' | 'light';
  isSidebarOpen?: boolean;
  allBuildings?: Building[];
  onSelectBuilding?: (building: Building) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  isLoading,
  searchStatus,
  statusMessage,
  theme,
  isSidebarOpen = false,
  allBuildings = [],
  onSelectBuilding,
}) => {
  const [query, setQuery] = useState('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [shuffledMessages, setShuffledMessages] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Building[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
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

  // Check if keyboard hint has been shown before
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hintSeen = window.localStorage.getItem('evil-atlas-autosuggest-hint-seen');
      if (!hintSeen) {
        setShowKeyboardHint(true);
      }
    }
  }, []);

  // Debounced filtering function for autosuggest
  const filterSuggestions = useCallback((searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filtered = allBuildings
      .filter((building) => {
        // Only show buildings with a name field
        if (!building.name || building.name.trim() === '') {
          return false;
        }
        // Case-insensitive search
        return building.name.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 5); // Limit to 5 results

    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedIndex(-1);
    
    // Show keyboard hint on first autosuggest interaction
    if (filtered.length > 0 && showKeyboardHint && typeof window !== 'undefined') {
      const hintSeen = window.localStorage.getItem('evil-atlas-autosuggest-hint-seen');
      if (!hintSeen) {
        // Hide hint after 5 seconds
        setTimeout(() => {
          setShowKeyboardHint(false);
          window.localStorage.setItem('evil-atlas-autosuggest-hint-seen', 'true');
        }, 5000);
      } else {
        setShowKeyboardHint(false);
      }
    }
  }, [allBuildings, showKeyboardHint]);

  // Debounce the filtering
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      filterSuggestions(query);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, filterSuggestions]);

  // Hide suggestions when search is submitted or loading
  useEffect(() => {
    if (isLoading) {
      setShowSuggestions(false);
    }
  }, [isLoading]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      onSearch(query);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSelectSuggestion = (building: Building) => {
    setQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
    if (onSelectBuilding) {
      onSelectBuilding(building);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSubmit(e as any);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      case 'Tab':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
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
            ref={inputRef}
            id="search-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search any place..."
            className="flex-1 bg-transparent border-none text-white focus:outline-none min-w-0 placeholder:text-white"
            disabled={isLoading}
            style={{ 
              fontSize: '16px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}
            role="combobox"
            aria-label="Search for buildings"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls="suggestions-list"
            aria-haspopup="listbox"
            aria-activedescendant={selectedIndex >= 0 ? `suggestion-${suggestions[selectedIndex]?.id}` : undefined}
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
        
        {/* Keyboard Navigation Hint */}
        {showSuggestions && suggestions.length > 0 && showKeyboardHint && (
          <div className="absolute top-full left-0 right-0 mt-1 px-4 py-1.5 pointer-events-none z-45">
            <p 
              className="text-[#AA8BFF]/60 text-xs"
              style={{
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Use ↑↓ to navigate, Enter to select
            </p>
          </div>
        )}

        {/* Autosuggest Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            id="suggestions-list"
            className="absolute top-full left-0 right-0 mt-1 bg-[#282C55] rounded-[10px] shadow-lg border border-[#3A3F6B] overflow-hidden z-50"
            style={{
              marginTop: showKeyboardHint ? '2.5rem' : '0.25rem',
              boxShadow: '0px 4px 20px 0px rgba(1,10,36,0.4)',
              maxHeight: '300px',
              overflowY: 'auto'
            }}
            role="listbox"
            aria-label="Building suggestions"
          >
            {suggestions.map((building, index) => {
              const locationText = building.city && building.country
                ? `${building.city}, ${building.country}`
                : building.location || 'Unknown Location';
              
              // Extract first style if comma-separated
              const firstStyle = building.style ? building.style.split(',')[0].trim() : null;
              const countryCode = building.country || null;
              
              return (
                <button
                  key={building.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(building)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selectedIndex === index
                      ? 'bg-[#3A3F6B] text-white'
                      : 'bg-[#282C55] text-white hover:bg-[#3A3F6B]'
                  }`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  id={`suggestion-${building.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div 
                        className="font-medium text-white truncate"
                        style={{ 
                          fontSize: '16px',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500
                        }}
                      >
                        {building.name}
                      </div>
                      <div 
                        className="text-[#BAB2CF] text-sm truncate mt-0.5"
                        style={{ 
                          fontSize: '14px',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      >
                        {locationText}
                      </div>
                    </div>
                    {(firstStyle || countryCode) && (
                      <div 
                        className="text-[#AA8BFF]/60 text-xs whitespace-nowrap flex items-center gap-1.5"
                        style={{ 
                          fontSize: '12px',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      >
                        {firstStyle && <span>{firstStyle}</span>}
                        {firstStyle && countryCode && <span>·</span>}
                        {countryCode && <span>{countryCode}</span>}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
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