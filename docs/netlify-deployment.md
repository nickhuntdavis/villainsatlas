# Netlify Deployment Guide

## Overview

This application uses Netlify serverless functions to proxy Google Places API requests, avoiding CORS issues in production.

## Architecture

- **Development**: Express API server (`server/api-server.js`) runs on port 3001
- **Production**: Netlify serverless functions handle API requests automatically

## Netlify Functions

The following functions are located in `netlify/functions/`:

1. **`places-details.js`** - Proxies Google Places API Place Details requests
2. **`places-find.js`** - Proxies Google Places API Find Place from Text requests  
3. **`health.js`** - Health check endpoint

## Configuration

### netlify.toml

The `netlify.toml` file configures:
- Build command: `npm run build`
- Publish directory: `dist`
- Redirects: `/api/*` routes → `/.netlify/functions/*`
- SPA fallback: All routes → `/index.html`

### Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

**Required:**
- `VITE_GOOGLE_MAPS_API_KEY` - Your Google Maps API key
- `VITE_GEMINI_API_KEY` - Your Gemini API key
- `VITE_BASEROW_API_TOKEN` - Your Baserow API token
- `VITE_BASEROW_TABLE_ID` - Your Baserow table ID

**Note**: Netlify automatically makes `VITE_*` prefixed variables available to your build and functions.

## Deployment Steps

1. **Connect Repository to Netlify**
   - Go to Netlify Dashboard
   - Add new site from Git
   - Connect your repository

2. **Configure Build Settings**
   - Build command: `npm run build` (already in netlify.toml)
   - Publish directory: `dist` (already in netlify.toml)
   - Node version: Use Node.js 18+ (set in Netlify UI if needed)

3. **Set Environment Variables**
   - Go to Site Settings → Environment Variables
   - Add all required `VITE_*` variables listed above
   - **Important**: Also set `GOOGLE_MAPS_API_KEY` (without VITE_ prefix) for serverless functions

4. **Deploy**
   - Push to your main branch (or trigger manual deploy)
   - Netlify will automatically:
     - Build your Vite app
     - Deploy serverless functions
     - Configure redirects

## How It Works

### Development
- Frontend runs on `http://localhost:3000`
- Express API server runs on `http://localhost:3001`
- Frontend calls `http://localhost:3001/api/places/details`

### Production
- Frontend is deployed to `https://your-site.netlify.app`
- Serverless functions are deployed automatically
- Frontend calls `/api/places/details` (relative URL)
- Netlify redirects to `/.netlify/functions/places-details`
- Function proxies request to Google Places API

## Testing Functions Locally

You can test Netlify functions locally using Netlify CLI:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run local dev server with functions
netlify dev
```

This will:
- Start the Vite dev server
- Start Netlify Dev server for functions
- Proxy API requests to functions automatically

## Troubleshooting

### Functions Not Working
- Check that `GOOGLE_MAPS_API_KEY` is set in Netlify environment variables
- Verify function logs in Netlify Dashboard → Functions
- Check that `netlify.toml` redirects are configured correctly

### CORS Issues
- Netlify functions automatically handle CORS
- Functions return `Access-Control-Allow-Origin: *` headers

### Build Failures
- Ensure all dependencies are in `package.json` (not just devDependencies)
- Check Node.js version compatibility
- Review build logs in Netlify Dashboard

## File Structure

```
.
├── netlify/
│   ├── functions/
│   │   ├── places-details.js
│   │   ├── places-find.js
│   │   └── health.js
├── netlify.toml
├── server/
│   └── api-server.js          # Development only
└── services/
    └── geminiService.ts       # Uses getApiBaseUrl() helper
```

