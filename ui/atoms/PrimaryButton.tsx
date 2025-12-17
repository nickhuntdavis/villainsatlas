import React from 'react';
import { Theme, getThemeColors, typography } from '../theme';

export interface PrimaryButtonProps {
  theme: Theme;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  theme,
  onClick,
  type = 'button',
  disabled = false,
  children,
  className = '',
  fullWidth = false,
}) => {
  const colors = getThemeColors(theme);

  const baseClasses = `${colors.accent.bg} ${colors.accent.bgHover} text-white ${typography.label.button}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 transition-colors rounded-md ${fullWidth ? 'w-full' : ''} ${baseClasses} ${className}`}
    >
      {children}
    </button>
  );
};

