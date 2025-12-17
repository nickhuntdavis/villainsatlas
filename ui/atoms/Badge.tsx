import React from 'react';
import { Theme, getThemeColors, typography } from '../theme';

export interface BadgeProps {
  theme: Theme;
  children: React.ReactNode;
  color?: string; // Hex color for custom styling (e.g., genre colors)
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  theme,
  children,
  color,
  className = '',
}) => {
  const colors = getThemeColors(theme);

  const backgroundClass = colors.background.elevated;
  const borderClass = colors.border.subtle;

  return (
    <span
      className={`${typography.label.badge} ${backgroundClass} ${borderClass} px-3 py-1.5 rounded-md border ${className}`}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
};

