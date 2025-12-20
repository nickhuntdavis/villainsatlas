import React, { useState, useRef } from 'react';
import { Settings } from 'lucide-react';
import { getThemeColors } from '../ui/theme';

interface AdminToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  theme: 'dark' | 'light';
}

export const AdminToggle: React.FC<AdminToggleProps> = ({ enabled, onToggle, theme }) => {
  const colors = getThemeColors(theme);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = () => {
    clickCountRef.current += 1;

    // Clear existing timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // If double-click detected, toggle
    if (clickCountRef.current === 2) {
      onToggle(!enabled);
      clickCountRef.current = 0;
      return;
    }

    // Reset counter after 500ms if no second click
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 500);
  };

  return (
    <button
      onClick={handleClick}
      className={`absolute z-10 cursor-pointer transition-opacity hover:opacity-20 admin-toggle-button ${
        enabled ? 'opacity-0.3' : 'opacity-0.08'
      }`}
      style={{ 
        width: '12px', 
        height: '12px',
        opacity: enabled ? 0.3 : 0.08
      }}
      title={enabled ? 'Admin mode enabled (double-click to disable)' : 'Double-click to enable admin mode'}
      aria-label={enabled ? 'Admin mode enabled' : 'Enable admin mode'}
    >
      <div className={`w-full h-full rounded-sm ${enabled ? 'bg-[#FF5D88]' : 'bg-white'}`} />
    </button>
  );
};

