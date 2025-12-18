## The Villain's Atlas

An interactive map and archive of villainous, authoritarian, and otherwise suspicious architecture.  
This repo contains the full frontend app plus Node-based scripts for working with Baserow and Google APIs.

### Tech Stack

- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + custom light/dark theme
- **Map**: Leaflet / React‑Leaflet with themed tiles
- **Data**: Baserow (REST API)
- **AI**: Google Gemini (for search + geocoding)
- **Places / Photos**: Google Maps Platform (Places API, Place Details, Place Photos)

---

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- A Google Cloud project with:
  - **Gemini** API enabled
  - **Places API** and **Place Photos** enabled
- A Baserow account with the schema described below

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the project root (this file is git‑ignored). At minimum you will need:

```bash
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_BASEROW_API_TOKEN=your_baserow_personal_token
VITE_BASEROW_BASE_URL=https://api.baserow.io/api
VITE_BASEROW_TABLE_ID=your_table_id

# Optional: API server configuration
VITE_API_PORT=3001                    # Development only: port for Express API server

# Netlify Production Deployment:
# - Serverless functions are automatically deployed from netlify/functions/
# - Set GOOGLE_MAPS_API_KEY in Netlify environment variables
# - Functions are accessible via /api/* routes (configured in netlify.toml)
```

You may already have this file from AI Studio export; adjust as needed.  
Do **not** commit real keys.

### 3. Run the App Locally

```bash
npm run dev
```

Then open the URL printed in the terminal (typically `http://localhost:5173`).

---

## Branches & Workflow

- **main**: Stable, trusted logic and data integration.  
  - This branch reflects the state described in `docs/current-state-and-rules.md`.
  - **Rule**: No behavioral changes to search, data flow, or APIs without explicit, intentional work.
- **ui-refactor-design-system**: UI‑only work.
  - Focus on colors, typography, layout, design system, and components.
  - Logic, API contracts, and data behavior must remain unchanged.

Suggested workflow:

```bash
git checkout ui-refactor-design-system   # for UI changes
git checkout main                        # to return to stable baseline
```

---

## Frontend Overview

Key files:

- `App.tsx` – Shell of the app: loads data, manages search & map state, and owns the global **light/dark theme** toggle (persisted in `localStorage`).
- `components/Map.tsx` – Leaflet map + markers, switches tile set based on the active theme.
- `components/SearchPanel.tsx` – Search input, controls (Here / Nearest / locate me / N‑heart), and theme toggle button.
- `components/BuildingDetails.tsx` – Sidebar with building details, image, “Verify intel” Google Maps links, and metadata.
- `services/geminiService.ts` – Calls Gemini for lair discovery + AI geocoding and enriches results with Google Places.
- `services/baserowService.ts` – All Baserow CRUD + normalization and duplicate handling.
- `constants.ts` – Shared constants, including map tile URLs, radii, and other configuration values.

For more on structure and styling, see:

- `docs/current-state-and-rules.md` – Canonical description of current data + logic behavior and guardrails.
- `docs/ui-style-overview.md` – Current UI styling model, theme rules, and component hierarchy (Design System, Atoms, Molecules, Organisms).

---

## Scripts (Data / Backfill / Maintenance)

These are all Node.js scripts, intended to be run from the project root.  
Most of them assume correct `.env.local` configuration and a specific Baserow schema.

- `scripts/add-and-backfill-places.js` – Adds curated places to Baserow and backfills details via Google Places.
- `scripts/backfill-images.js` – Cleans non‑Google images and backfills `image_url` from Place Photos.
- `scripts/backfill-images-and-gmaps.js` – Variant to also backfill `gmaps_url` where applicable.
- `scripts/backfill-place-ids.js` – Populates `google_place_id` for entries missing it using Places search.
- `scripts/fix-place-ids.js` – Fixes address‑only `place_id`s to building POIs.
- `scripts/normalize-and-dedupe.js` – Normalizes city/country naming and deduplicates Baserow rows.
- `test-baserow.js`, `test-update-baserow.js` – Small helpers for manual sanity‑checking of Baserow connectivity.

Before running any script, read its header comments to confirm assumptions and behavior.

Example run:

```bash
node scripts/normalize-and-dedupe.js
```

---

## Theming (Light / Dark) & Design System

The app has a **global theme toggle** and uses a **design system**:

- **Theme**: State is owned in `App.tsx` and persisted in `localStorage` under the key `evil-atlas-theme`.
- **Design System**: Tokens → Atoms → Molecules → Organisms architecture.
  - **Tokens** (`ui/theme.ts`): Central source for colors, typography, spacing, shadows, blur.
  - **Atoms** (`ui/atoms/`): Reusable UI components (`IconButton`, `PrimaryButton`, `SurfaceCard`, `Badge`, `MarkerIcon`, `StatusStrip`).
  - **Molecules** (`components/`): Composed components (`SearchPanel`, `BuildingDetails`) that use atoms.
  - **Organisms**: Top-level orchestration (`App`, `Map`).
- Components receive `theme: 'dark' | 'light'` as a prop and use design system tokens.
- `components/Map.tsx` switches between `MAP_TILE_URL_DARK` and `MAP_TILE_URL_LIGHT`.

**Important**: All UI styling should use the design system (tokens + atoms). Logic and data behavior remain unchanged. See `docs/ui-style-overview.md` for full details.

### Internal Style Guide (`/style-guide`)

There is an internal style guide page for design work:

- **Route**: `/style-guide` (open `http://localhost:5173/style-guide` when running `npm run dev`).
- **Component**: `ui/StyleGuide.tsx`.
- **Contents**:
  - Visual catalogue of tokens from `ui/theme.ts` (colors, typography, spacing, shadows, blur).
  - Examples of atoms from `ui/atoms/` (`IconButton`, `PrimaryButton`, `SurfaceCard`, `Badge`, `StatusStrip`, marker icons).
  - Static examples of key molecules (`SearchPanel`, `BuildingDetails`) using mock data.
- **Guardrails**:
  - Uses mock data only; does not call Baserow or Gemini.
  - Intended for internal design and visual QA; production users should only see `/`.

---

## Contributing / Future Work

For now this repo is primarily for a single‑maintainer workflow. Some useful rules of thumb:

- **Logic & data behavior** are treated as **frozen** unless intentionally changed with a clear plan (see `docs/current-state-and-rules.md`).
- **UI changes** should use the design system:
  - Use atoms from `ui/atoms/` before creating new UI elements.
  - Use tokens from `ui/theme.ts` for colors, typography, spacing, etc.
  - Pass `theme` prop down from parent components.
  - UI changes should happen on `ui-refactor-design-system` branch and be reviewed there.
- Keep `.env.local` and any private keys **out of Git**.

If you open issues or PRs on GitHub, reference which branch and which part of the system (logic vs. UI) you are touching.

