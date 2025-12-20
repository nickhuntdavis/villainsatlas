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
    // Backgrounds - Minimal grayscale, true black
    background: {
      default: 'bg-black',
      surface: 'bg-[#0a0a0a]',
      elevated: 'bg-[#1a1a1a]',
      panel: 'bg-[#0a0a0a]/95',
      overlay: 'bg-black/80',
    },
    // Borders - Very subtle
    border: {
      subtle: 'border-[#2a2a2a]',
      default: 'border-[#2a2a2a]',
      strong: 'border-[#3a3a3a]',
      accent: 'border-[#0066cc]',
    },
    // Text - High contrast for readability
    text: {
      primary: 'text-[#fafafa]',
      secondary: 'text-[#e5e5e5]',
      tertiary: 'text-[#d4d4d4]',
      muted: 'text-[#a3a3a3]',
      disabled: 'text-[#737373]',
      placeholder: 'text-[#737373]',
    },
    // Accent - Single subtle blue accent
    accent: {
      primary: 'text-[#0066cc]',
      hover: 'text-[#0080ff]',
      bg: 'bg-[#0066cc]',
      bgHover: 'hover:bg-[#0080ff]',
      border: 'border-[#0066cc]',
      borderHover: 'border-[#0080ff]',
    },
  },
  light: {
    // Backgrounds - Pure white/off-white
    background: {
      default: 'bg-[#fafafa]',
      surface: 'bg-white',
      elevated: 'bg-white',
      panel: 'bg-white/95',
      overlay: 'bg-white/80',
    },
    // Borders - Very subtle
    border: {
      subtle: 'border-[#e5e5e5]',
      default: 'border-[#e5e5e5]',
      strong: 'border-[#d4d4d4]',
      accent: 'border-[#0066cc]',
    },
    // Text - Dark gray for readability
    text: {
      primary: 'text-[#1a1a1a]',
      secondary: 'text-[#2d2d2d]',
      tertiary: 'text-[#404040]',
      muted: 'text-[#737373]',
      disabled: 'text-[#a3a3a3]',
      placeholder: 'text-[#a3a3a3]',
    },
    // Accent - Single subtle blue accent
    accent: {
      primary: 'text-[#0066cc]',
      hover: 'text-[#0052a3]',
      bg: 'bg-[#0066cc]',
      bgHover: 'hover:bg-[#0052a3]',
      border: 'border-[#0066cc]',
      borderHover: 'border-[#0052a3]',
    },
  },
} as const;

// Helper to get theme colors
export const getThemeColors = (theme: Theme) => colors[theme];

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

// Font families
export const fontFamily = {
  heading: "font-neue-machina",
  body: "font-['Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif]",
  mono: "font-mono",
} as const;

export const typography = {
  // Headings - Neue Machina, regular weight, increased size, tighter line-height
  heading: {
    lg: `${fontFamily.heading} text-5xl font-normal leading-[1.1] tracking-tight`,
    md: `${fontFamily.heading} text-4xl font-normal leading-[1.1] tracking-tight`,
    sm: `${fontFamily.heading} text-3xl font-normal leading-[1.1] tracking-tight`,
  },
  // Body - Inter, larger base size, generous line-height
  body: {
    default: `${fontFamily.body} text-base leading-relaxed`,
    lg: `${fontFamily.body} text-lg leading-relaxed`,
    sm: `${fontFamily.body} text-sm leading-relaxed`,
  },
  // Labels & Badges - Inter, less aggressive
  label: {
    default: `${fontFamily.body} text-sm font-medium`,
    heading: `${fontFamily.heading} text-xl font-normal leading-tight`,
    badge: `${fontFamily.body} text-xs font-medium tracking-wide`,
    button: `${fontFamily.body} text-sm font-medium tracking-wide`,
  },
  // Mono - Keep mono or use Inter
  mono: {
    default: `${fontFamily.body} text-sm font-mono tracking-normal`,
    sm: `${fontFamily.body} text-xs font-mono tracking-normal`,
  },
} as const;

// ============================================================================
// SPACING TOKENS
// ============================================================================

export const spacing = {
  xs: 'p-2',      // 8px
  sm: 'p-4',      // 16px
  md: 'p-6',      // 24px
  lg: 'p-8',      // 32px
  xl: 'p-12',     // 48px
  '2xl': 'p-16',  // 64px
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
  sm: 'shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]',
  md: 'shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_0_rgba(0,0,0,0.06)]',
  lg: 'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]',
  xl: 'shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]',
  '2xl': 'shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)]',
} as const;

// ============================================================================
// BLUR TOKENS
// ============================================================================

// Minimal blur - removed heavy blur effects for clean aesthetic
export const blur = {
  sm: 'backdrop-blur-[2px]',
  md: 'backdrop-blur-[4px]',
  lg: 'backdrop-blur-[8px]',
} as const;

// ============================================================================
// GENRE/STYLE COLORS (from constants.ts)
// ============================================================================

// Re-export genre colors for use in components
// These are hex values, not Tailwind classes
export { GENRE_COLORS } from '../constants';

