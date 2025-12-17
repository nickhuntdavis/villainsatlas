import React from 'react';
import { Theme, getThemeColors } from '../theme';

export interface IconButtonProps {
  theme: Theme;
  onClick: () => void;
  icon: React.ReactNode;
  title?: string;
  disabled?: boolean;
  variant?: 'default' | 'accent' | 'subtle';
  className?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  theme,
  onClick,
  icon,
  title,
  disabled = false,
  variant = 'default',
  className = '',
}) => {
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';

  // Variant-specific classes
  const variantClasses = {
    default: isDark
      ? 'text-zinc-500 hover:text-white border-zinc-800'
      : 'text-zinc-500 hover:text-zinc-900 border-zinc-300',
    accent: isDark
      ? 'text-red-500 hover:text-red-400 hover:bg-zinc-800/50 border-zinc-800'
      : 'text-red-600 hover:text-red-500 hover:bg-red-50 border-zinc-300',
    subtle: isDark
      ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/50 border-zinc-800'
      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 border-zinc-300',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 transition-colors border-r ${variantClasses[variant]} ${className}`}
    >
      {icon}
    </button>
  );
};

