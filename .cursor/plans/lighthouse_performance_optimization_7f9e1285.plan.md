---
name: Lighthouse Performance Optimization
overview: Improve Lighthouse performance score by addressing render-blocking resources, optimizing API calls, enabling compression, and improving LCP. Organized into 3 phases by impact and effort.
todos: []
---

# Li

ghthouse Performance Optimization Plan

## Current Performance Issues

**Metrics needing improvement:**

- First Contentful Paint: 2.3s (target: <1.8s)
- Largest Contentful Paint: 4.8s (target: <2.5s)
- Speed Index: 2.3s (target: <3.4s)

**Key bottlenecks identified:**

1. Render-blocking CSS (330ms savings potential)
2. Baserow API blocking initial render (1,466ms critical path)
3. Image optimization (292 KiB savings potential)
4. Missing compression (3 KiB savings potential)

---

## Phase 1: Quick Wins (High Impact, Low Effort)

### 1.1 Remove Tailwind CDN, Use Build-Time CSS

**Impact:** HIGH - Eliminates 123.9 KiB render-blocking request (230ms)**Files:** `index.html`, `package.json`, `vite.config.ts`, create `tailwind.config.js`

- Remove `<script src="https://cdn.tailwindcss.com"></script>` from `index.html`
- Install Tailwind CSS via npm: `tailwindcss`, `autoprefixer`, `postcss`
- Configure Tailwind to scan source files
- Import Tailwind in CSS file that Vite processes
- Move Tailwind config from inline script to `tailwind.config.js`

**Expected improvement:** ~200-300ms FCP reduction

### 1.2 Enable Compression in Netlify

**Impact:** MEDIUM - 3 KiB savings, faster initial HTML load**Files:** `netlify.toml`

- Add `[build.processing]` section with `skip_processing = false`
- Netlify automatically enables gzip/brotli, but we can ensure it's configured

**Expected improvement:** ~50-100ms faster initial document load

### 1.3 Optimize Google Fonts Loading

**Impact:** MEDIUM - 260ms render-blocking**Files:** `index.html`

- Add `&display=swap` (already present)
- Consider self-hosting Inter font (Phase 2) or using `font-display: swap` in CSS
- Move font link to end of `<head>` or use `rel="preload"` with `as="style"` and `onload`

**Expected improvement:** ~100-150ms FCP reduction

### 1.4 Add fetchpriority to LCP Image

**Impact:** MEDIUM - Improves LCP discovery**Files:** `components/Map.tsx` or Leaflet TileLayer configuration

- Add `fetchpriority="high"` to first map tile image
- May require custom TileLayer wrapper or Leaflet plugin

**Expected improvement:** ~100-200ms LCP improvement---

## Phase 2: Medium Effort (High Impact)

### 2.1 Defer Baserow API Calls

**Impact:** CRITICAL - Removes 1,466ms from critical path**Files:** `App.tsx`, `services/baserowService.ts`**Current issue:** `fetchAllBuildings()` runs synchronously on mount, making sequential pagination requests (1,226ms + 1,466ms) blocking initial render.**Solutions:**

- **Option A (Recommended):** Load buildings progressively - fetch only initial viewport buildings first, then load rest in background
- **Option B:** Use `requestIdleCallback` or `setTimeout` to defer non-critical data loading
- **Option C:** Implement service worker caching for Baserow data

**Implementation for Option A:**

- Modify `loadInitialBaserow` to fetch only first page (200 buildings) initially
- Filter to viewport buildings immediately
- Load remaining pages in background after initial render
- Update `fetchAllBuildings` to accept optional `limit` parameter

**Expected improvement:** ~1,000-1,500ms FCP/LCP reduction

### 2.2 Add Resource Hints for Baserow API

**Impact:** MEDIUM - Reduces DNS/TCP time for API calls**Files:** `index.html`

- Add `<link rel="preconnect" href="https://api.baserow.io">`
- Add `<link rel="dns-prefetch" href="https://api.baserow.io">`

**Expected improvement:** ~50-100ms faster API calls

### 2.3 Self-Host Leaflet CSS

**Impact:** LOW-MEDIUM - Eliminates 300ms render-blocking request**Files:** `index.html`, `package.json`

- Remove CDN link for Leaflet CSS
- Import Leaflet CSS in component or main CSS file
- Vite will bundle and optimize it

**Expected improvement:** ~200-300ms FCP reduction

### 2.4 Code Splitting for Non-Critical Components

**Impact:** MEDIUM - Reduces initial bundle size**Files:** `App.tsx`, `components/`

- Lazy load `BuildingDetails` component (only shown when building selected)
- Lazy load `FallingHearts` component (only shown on trigger)
- Lazy load `StyleGuide` if it's imported but not used in production

**Expected improvement:** ~200-400ms faster initial load---

## Phase 3: Advanced Optimizations (Medium Impact)

### 3.1 Implement Service Worker for Baserow Caching

**Impact:** MEDIUM - Subsequent loads much faster**Files:** Create `public/sw.js`, `App.tsx`

- Cache Baserow API responses
- Serve from cache on subsequent visits
- Update cache in background

**Expected improvement:** Near-instant loads on repeat visits

### 3.2 Optimize Map Tile Loading

**Impact:** LOW-MEDIUM - Can't control third-party tiles, but can optimize loading**Files:** `components/Map.tsx`

- Add `loading="lazy"` to map container (Leaflet handles this internally)
- Consider reducing initial zoom level to load fewer tiles
- Preload critical map tiles for common viewports

**Note:** Map tiles from cartocdn.com are third-party - we can't convert to WebP/AVIF, but we can optimize how we request them.

### 3.3 Bundle Analysis and Tree Shaking

**Impact:** MEDIUM - Reduce bundle size**Files:** `vite.config.ts`, `package.json`

- Add `rollup-plugin-visualizer` to analyze bundle
- Identify and remove unused dependencies
- Ensure proper tree-shaking for large libraries (lucide-react, @google/genai)

**Expected improvement:** ~100-300ms faster load times---

## Implementation Priority

**Immediate (Phase 1):**

1. Remove Tailwind CDN (highest impact)
2. Enable compression
3. Optimize font loading
4. Add fetchpriority to LCP

**Short-term (Phase 2):**

1. Defer Baserow API calls (critical path blocker)
2. Add resource hints
3. Self-host Leaflet CSS
4. Code splitting

**Long-term (Phase 3):**

1. Service worker caching
2. Bundle optimization
3. Map tile optimization

---

## Expected Overall Improvement

**After Phase 1:**

- FCP: 2.3s → ~1.8-2.0s
- LCP: 4.8s → ~4.0-4.2s

**After Phase 2:**

- FCP: ~1.8s → ~0.8-1.2s
- LCP: ~4.0s → ~2.0-2.5s

**After Phase 3:**