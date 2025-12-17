## UI Style & Design Overview

This document describes the design system structure and how UI is styled in code. The application now uses a **design system** with tokens, atoms, molecules, and organisms, while preserving all application logic and data behavior.

---

## 1. Tech Stack & Styling Approach

- **Framework**: React + Vite.
- **Design System**: Tokens → Atoms → Molecules → Organisms architecture.
- **Styling**:
  - **Tokens**: Central theme/tokens module (`ui/theme.ts`) defines all colors, typography, spacing, shadows, and blur values.
  - **Atoms**: Reusable UI components (`ui/atoms/`) like `IconButton`, `PrimaryButton`, `SurfaceCard`, `Badge`, `MarkerIcon`, `StatusStrip`.
  - **Molecules**: Composed components (`components/`) like `SearchPanel`, `BuildingDetails` that use atoms.
  - **Organisms**: Top-level components (`App`, `Map`) that orchestrate molecules.
  - Theme handled in React state and persisted to `localStorage`, with a `data-theme` attribute on `<html>`.
- **Icons**: `lucide-react` (e.g. `Search`, `Locate`, `Crosshair`, `MapPin`, `Navigation`, `Heart`, `SunMedium`, `Moon`).

All styling now flows from tokens through atoms to molecules/organisms, ensuring consistency and making global style changes easy.

---

## 2. Theme Model (Dark / Light)

### State & Persistence

- Theme state lives in `App.tsx`:
  - `theme: 'dark' | 'light'`.
  - Initialized from `localStorage.getItem('evil-atlas-theme')` (defaults to `'dark'`).
  - On change:
    - Writes to `localStorage`.
    - Sets `document.documentElement.dataset.theme = theme` (for future CSS hooks).

### Map Tiles

- Defined in `constants.ts`:

  - `MAP_TILE_URL_DARK`  
    - CartoDB Dark Matter tiles (current villain aesthetic).
  - `MAP_TILE_URL_LIGHT`  
    - Standard OpenStreetMap tiles.
  - `MAP_TILE_URL` kept as an alias for backward compatibility but the map now uses the explicit dark/light URLs.

- `components/Map.tsx`:
  - Receives `theme` as a prop.
  - Chooses tile URL:
    - Dark → `MAP_TILE_URL_DARK`.
    - Light → `MAP_TILE_URL_LIGHT`.
  - Background:
    - Dark → `bg-zinc-950`.
    - Light → `bg-zinc-100`.

### Global Background

- In `App.tsx`, the root wrapper:
  - Dark → `bg-black`.
  - Light → `bg-zinc-100`.

---

## 3. Color & Typography Tokens (Implicit)

Currently encoded as utility classes; these will become **design tokens** in a future system.

### Core Colors

- **Backgrounds**:
  - Dark: `bg-black`, `bg-zinc-950`, `bg-zinc-900`.
  - Light: `bg-white`, `bg-zinc-100`, `bg-zinc-200`.
- **Borders**:
  - Dark: `border-zinc-700`, `border-zinc-800`, `border-zinc-900`, `border-white/10`.
  - Light: `border-zinc-200`, `border-zinc-300`, `border-zinc-400`.
- **Text**:
  - Dark: `text-white`, `text-zinc-100`, `text-zinc-300`, `text-zinc-500`, `text-zinc-600`, `text-zinc-700`.
  - Light: `text-zinc-900`, `text-zinc-800`, `text-zinc-700`, `text-zinc-600`, `text-zinc-500`, `text-zinc-400`.
- **Accent / Status**:
  - Primary accent: red scale (`text-red-500`, `hover:text-red-400`, `bg-red-600`, `hover:bg-red-700`, `border-red-900`, `focus-within:ring-red-900`, etc.).
  - Additional accent: emerald/green only in genre colors (see below), not in core UI.

### Genre / Style Colors

- In `constants.ts`, `GENRE_COLORS` maps normalized architectural styles to hex colors:
  - Reds for Soviet/Totalitarian styles, grays for Brutalism, silvers for Deco, dark reds/browns for Gothic, greens for Cyberpunk/Dystopian, etc.
  - `BuildingMarker` and `BuildingDetails` use these colors to reinforce architectural style visually.

