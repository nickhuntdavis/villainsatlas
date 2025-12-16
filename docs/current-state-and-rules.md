## Current State: Data, APIs, and Behavior

### Data Sources
- **Primary store**: Baserow table `772747` (all buildings / lairs).
- **Runtime source of truth**:
  - On app start, the frontend loads **all** rows from Baserow with pagination.
  - Those rows are cached in memory and shown as markers on the map without needing any search.
- **AI discovery (Gemini)**:
  - Used only when a search requires new buildings that aren’t already in Baserow.
  - New Gemini results are enriched via **Google Places Details + Photos** before being saved:
    - `google_place_id`: canonical Place ID from Places.
    - `gmapsUrl`: canonical Maps URL from Places.
    - `image_url`: Google Places Photo URL only (no Wikimedia / generic web images).

### Back-office Scripts (One-off / On-demand)
- `normalize-and-dedupe.js`
  - Normalizes city/country names (e.g. *Köln → Cologne*, *Moskva → Moscow*).
  - **Name-based dedupe**: for each exact `name`, keeps the richest row and deletes others.
- `backfill-place-ids.js`
  - Adds `google_place_id` to rows missing it, using Places “Find Place From Text”.
- `backfill-images-and-gmaps.js`
  - Clears `image_url` values containing `alamy` / `wikimedia`.
  - For rows with `google_place_id` and **no** `image_url`, fetches:
    - Places photo → `image_url`.
    - Places URL → `Gmaps_url`.
- `fix-place-ids.js`
  - For rows whose existing `google_place_id` points only to an address-like place, tries to find a better **POI** by name+location and updates `google_place_id` / `Gmaps_url`.
- `add-and-backfill-places.js`
  - Curated seeding tool. Currently contains historical lists plus the most recent batch you provided.
  - Uses `findExistingRowByNameAndCity` to **skip** creating a row when a same-name (and optional same-city) row already exists.
  - Should now be used **only** when you explicitly want to add curated batches.

### Frontend Behavior (High Level)
- **Initial map**:
  - Shows all Baserow buildings (with persistent markers) loaded at startup.
- **Search (city/text input)**:
  - Geocodes via Gemini to get center coords.
  - First queries Baserow within a 50km radius; if none, falls back to Gemini (which will save enriched new rows to Baserow).
  - Results are merged into the existing markers so they persist.
- **Nearest**:
  - Uses **Baserow only**, with a 2000km radius (`TARGET_NEAREST_SEARCH_RADIUS`).
  - Excludes the special “Nick” entry from nearest targeting.
- **Here / Search Area**:
  - Computes radius from map bounds and expands by 1.5×.
  - Queries Baserow first; falls back to Gemini if no results in that area.
- **Images**:
  - The app only **displays** image URLs that are clearly Google Places / Google-hosted photos.
  - Gemini never writes Wikimedia or generic image URLs anymore.
- **Verify Intel (Google Maps)**:
  - Prefers `google_place_id` + building name to open the **POI**, not just an address.
  - Falls back to name+location search, then finally coordinates.

---

## Rules / Guardrails From This Point On

These rules are intended as standing guidance for future changes. They should not be broken without **explicit approval from you**.

### 1. Data & Persistence Rules
- **Do not change**:
  - Baserow schema field meanings (`name`, `city`, `country`, `lat`, `lng`, `google_place_id`, `Gmaps_url`, `image_url`, `notes`, `style`, `architect`, `location`, `is_prioritized`).
  - The fact that **Baserow is the primary, persistent source** of buildings.
- **Do not introduce** alternative primary stores or mutation paths (e.g. direct writes from the frontend to anything other than Baserow and the agreed Scripts).
- Any new bulk data-manipulation script must:
  - Be idempotent or safe to re-run.
  - Respect **name-based de-duplication** and avoid creating multiple rows with the same `name` unless explicitly intended (and documented).

### 2. Google Places / Images / Maps Rules
- **Images**:
  - `image_url` should remain **Google Places–photo-only** going forward.
  - Do not add new code paths that save or display Wikimedia / generic web images without explicit approval.
- **Place IDs**:
  - `google_place_id` must always refer to the **building’s POI**, not just an address entity, whenever Places can support that.
  - Any change that relaxes this (e.g. allowing address-only IDs) must be explicitly approved.
- **Maps URLs**:
  - `Verify Intel` should continue to prefer `google_place_id` + building name, with name+location and coordinates only as fallbacks.

### 3. Gemini / Search / Logic Rules
- **Gemini usage**:
  - Must stay as a **fallback** (or augmentation) when Baserow lacks data, not the primary source for places already in Baserow.
  - Any change that increases Gemini calls (e.g. broader default searches, different models) should be discussed and approved explicitly.
- **Deduplication & Enrichment**:
  - New AI-found entries must continue to:
    - Be checked against Baserow for existing matches (name + place ID / proximity) before creating new rows.
    - Be enriched via Places Details/Photos for `google_place_id`, `Gmaps_url`, and `image_url`.
  - Do not weaken these protections without explicit sign-off.

### 4. Frontend & UX Rules
- **Logic stability**:
  - Core behaviors (how searches, Nearest, Here/Search Area, and Nick work; how markers are loaded and merged; how errors/rate-limits are handled) should remain **exactly as they are now** unless you explicitly request a logic change.
- **UI-only changes allowed by default**:
  - You can freely adjust:
    - Colors, typography, spacing, shadows, animations.
    - Layout refinements, responsive tweaks, and purely presentational components.
  - These changes must not:
    - Alter API calls, query radii, dedupe rules, or data flows.
    - Change how buildings are selected, filtered, sorted, or persisted.

### 5. Process Rules
- Before making any change that affects:
  - Data model, scripts, dedupe behavior, Gemini prompts/flows, or Google Places integration,
  - The change must be:
    - **Described in a short note**, and
    - **Explicitly approved by you** (e.g. “yes, change X” in the conversation).
- UI/theming changes can proceed without extra approval as long as they strictly respect the above logic constraints.

---

This file (`docs/current-state-and-rules.md`) is the reference point for the current stable behavior. Any future “big” change should be reconciled against this document so we don’t accidentally break the carefully tuned data, Places, and search behavior you have now.


