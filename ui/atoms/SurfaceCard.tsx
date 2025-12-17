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
  const colors = getThemeColors(theme);

  const backgroundClass = colors.background[level];
  const borderClass = colors.border.subtle;

  return (
    <div
      className={`${backgroundClass} border ${borderClass} ${withBlur ? blur.sm : ''} ${withShadow ? shadows.md : ''} ${className}`}
    >
      {children}
    </div>
  );
};

