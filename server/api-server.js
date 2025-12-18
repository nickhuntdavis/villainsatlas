import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Enable CORS for the frontend
// Allow both development and production origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.PRODUCTION_URL,
  process.env.VITE_PRODUCTION_URL
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In production, be more strict
      if (process.env.NODE_ENV === 'production') {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      } else {
        // In development, allow all origins
        callback(null, true);
      }
    }
  },
  credentials: true
}));

app.use(express.json());

// Get Google Maps API key from environment
const getGoogleMapsApiKey = () => {
  return process.env.VITE_GOOGLE_MAPS_API_KEY || 
         process.env.GOOGLE_MAPS_API_KEY || 
         process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
};

// Proxy endpoint for Google Places API - Place Details
app.get('/api/places/details', async (req, res) => {
  const { place_id, fields } = req.query;
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Google Maps API key not configured' 
    });
  }

  if (!place_id) {
    return res.status(400).json({ 
      error: 'place_id parameter is required' 
    });
  }

  try {
    const fieldsParam = fields || 'photos';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=${encodeURIComponent(fieldsParam)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Forward the response with proper CORS headers
    res.json(data);
  } catch (error) {
    console.error('Error proxying Places API request:', error);
    res.status(500).json({ 
      error: 'Failed to fetch place details',
      message: error.message 
    });
  }
});

// Proxy endpoint for Google Places API - Find Place from Text
app.get('/api/places/find', async (req, res) => {
  const { input, inputtype, fields } = req.query;
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Google Maps API key not configured' 
    });
  }

  if (!input) {
    return res.status(400).json({ 
      error: 'input parameter is required' 
    });
  }

  try {
    const inputtypeParam = inputtype || 'textquery';
    const fieldsParam = fields || 'place_id';
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(input)}&inputtype=${inputtypeParam}&fields=${encodeURIComponent(fieldsParam)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Error proxying Places Find API request:', error);
    res.status(500).json({ 
      error: 'Failed to find place',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`   - Places API proxy: http://localhost:${PORT}/api/places/details`);
});

