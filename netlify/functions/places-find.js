// Netlify serverless function for Google Places API - Find Place from Text
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
  const { input, inputtype, fields } = event.queryStringParameters || {};

  // Input validation
  if (!input) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'input parameter is required' }),
    };
  }

  // Validate input length and characters (prevent abuse)
  if (typeof input !== 'string' || input.length > 500) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid input: must be a string with max 500 characters' }),
    };
  }

  // Validate inputtype if provided
  const validInputTypes = ['textquery', 'phonenumber'];
  const inputtypeParam = inputtype || 'textquery';
  if (inputtype && !validInputTypes.includes(inputtype)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Invalid inputtype: must be one of ${validInputTypes.join(', ')}` }),
    };
  }

  // Validate fields parameter (basic check)
  const fieldsParam = fields || 'place_id';
  if (fields && typeof fields !== 'string' || (fields && fields.length > 500)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid fields parameter' }),
    };
  }

  try {
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

