// Netlify serverless function for Google Places API - Place Details
export const handler = async (event, context) => {
  // Get allowed origin from environment or default to wildcard (should be restricted in production)
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get Google Maps API key from environment
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || 
                 process.env.GOOGLE_MAPS_API_KEY || 
                 process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Google Maps API key not configured' }),
    };
  }

  // Get query parameters
  const { place_id, fields } = event.queryStringParameters || {};

  // Input validation
  if (!place_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'place_id parameter is required' }),
    };
  }

  // Validate place_id format (Google Place IDs are typically alphanumeric with some special chars)
  if (typeof place_id !== 'string' || place_id.length > 200 || !/^[a-zA-Z0-9_\-+]+$/.test(place_id)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid place_id format' }),
    };
  }

  // Validate fields parameter
  const fieldsParam = fields || 'photos';
  if (fields && (typeof fields !== 'string' || fields.length > 500)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid fields parameter' }),
    };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=${encodeURIComponent(fieldsParam)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error proxying Places API request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch place details',
        message: error.message,
      }),
    };
  }
};

