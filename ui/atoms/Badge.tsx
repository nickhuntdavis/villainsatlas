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
  const isDark = theme === 'dark';

  const backgroundClass = isDark ? 'bg-zinc-900' : 'bg-zinc-100';
  const borderClass = isDark ? 'border-zinc-700' : 'border-zinc-300';

  return (
    <span
      className={`${typography.label.badge} ${backgroundClass} ${borderClass} px-2 py-1 rounded-sm border ${className}`}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
};

