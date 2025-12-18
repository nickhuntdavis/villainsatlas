# Known Issues

## Google Places API CORS Issue

### Problem
When attempting to fetch Google Places API data (specifically place details with photos) directly from the browser (client-side), requests are blocked by CORS policy:

```
Access to fetch at 'https://maps.googleapis.com/maps/api/place/details/json?...' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### When This Occurs
- **Date First Encountered**: Multiple occurrences
- **Affected Features**: 
  - Image backfill script (`fetchImageForBuilding` function)
  - Any client-side Google Places API calls

### Root Cause
Google Places API REST endpoints do not support CORS headers, meaning they cannot be called directly from browser JavaScript. This is a security measure by Google.

### Workarounds / Solutions

1. **Use Server-Side Scripts** (Current Approach)
   - The backfill scripts in `/scripts` folder work correctly because they run server-side (Node.js)
   - These scripts can make direct API calls without CORS issues
   - Example: `scripts/backfill-images.js`, `scripts/backfill-images-and-gmaps.js`

2. **Backend Proxy Endpoint** (✅ IMPLEMENTED)
   - **Development**: Express API server at `server/api-server.js` runs on port 3001
   - **Production**: Netlify serverless functions in `netlify/functions/` directory
   - Client makes requests via environment-aware URLs (uses `getApiBaseUrl()` helper)
   - **Netlify Functions**:
     - `netlify/functions/places-details.js` - Place details endpoint
     - `netlify/functions/places-find.js` - Find place from text endpoint
     - `netlify/functions/health.js` - Health check endpoint
   - **Netlify Configuration**: `netlify.toml` redirects `/api/*` to `/.netlify/functions/*`
   - **Usage**: 
     - Development: Run `npm run dev:all` to start both frontend and Express API server
     - Production: Deploy to Netlify - functions are automatically deployed and routed

3. **Use Google Maps JavaScript API** (Alternative)
   - Instead of REST API, use the JavaScript SDK which handles CORS internally
   - Requires different implementation approach
   - May have different pricing/licensing considerations

### Current Status
- ✅ Server-side scripts work fine
- ✅ **SOLVED**: Backend proxy endpoint implemented at `server/api-server.js`
- ✅ Frontend now uses proxy endpoint instead of direct API calls
- ✅ Image backfill button in UI now works correctly

### Related Files
- `services/geminiService.ts` - `fetchImageForBuilding` function (line ~524)
- `App.tsx` - `handleBackfillImagesButtonClick` function (line ~1061)
- `scripts/backfill-images.js` - Working server-side example
- `scripts/backfill-images-and-gmaps.js` - Working server-side example

### Notes
- This issue has come up multiple times
- ✅ **RESOLVED**: The image backfill button now works via the proxy endpoint
- ✅ **RESOLVED**: All Google Places API calls now go through the proxy (findPlaceId, enrichWithPlaces, fetchImageForBuilding)
- ✅ **NETLIFY DEPLOYMENT**: Serverless functions are automatically deployed - no separate API server needed
- See `docs/netlify-deployment.md` for Netlify-specific deployment instructions

