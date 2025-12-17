import React from 'react';
import { Theme, getThemeColors, shadows, blur } from '../theme';

export interface SurfaceCardProps {
  theme: Theme;
  children: React.ReactNode;
  className?: string;
  level?: 'default' | 'elevated' | 'panel';
  withBlur?: boolean;
  withShadow?: boolean;
}

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  theme,
  children,
  className = '',
  level = 'default',
  withBlur = false,
  withShadow = false,
}) => {
  const isDark = theme === 'dark';

  const backgroundClass = {
    default: isDark ? 'bg-zinc-950' : 'bg-white',
    elevated: isDark ? 'bg-zinc-900' : 'bg-zinc-100',
    panel: isDark ? 'bg-zinc-900/90' : 'bg-zinc-100/95',
  }[level];

  const borderClass = isDark ? 'border-zinc-700' : 'border-zinc-300';

  return (
    <div
      className={`${backgroundClass} ${borderClass} ${withBlur ? blur.md : ''} ${withShadow ? shadows['2xl'] : ''} ${className}`}
    >
      {children}
    </div>
  );
};

