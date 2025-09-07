import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { config } from './index';

// Security headers configuration
export const securityHeaders = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      blockAllMixedContent: [],
      fontSrc: ["'self'", 'https:', 'data:', 'https://cdnjs.cloudflare.com'],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      upgradeInsecureRequests: [],
    },
  },
  
  // Cross Origin Embedder Policy
  crossOriginEmbedderPolicy: false,
  
  // Cross Origin Opener Policy
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  
  // Cross Origin Resource Policy
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Expect Certificate Transparency
  expectCt: {
    maxAge: 86400,
    enforce: true,
  },
  
  // Feature Policy / Permissions Policy
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
  },
  
  // Frame Options
  frameguard: { action: 'deny' },
  
  // Hide Powered By
  hidePoweredBy: true,
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Referrer Policy
  referrerPolicy: { policy: 'no-referrer' },
  
  // X-XSS-Protection
  xssFilter: true,
};

// Rate limiting configurations
export const rateLimitConfigs = {
  // General API rate limit
  general: rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      error: 'Too many requests',
      message: config.rateLimit.message,
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: config.rateLimit.skip,
  }),
  
  // Authentication endpoints (stricter)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      error: 'Too many authentication attempts',
      message: 'Please try again later',
      retryAfter: 900, // 15 minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  }),
  
  // Message sending (per session)
  messaging: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 messages per minute
    message: {
      error: 'Message rate limit exceeded',
      message: 'Please slow down your message sending',
      retryAfter: 60,
    },
    keyGenerator: (req: Request) => {
      return `${req.ip}:${req.params.sessionId || 'unknown'}`;
    },
  }),
  
  // File upload rate limit
  upload: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute
    message: {
      error: 'Upload rate limit exceeded',
      message: 'Please wait before uploading more files',
      retryAfter: 60,
    },
  }),
  
  // Webhook endpoints
  webhook: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 webhook calls per minute
    message: {
      error: 'Webhook rate limit exceeded',
      message: 'Too many webhook requests',
      retryAfter: 60,
    },
  }),
};

// Speed limiting (progressive delays)
export const speedLimitConfigs = {
  // General speed limiting
  general: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per windowMs without delay
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // Maximum delay of 20 seconds
  }),
  
  // API endpoints speed limiting
  api: slowDown({
    windowMs: 60 * 1000, // 1 minute
    delayAfter: 20, // Allow 20 requests per minute without delay
    delayMs: 250, // Add 250ms delay per request after delayAfter
    maxDelayMs: 5000, // Maximum delay of 5 seconds
  }),
};

// Input validation and sanitization
export const inputSanitization = {
  // Remove potentially dangerous characters
  sanitizeString: (input: string): string => {
    return input
      .replace(/[<>"'&]/g, '') // Remove HTML/XML characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  },
  
  // Validate and sanitize phone numbers
  sanitizePhoneNumber: (phone: string): string => {
    return phone.replace(/[^0-9+]/g, '').substring(0, 20);
  },
  
  // Validate file names
  sanitizeFileName: (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  },
  
  // Validate URLs
  isValidUrl: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },
};

// Security middleware
export const securityMiddleware = {
  // Request size limiting
  requestSizeLimit: (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request too large',
        message: 'Request body exceeds maximum allowed size',
        maxSize: `${maxSize / 1024 / 1024}MB`,
      });
    }
    
    next();
  },
  
  // IP whitelist/blacklist
  ipFilter: (whitelist: string[] = [], blacklist: string[] = []) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.ip || req.connection.remoteAddress || '';
      
      // Check blacklist first
      if (blacklist.length > 0 && blacklist.includes(clientIp)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address is not allowed',
        });
      }
      
      // Check whitelist if configured
      if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address is not whitelisted',
        });
      }
      
      next();
    };
  },
  
  // Request ID for tracing
  requestId: (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.get('X-Request-ID') || 
                     `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
  },
  
  // Security headers
  securityHeaders: (req: Request, res: Response, next: NextFunction) => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    next();
  },
};

// API key validation
export const apiKeyValidation = {
  // Validate API key format
  isValidApiKey: (apiKey: string): boolean => {
    // API key should be 32-64 characters, alphanumeric with dashes/underscores
    const apiKeyRegex = /^[a-zA-Z0-9_-]{32,64}$/;
    return apiKeyRegex.test(apiKey);
  },
  
  // Generate secure API key
  generateApiKey: (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 48; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
};

// Session security
export const sessionSecurity = {
  // Session configuration
  sessionConfig: {
    name: 'whatsapp-api-session',
    secret: config.jwt.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: config.isProduction, // HTTPS only in production
      httpOnly: true, // Prevent XSS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' as const, // CSRF protection
    },
  },
  
  // Generate secure session ID
  generateSessionId: (): string => {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  },
};

// HTTPS configuration
export const httpsConfig = {
  // Force HTTPS in production
  forceHttps: (req: Request, res: Response, next: NextFunction) => {
    if (config.isProduction && !req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
    next();
  },
  
  // SSL/TLS options for production
  tlsOptions: {
    minVersion: 'TLSv1.2',
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA384',
    ].join(':'),
    honorCipherOrder: true,
  },
};

export default {
  securityHeaders,
  rateLimitConfigs,
  speedLimitConfigs,
  inputSanitization,
  securityMiddleware,
  apiKeyValidation,
  sessionSecurity,
  httpsConfig,
};