### Typography

- Fonts:
  - Default sans from Tailwind for body text.
  - `font-mono` is used extensively for UI chrome, coordinates, system messages, and “terminal / scanner” vibes.
- Weight & case:
  - Titles: `text-3xl font-black uppercase` (e.g. building names, app title).
  - Labels & badges: `text-[10px] font-bold uppercase tracking-[0.2em]`.
  - System text: `text-xs font-mono uppercase tracking-widest`.

These typography patterns should become **type styles** in the design system (e.g. `heading-lg`, `label-badge`, `meta-mono-xs`).

---

## 4. Components by Atomic Level

### 4.1 Design System (Tokens & Theme)

**Location**: `ui/theme.ts`

- **Tokens**:
  - Colors: `colors.dark` and `colors.light` objects with `background`, `border`, `text`, and `accent` properties.
  - Typography: `typography.heading`, `typography.body`, `typography.label`, `typography.mono` with predefined scales.
  - Spacing: `spacing` object with `xs`, `sm`, `md`, `lg`, `xl`, `2xl`.
  - Radii: `radius` object with `none`, `sm`, `md`, `lg`, `full`.
  - Shadows: `shadows` object with `sm`, `md`, `lg`, `xl`, `2xl`.
  - Blur: `blur` object with `sm`, `md`, `lg`.
  - Genre colors: Re-exported `GENRE_COLORS` from `constants.ts` for architectural style colors.
- **Theme**:
  - Type: `Theme = 'dark' | 'light'`.
  - Helper: `getThemeColors(theme)` returns the appropriate color object for the theme.
  - Theme is passed as a prop to all atoms and molecules.

### 4.2 Atoms

**Location**: `ui/atoms/`

These are the smallest reusable UI building blocks:

- **IconButton** (`IconButton.tsx`):
  - Icon-only button with theme support.
  - Variants: `default`, `accent`, `subtle`.
  - Props: `theme`, `onClick`, `icon`, `title`, `disabled`, `variant`, `className`.
- **PrimaryButton** (`PrimaryButton.tsx`):
  - Main action button (e.g., search submit).
  - Props: `theme`, `onClick`, `type`, `disabled`, `children`, `fullWidth`, `className`.
- **SurfaceCard** (`SurfaceCard.tsx`):
  - Generic panel/container with themed background, border, optional blur and shadow.
  - Levels: `default`, `elevated`, `panel`.
  - Props: `theme`, `children`, `level`, `withBlur`, `withShadow`, `className`.
- **Badge** (`Badge.tsx`):
  - Small label/badge for style tags, prioritized indicators, etc.
  - Supports custom color (hex) for genre/style colors.
  - Props: `theme`, `children`, `color`, `className`.
- **MarkerIcon** (`MarkerIcon.tsx`):
  - Factory function `createMarkerIcon()` that returns a Leaflet `divIcon`.
  - Variants: `standard` (rotated square pin) or `nick` (red heart).
  - Props: `color` (hex), `isSelected`, `variant`.
  - Size: `24px` normal, `32px` selected.
- **StatusStrip** (`StatusStrip.tsx`):
  - Loading/status message display with mono typography.
  - Props: `theme`, `statusText`, `isVisible`.

All atoms accept a `theme` prop and use tokens from `ui/theme.ts` for consistent styling.

### 4.3 Molecules

#### Search Panel (`components/SearchPanel.tsx`)

- **Composition**: Uses `SurfaceCard`, `IconButton`, `PrimaryButton`, `StatusStrip` atoms.
- **Structure**:
  - Text input with theme-aware placeholder colors.
  - `IconButton` for locate action.
  - Text buttons for "Here" and "Nearest" (using typography tokens).
  - `IconButton` for theme toggle.
  - `PrimaryButton` for search submit.
  - `StatusStrip` for loading messages.
- **Styling**: All visual styling comes from atoms and tokens; no inline color classes.

#### Building Marker (`components/BuildingMarker.tsx`)

