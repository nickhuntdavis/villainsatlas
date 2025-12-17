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

  // Variant-specific classes - more subtle hover states using new color tokens
  const variantClasses = {
    default: isDark
      ? `${colors.text.muted} hover:${colors.text.secondary} ${colors.border.subtle}`
      : `${colors.text.muted} hover:${colors.text.secondary} ${colors.border.subtle}`,
    accent: `${colors.accent.primary} hover:${colors.accent.hover} ${colors.border.subtle}`,
    subtle: `${colors.text.tertiary} hover:${colors.text.primary} ${colors.border.subtle}`,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 transition-colors border-r hover:bg-black/5 dark:hover:bg-white/5 ${variantClasses[variant]} ${className}`}
    >
      {icon}
    </button>
  );
};

