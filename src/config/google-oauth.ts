import { config } from './index';

// Google OAuth Configuration
export const googleOAuthConfig = {
  clientID: process.env.GOOGLE_CLIENT_ID || '1025829993522-lfkiif8iju1jl49rjil4p5fhar5k3df1.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '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',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  redirectURIs: [
    'https://apimessinging.com/success',
    'http://localhost:3001/success',
    'http://localhost:3000/success'
  ],
  scope: ['profile', 'email']
};

export default googleOAuthConfig;