- **Composition**: Uses `createMarkerIcon()` atom factory.
- **Functionality**:
  - Encapsulates marker icon creation via design system.
  - Handles selection state and map fly-to animation.
  - Determines color from genre/style or prioritized status.
  - Detects "Nick" variant for heart icon.

### 4.4 Organisms

#### Map (`components/Map.tsx`)

- **Composition**: Uses `getThemeColors()` for background styling.
- **Functionality**:
  - `MapContainer` with dark/light tile choice (from constants).
  - `MapUpdater` for smooth fly-to on center change.
  - `MapBoundsTracker` to expose bounds back to `App` for "Here" searches.
  - Renders all `BuildingMarker` molecules for current `buildings` state.
- **Styling**: Background color from theme tokens.

#### Building Details Panel (`components/BuildingDetails.tsx`)

- **Composition**: Uses `SurfaceCard`, `IconButton`, `Badge`, typography tokens.
- **Structure**:
  - `SurfaceCard` wrapper with blur and shadow.
  - Header image with gradient overlay (theme-aware).
  - `Badge` for style label with genre color.
  - Typography tokens for heading, body, and mono text.
  - Link button for "Verify Intel" (styled with tokens).
  - Footer with coordinates using mono typography.
- **Styling**: All surfaces, badges, and text use design system tokens.

#### App Shell (`App.tsx`)

- **Orchestration**:
  - Global background from theme tokens.
  - Theme state management and persistence.
  - Search panel molecule (top).
  - Map organism (center).
  - Building details molecule (side/bottom).
  - "N" button (fixed bottom-left, uses inline styles for special effect).

---

## 5. Style Guide Page (`/style-guide`)

- **Location**: `ui/StyleGuide.tsx`.
- **Access**: Run the app and open `/style-guide` in the browser (e.g. `http://localhost:5173/style-guide`).
- **Purpose**: Internal-only visual catalogue of tokens, atoms, and molecules.
  - **Tokens section**: Shows color, typography, spacing, radius, and shadow tokens from `ui/theme.ts`.
  - **Atoms section**: Renders examples of `PrimaryButton`, `IconButton`, `SurfaceCard`, `Badge`, `StatusStrip`, and marker icons.
  - **Molecules section**: Shows static `SearchPanel` and `BuildingDetails` examples using mock data.
- **Behavior**:
  - Uses the same theme model (`evil-atlas-theme` in `localStorage`) as `App.tsx`.
  - Does **not** call Baserow, Gemini, or Google APIs; all data is mocked.
  - Exists purely for design and visual QA; production users should only see `/`.

---

## 6. Design System Usage Guidelines

### How to Use the Design System

1. **For new components**:
   - Always start with atoms from `ui/atoms/` before creating new UI elements.
   - Use tokens from `ui/theme.ts` for colors, typography, spacing, etc.
   - Pass `theme` prop down from parent components.

2. **For styling changes**:
   - **Global changes**: Modify tokens in `ui/theme.ts` (e.g., change accent color, typography scale).
   - **Component-specific**: Override with `className` prop on atoms, or create new atom variants if needed.
   - **Genre colors**: Modify `GENRE_COLORS` in `constants.ts` (re-exported by theme).

3. **Component hierarchy**:
   - **Atoms** (`ui/atoms/`): Smallest reusable pieces (buttons, badges, cards).
   - **Molecules** (`components/`): Composed UI sections (SearchPanel, BuildingDetails).
   - **Organisms** (`App.tsx`, `Map.tsx`): Top-level orchestration.

4. **Theme-aware components**:
   - All atoms accept `theme: 'dark' | 'light'` prop.
   - Molecules receive theme from parent and pass to atoms.
   - Use `getThemeColors(theme)` helper when needed for conditional styling.

### Important Constraints

- **No logic changes**: The design system refactor preserves all application logic, data flow, and API behavior exactly as documented in `docs/current-state-and-rules.md`.
- **Backward compatibility**: All existing props and behaviors remain unchanged; only styling implementation uses the design system.
- **Token-first**: Prefer using tokens over hardcoded Tailwind classes when possible.
