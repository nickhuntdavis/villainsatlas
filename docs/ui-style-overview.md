## UI Style & Design Overview

This document describes how the current UI is styled in code. It is a **reference baseline** for future work on a design system and component library, without changing any application logic or data behavior.

---

## 1. Tech Stack & Styling Approach

- **Framework**: React + Vite.
- **Styling**:
  - Tailwind-like utility classes used directly in `className` strings (`bg-zinc-900`, `text-zinc-100`, `backdrop-blur-md`, etc.).
  - Custom SVG and inline styles for map pins (`BuildingMarker`).
  - Theme handled in React state and persisted to `localStorage`, with a `data-theme` attribute on `<html>` for future global theming hooks.
- **Icons**: `lucide-react` (e.g. `Search`, `Locate`, `Crosshair`, `MapPin`, `Navigation`, `Heart`, `SunMedium`, `Moon`).

For the design-system refactor, you can assume all color/spacing/typography is currently defined **inline** and will need to be abstracted into tokens and reusable components.

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

Currently implicit, to be formalized into:

- **Tokens**:
  - Colors (background, surface, border, text, accent, genre).
  - Radii (e.g. rounded `md`, `lg`, full).
  - Shadows (e.g. `shadow-2xl` for panels, strong pin drop shadow via inline style).
  - Blur (`backdrop-blur-md` for glassy surfaces).
  - Spacing/stacking (`p-6`, `gap-2`, `mt-8`, etc.).
- **Theme**:
  - Boolean `'dark' | 'light'` driving:
    - Tile theme.
    - Panel backgrounds and borders.
    - Text colors and button states.

### 4.2 Atoms

These are the smallest UI building blocks in the current codebase:

- **Icons** (from `lucide-react`):
  - `Search`, `Loader2`, `Locate`, `Crosshair`, `MapPin`, `Navigation`, `ImageOff`, `Heart`, `SunMedium`, `Moon`, `AlertTriangle`, `Info`.
  - Styling is mostly color-only (`text-zinc-500`, `group-hover:text-red-500`, etc.).
- **Pins / Markers** (`BuildingMarker.tsx`):
  - **Standard pin**:
    - Custom SVG via `divIcon` with:
      - Rotated square (45°) with one rounded corner to mimic a sharp pin.
      - `box-shadow: 0 4px 10px rgba(0,0,0,0.8)`.
      - Border `2px solid #09090b`.
      - Inner dark circle “core”.
    - Color from `GENRE_COLORS` or default fallback.
  - **Nick pin**:
    - Red heart SVG (`#ef4444`) with drop shadow.
  - Size:
    - Normal: `24px`.
    - Selected: `32px`.
- **Buttons**:
  - Not yet abstracted, but repeated patterns:
    - Icon-only buttons (e.g. locate, close, theme toggle).
    - Icon + label buttons (Here, Nearest, Verify Intel).
    - Primary action button (search submit).

These will be ideal to turn into `IconButton`, `PrimaryButton`, `Chip`, `MarkerIcon`, etc.

### 4.3 Molecules

#### Search Panel (`SearchPanel.tsx`)

- Composition:
  - Text input, locate button, “Here” button, “Nearest” button, theme toggle, search submit.
  - Floating card centered at top on desktop, full-width on mobile.
- Dark mode:
  - Container: `bg-zinc-900/90 border-zinc-700`.
  - Input text: `text-zinc-100`, placeholders `text-zinc-500`.
  - Buttons: red accents and darker hover backgrounds.
- Light mode:
  - Container: `bg-zinc-100/95 border-zinc-300`.
  - Input text: `text-zinc-900`, placeholders `text-zinc-400`.
  - Buttons: lighter backgrounds (`bg-red-600` → `bg-red-700` for primary; red text + `bg-red-50` hover for secondary).
- Loading messages:
  - Rotating status line below the search bar in red mono text.

#### Building Marker (`BuildingMarker.tsx`)

- Atomically a pin, but functionally a molecule because it:
  - Encapsulates the custom marker icon.
  - Knows about selection state and map fly-to animation.
  - Embeds style-based color logic.

### 4.4 Organisms

#### Map (`components/Map.tsx`)

- Full-screen map organism:
  - `MapContainer` with dark/light tile choice.
  - `MapUpdater` for smooth fly-to on center change.
  - `MapBoundsTracker` to expose bounds back to `App` for “Here” searches.
  - Renders all `BuildingMarker` atoms for current `buildings` state.

#### Building Details Panel (`BuildingDetails.tsx`)

- Sliding side/bottom panel showing:
  - Header image with gradient overlay (dark vs light).
  - Style badge using genre colors.
  - Name, location line, description.
  - “Verify Intel (Google Maps)” button with themed surface/border.
  - Lat/Lng footer with mono text.
- Dark vs light:
  - Dark:
    - `bg-zinc-950/95`, `border-zinc-800`, text `text-white` / `text-zinc-300`.
  - Light:
    - `bg-white/95`, `border-zinc-200`, text `text-zinc-900` / `text-zinc-700`.

#### App Shell (`App.tsx`)

- Orchestrates:
  - Global background and theme.
  - Search panel (top).
  - Map canvas (center).
  - Building details drawer (side/bottom).
  - “N” button (fixed bottom-left heart button with glowing hover states).

---

## 5. Future Design System & Component Library Hooks

This current structure lends itself to a layered refactor:

1. **Extract tokens**:
   - Move color hexes and classnames into a central theme config (e.g. `theme.ts` or Tailwind config).
   - Create named tokens for:
     - Backgrounds (`surface.default.dark`, `surface.default.light`).
     - Borders (`border.subtle`, `border.strong`).
     - Text (`text.primary`, `text.muted`, etc.).
     - Accents (`accent.primary`, `accent.warning`).
2. **Abstract atoms**:
   - `IconButton`, `PrimaryButton`, `SurfaceCard`, `Badge`, `Tag`, `Pill`.
   - `MarkerIcon` variants: standard, prioritized, special (Nick).
3. **Refine molecules**:
   - `SearchBar` component accepting generic callbacks and tokens.
   - `StatusStrip` for loading messages.
   - `StyleBadge`, `CoordinateRow`, etc.
4. **Lock organisms**:
   - `AtlasMap`, `BuildingDrawer`, and `AppShell` should compose atoms/molecules only, with no inline styles.

Throughout this work, the guiding constraint is: **no logic or data behavior changes**—only presentation and component structure refactors on top of the current styling semantics described above.


