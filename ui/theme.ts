/**
 * Design System Theme & Tokens
 * 
 * Central source of truth for all design tokens (colors, typography, spacing, etc.)
 * Used by atoms, molecules, and organisms to maintain consistent styling.
 */

export type Theme = 'dark' | 'light';

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const colors = {
  dark: {
    // Backgrounds
    background: {
      default: 'bg-black',
      surface: 'bg-zinc-950',
      elevated: 'bg-zinc-900',
      panel: 'bg-zinc-900/90',
      overlay: 'bg-black/80',
    },
    // Borders
    border: {
      subtle: 'border-zinc-800',
      default: 'border-zinc-700',
      strong: 'border-zinc-600',
      accent: 'border-red-900',
    },
    // Text
    text: {
      primary: 'text-white',
      secondary: 'text-zinc-100',
      tertiary: 'text-zinc-300',
      muted: 'text-zinc-500',
      disabled: 'text-zinc-600',
      placeholder: 'text-zinc-500',
    },
    // Accent (primary highlight in dark mode)
    accent: {
      primary: 'text-red-500',
      hover: 'text-red-400',
      // Background utilities for primary accent surfaces/buttons
      bg: 'bg-[#111113]',
      bgHover: 'hover:bg-red-900/80',
      border: 'border-red-900',
      borderHover: 'border-red-600',
    },
  },
  light: {
    // Backgrounds
    background: {
      default: 'bg-zinc-100',
      surface: 'bg-white',
      elevated: 'bg-zinc-100',
      panel: 'bg-zinc-100/95',
      overlay: 'bg-white/80',
    },
    // Borders
    border: {
      subtle: 'border-zinc-200',
      default: 'border-zinc-300',
      strong: 'border-zinc-400',
      accent: 'border-red-500',
    },
    // Text
    text: {
      primary: 'text-zinc-900',
      secondary: 'text-zinc-800',
      // Slightly deepen tertiary text to better match updated light-theme body copy
      tertiary: 'text-zinc-950',
      muted: 'text-zinc-600',
      disabled: 'text-zinc-500',
      placeholder: 'text-zinc-400',
    },
    // Accent (primary action / highlight)
    accent: {
      primary: 'text-red-600',
      hover: 'text-red-500',
      // Updated to match style guide preview swatch
      bg: 'bg-[#dd2c6a]',
      bgHover: 'hover:bg-[#c21954]',
      border: 'border-red-500',
      borderHover: 'border-red-400',
    },
  },
} as const;

// Helper to get theme colors
export const getThemeColors = (theme: Theme) => colors[theme];

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const typography = {
  // Headings
  heading: {
    lg: 'text-3xl font-black uppercase tracking-tighter',
    md: 'text-2xl font-black uppercase tracking-tight',
    sm: 'text-xl font-bold uppercase tracking-wide',
  },
  // Body
  body: {
    default: 'text-sm',
    lg: 'text-base',
    sm: 'text-xs',
  },
  // Labels & Badges
  label: {
    badge: 'text-[10px] font-bold uppercase tracking-[0.2em]',
    button: 'text-xs font-bold tracking-wider uppercase',
  },
  // Mono (for system/terminal text)
  mono: {
    default: 'font-mono text-xs uppercase tracking-widest',
    sm: 'font-mono text-[10px] uppercase tracking-wider',
  },
} as const;

// ============================================================================
// SPACING TOKENS
// ============================================================================

export const spacing = {
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
  xl: 'p-6',
  '2xl': 'p-8',
} as const;

// ============================================================================
// RADIUS TOKENS
// ============================================================================

export const radius = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const;

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
} as const;

// ============================================================================
// BLUR TOKENS
// ============================================================================

export const blur = {
  sm: 'backdrop-blur-sm',
  md: 'backdrop-blur-md',
  lg: 'backdrop-blur-lg',
} as const;

// ============================================================================
// GENRE/STYLE COLORS (from constants.ts)
// ============================================================================

// Re-export genre colors for use in components
// These are hex values, not Tailwind classes
export { GENRE_COLORS } from '../constants';

