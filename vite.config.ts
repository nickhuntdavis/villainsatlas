import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Support both VITE_GEMINI_API_KEY and GEMINI_API_KEY for flexibility
    // Check both loadEnv (for .env files) and process.env (for build-time env vars like Netlify)
    const geminiApiKey = 
      env.VITE_GEMINI_API_KEY || 
      env.GEMINI_API_KEY || 
      process.env.VITE_GEMINI_API_KEY || 
      process.env.GEMINI_API_KEY;
    
    // Support both VITE_GOOGLE_MAPS_API_KEY and GOOGLE_MAPS_API_KEY for flexibility
    const googleMapsApiKey = 
      env.VITE_GOOGLE_MAPS_API_KEY || 
      env.GOOGLE_MAPS_API_KEY || 
      process.env.VITE_GOOGLE_MAPS_API_KEY || 
      process.env.GOOGLE_MAPS_API_KEY;
    
    if (!geminiApiKey && mode === 'production') {
      console.warn('⚠️  WARNING: GEMINI_API_KEY is missing. The app may not work correctly in production.');
    }
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // Bundle analyzer - generates stats.html in dist folder
        visualizer({
          filename: './dist/stats.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GOOGLE_MAPS_API_KEY': JSON.stringify(googleMapsApiKey),
        'process.env.REACT_APP_GOOGLE_MAPS_API_KEY': JSON.stringify(googleMapsApiKey),
        'process.env.REACT_APP_BASEROW_API_TOKEN': JSON.stringify(env.VITE_BASEROW_API_TOKEN || env.REACT_APP_BASEROW_API_TOKEN || process.env.VITE_BASEROW_API_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN),
        'process.env.REACT_APP_BASEROW_TABLE_ID': JSON.stringify(env.VITE_BASEROW_TABLE_ID || env.REACT_APP_BASEROW_TABLE_ID || process.env.VITE_BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
