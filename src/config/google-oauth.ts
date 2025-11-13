import { config } from './index';

// Determine the base URL dynamically based on environment
const getBaseUrl = (): string => {
  // Priority 1: Explicit callback URL in environment (highest priority)
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }

  // Priority 2: Production domain from environment
  if (process.env.PRODUCTION_URL) {
    const prodUrl = process.env.PRODUCTION_URL.trim();
    // Ensure it doesn't have trailing slash
    const baseUrl = prodUrl.endsWith('/') ? prodUrl.slice(0, -1) : prodUrl;
    return `${baseUrl}/auth/google/callback`;
  }

  // Priority 3: Check if in production environment (use default production domain)
  if (config.isProduction) {
    return 'https://apimessinging.com/auth/google/callback';
  }

  // Priority 4: Vercel preview deployment (for testing preview URLs)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/auth/google/callback`;
  }

  // Priority 5: Development fallback
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}/auth/google/callback`;
};

// Get the callback URL
const callbackURL = getBaseUrl();

// Log the callback URL for debugging (only in development)
if (config.isDevelopment) {
  console.log('🔐 Google OAuth Callback URL:', callbackURL);
}

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

export default googleOAuthConfig;


