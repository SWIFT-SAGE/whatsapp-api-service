import { config } from './index';

// Determine the base URL dynamically based on environment
const getBaseUrl = (): string => {
  // Priority 1: Explicit callback URL in environment (highest priority)
  if (process.env.GOOGLE_CALLBACK_URL) {
    const url = process.env.GOOGLE_CALLBACK_URL.trim();
    // Remove trailing slash if present
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  // Priority 2: If NOT in production, always use localhost (for development)
  // This ensures localhost works even if NODE_ENV is set incorrectly
  if (!config.isProduction) {
    const port = process.env.PORT || '3000';
    const url = `http://localhost:${port}/auth/google/callback`;
    return url;
  }

  // Priority 3: Production domain from environment
  if (process.env.PRODUCTION_URL) {
    const prodUrl = process.env.PRODUCTION_URL.trim();
    // Ensure it doesn't have trailing slash
    const baseUrl = prodUrl.endsWith('/') ? prodUrl.slice(0, -1) : prodUrl;
    return `${baseUrl}/auth/google/callback`;
  }

  // Priority 4: Vercel preview deployment (for testing preview URLs)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/auth/google/callback`;
  }

  // Priority 5: Default production URL
  if (config.isProduction) {
    return 'https://apimessinging.com/auth/google/callback';
  }

  // Final fallback: localhost
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}/auth/google/callback`;
};

// Get the callback URL
const callbackURL = getBaseUrl();

// Google OAuth Configuration
export const googleOAuthConfig = {
  clientID: process.env.GOOGLE_CLIENT_ID || '1025829993522-lfkiif8iju1jl49rjil4p5fhar5k3df1.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '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',
  callbackURL: callbackURL,
  redirectURIs: [
    'https://apimessinging.com/success',
    'http://localhost:3001/success',
    'http://localhost:3000/success'
  ],
  scope: ['profile', 'email']
};

// Log the callback URL for debugging
console.log('🔐 Google OAuth Configuration:');
console.log('  - Environment:', config.env);
console.log('  - Is Production:', config.isProduction);
console.log('  - Callback URL:', callbackURL);
console.log('  - Client ID:', googleOAuthConfig.clientID.substring(0, 30) + '...');
if (process.env.GOOGLE_CALLBACK_URL) {
  console.log('  - GOOGLE_CALLBACK_URL env var:', process.env.GOOGLE_CALLBACK_URL);
}
if (process.env.PRODUCTION_URL) {
  console.log('  - PRODUCTION_URL env var:', process.env.PRODUCTION_URL);
}
if (process.env.VERCEL_URL) {
  console.log('  - VERCEL_URL env var:', process.env.VERCEL_URL);
}
console.log('  - Expected in Google Console:', 'http://localhost:3000/auth/google/callback');

export default googleOAuthConfig;


