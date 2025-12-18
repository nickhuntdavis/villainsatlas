// Netlify serverless function for Google Places API - Find Place from Text
export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
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
  const { input, inputtype, fields } = event.queryStringParameters || {};

  if (!input) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'input parameter is required' }),
    };
  }

  try {
    const inputtypeParam = inputtype || 'textquery';
    const fieldsParam = fields || 'place_id';
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(input)}&inputtype=${inputtypeParam}&fields=${encodeURIComponent(fieldsParam)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error proxying Places Find API request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to find place',
        message: error.message,
      }),
    };
  }
};

