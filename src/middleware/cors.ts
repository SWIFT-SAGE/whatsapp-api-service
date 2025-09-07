import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from '../utils/logger';

/**
 * CORS configuration interface
 */
interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

/**
 * Default CORS configuration
 */
const defaultCorsConfig: CorsConfig = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'https://localhost:3000',
    'https://localhost:3001',
    'https://localhost:8080'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Webhook-Secret',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',
    'X-Page-Count'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Get CORS configuration from environment variables
 */
const getCorsConfig = (): CorsConfig => {
  const config = { ...defaultCorsConfig };

  // Override with environment variables if present
  if (process.env.CORS_ALLOWED_ORIGINS) {
    config.allowedOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }

  if (process.env.CORS_ALLOWED_METHODS) {
    config.allowedMethods = process.env.CORS_ALLOWED_METHODS.split(',').map(method => method.trim().toUpperCase());
  }

  if (process.env.CORS_ALLOWED_HEADERS) {
    config.allowedHeaders = process.env.CORS_ALLOWED_HEADERS.split(',').map(header => header.trim());
  }

  if (process.env.CORS_EXPOSED_HEADERS) {
    config.exposedHeaders = process.env.CORS_EXPOSED_HEADERS.split(',').map(header => header.trim());
  }

  if (process.env.CORS_CREDENTIALS) {
    config.credentials = process.env.CORS_CREDENTIALS.toLowerCase() === 'true';
  }

  if (process.env.CORS_MAX_AGE) {
    config.maxAge = parseInt(process.env.CORS_MAX_AGE, 10) || config.maxAge;
  }

  return config;
};

/**
 * Check if origin is allowed
 */
const isOriginAllowed = (origin: string | undefined, allowedOrigins: string[]): boolean => {
  if (!origin) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    return process.env.NODE_ENV === 'development';
  }

  // Check exact matches
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check wildcard patterns
  for (const allowedOrigin of allowedOrigins) {
    if (allowedOrigin === '*') {
      return true;
    }
    
    // Support subdomain wildcards (e.g., *.example.com)
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.substring(2);
      if (origin.endsWith(`.${domain}`) || origin === domain) {
        return true;
      }
    }
    
    // Support protocol wildcards (e.g., *://example.com)
    if (allowedOrigin.startsWith('*://')) {
      const domainPart = allowedOrigin.substring(4);
      if (origin.includes(`://${domainPart}`)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Log CORS events
 */
const logCorsEvent = (req: Request, event: string, details: any): void => {
  const corsLog = {
    event,
    origin: req.get('Origin'),
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    details,
    timestamp: new Date().toISOString()
  };

  if (event === 'blocked') {
    logger.warn('CORS Request Blocked:', corsLog);
  } else {
    logger.debug('CORS Event:', corsLog);
  }
};

/**
 * Create CORS middleware
 */
export const createCorsMiddleware = () => {
  const config = getCorsConfig();

  return cors({
    origin: (origin, callback) => {
      const allowed = isOriginAllowed(origin, config.allowedOrigins);
      
      if (allowed) {
        callback(null, true);
      } else {
        logger.warn('CORS: Origin not allowed', { origin, allowedOrigins: config.allowedOrigins });
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: config.allowedMethods,
    allowedHeaders: config.allowedHeaders,
    exposedHeaders: config.exposedHeaders,
    credentials: config.credentials,
    maxAge: config.maxAge,
    preflightContinue: config.preflightContinue,
    optionsSuccessStatus: config.optionsSuccessStatus
  });
};

/**
 * Development CORS middleware (allows all origins)
 */
export const developmentCors = cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Webhook-Secret',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',
    'X-Page-Count'
  ],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204
});

/**
 * Production CORS middleware (strict origin checking)
 */
export const productionCors = createCorsMiddleware();

/**
 * API-specific CORS middleware
 */
export const apiCors = cors({
  origin: (origin, callback) => {
    const config = getCorsConfig();
    const allowed = isOriginAllowed(origin, config.allowedOrigins);
    
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('API access not allowed from this origin'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  credentials: false,
  maxAge: 3600, // 1 hour
  optionsSuccessStatus: 204
});

/**
 * Webhook CORS middleware (more restrictive)
 */
export const webhookCors = cors({
  origin: false, // No CORS for webhooks
  methods: ['POST'],
  allowedHeaders: [
    'Content-Type',
    'X-Webhook-Secret',
    'X-Request-ID'
  ],
  credentials: false,
  maxAge: 0,
  optionsSuccessStatus: 204
});

/**
 * Custom CORS middleware with logging
 */
export const corsWithLogging = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.get('Origin');
  const config = getCorsConfig();
  
  // Log preflight requests
  if (req.method === 'OPTIONS') {
    logCorsEvent(req, 'preflight', {
      requestedMethod: req.get('Access-Control-Request-Method'),
      requestedHeaders: req.get('Access-Control-Request-Headers')
    });
  }
  
  // Check if origin is allowed
  if (origin && !isOriginAllowed(origin, config.allowedOrigins)) {
    logCorsEvent(req, 'blocked', {
      reason: 'Origin not in allowed list',
      allowedOrigins: config.allowedOrigins
    });
    
    res.status(403).json({
      error: 'CORS policy violation',
      message: 'Origin not allowed',
      origin
    });
    return;
  }
  
  // Apply CORS headers
  if (origin && isOriginAllowed(origin, config.allowedOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  
  if (config.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(config.optionsSuccessStatus).end();
    return;
  }
  
  logCorsEvent(req, 'allowed', {
    method: req.method,
    headers: req.headers
  });
  
  next();
};

/**
 * Get appropriate CORS middleware based on environment
 */
export const getCorsMiddleware = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionCors;
    case 'staging':
      return createCorsMiddleware();
    case 'development':
    default:
      return developmentCors;
  }
};

/**
 * Security headers middleware (works with CORS)
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

export default {
  createCorsMiddleware,
  developmentCors,
  productionCors,
  apiCors,
  webhookCors,
  corsWithLogging,
  getCorsMiddleware,
  securityHeaders
};