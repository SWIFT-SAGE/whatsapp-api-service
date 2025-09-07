import { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Type declarations for express-slow-down
interface SlowDownOptions {
  windowMs?: number;
  delayAfter?: number;
  delayMs?: number | ((hits: number) => number);
  maxDelayMs?: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  headers?: boolean;
  keyGenerator?: (req: any) => string;
  skip?: (req: any, res: any) => boolean;
  onLimitReached?: (req: any, res: any, options: SlowDownOptions) => void;
}

// Using require for express-slow-down
const slowDown: (options?: SlowDownOptions) => RequestHandler = require('express-slow-down');
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { logSecurityEvent } from './logging';

/**
 * Security configuration interface
 */
interface SecurityConfig {
  enableHelmet: boolean;
  enableRateLimit: boolean;
  enableSlowDown: boolean;
  enableCSP: boolean;
  enableHSTS: boolean;
  trustedProxies: string[];
  maxRequestSize: string;
  allowedFileTypes: string[];
}

/**
 * Default security configuration
 */
const defaultSecurityConfig: SecurityConfig = {
  enableHelmet: true,
  enableRateLimit: true,
  enableSlowDown: true,
  enableCSP: true,
  enableHSTS: true,
  trustedProxies: ['127.0.0.1', '::1'],
  maxRequestSize: '10mb',
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
};

/**
 * Get security configuration from environment
 */
const getSecurityConfig = (): SecurityConfig => {
  const config = { ...defaultSecurityConfig };

  if (process.env.SECURITY_TRUSTED_PROXIES) {
    config.trustedProxies = process.env.SECURITY_TRUSTED_PROXIES.split(',').map(ip => ip.trim());
  }

  if (process.env.SECURITY_MAX_REQUEST_SIZE) {
    config.maxRequestSize = process.env.SECURITY_MAX_REQUEST_SIZE;
  }

  if (process.env.SECURITY_ALLOWED_FILE_TYPES) {
    config.allowedFileTypes = process.env.SECURITY_ALLOWED_FILE_TYPES.split(',').map(type => type.trim());
  }

  return config;
};

/**
 * Helmet security middleware
 */
export const helmetSecurity = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'none'"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!allowedIPs.includes(clientIP)) {
      logSecurityEvent('IP_BLOCKED', { clientIP, allowedIPs }, req);
      
      res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not allowed to access this resource'
      });
      return;
    }
    
    next();
  };
};

/**
 * User agent validation middleware
 */
export const validateUserAgent = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    logSecurityEvent('MISSING_USER_AGENT', {}, req);
    
    res.status(400).json({
      error: 'Bad request',
      message: 'User-Agent header is required'
    });
    return;
  }
  
  // Check for suspicious user agents
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /hack/i,
    /exploit/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  if (isSuspicious) {
    logSecurityEvent('SUSPICIOUS_USER_AGENT', { userAgent }, req);
    
    // Don't block, just log for now
    logger.warn('Suspicious user agent detected:', { userAgent, ip: req.ip });
  }
  
  next();
};

/**
 * Request size limiter
 */
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        logSecurityEvent('REQUEST_TOO_LARGE', {
          contentLength: sizeInBytes,
          maxSize: maxSizeInBytes
        }, req);
        
        res.status(413).json({
          error: 'Request too large',
          message: `Request size exceeds maximum allowed size of ${maxSize}`
        });
        return;
      }
    }
    
    next();
  };
};

/**
 * Parse size string to bytes
 */
const parseSize = (size: string): number => {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
};

/**
 * SQL injection detection middleware
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const sqlPatterns = [
    /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
    /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
    /(script|javascript|vbscript|onload|onerror|onclick)/i
  ];
  
  const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (checkForSQLInjection(value, currentPath)) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  // Check query parameters
  if (checkForSQLInjection(req.query)) {
    logSecurityEvent('SQL_INJECTION_ATTEMPT', {
      type: 'query',
      data: req.query
    }, req);
    
    res.status(400).json({
      error: 'Bad request',
      message: 'Invalid characters detected in request'
    });
    return;
  }
  
  // Check request body
  if (req.body && checkForSQLInjection(req.body)) {
    logSecurityEvent('SQL_INJECTION_ATTEMPT', {
      type: 'body',
      data: req.body
    }, req);
    
    res.status(400).json({
      error: 'Bad request',
      message: 'Invalid characters detected in request'
    });
    return;
  }
  
  next();
};

/**
 * XSS protection middleware
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi
  ];
  
  const sanitizeString = (str: string): string => {
    return str.replace(/[<>"'&]/g, (match) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match];
    });
  };
  
  const checkForXSS = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return xssPatterns.some(pattern => pattern.test(obj));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (checkForXSS(value)) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  // Check for XSS in query parameters
  if (checkForXSS(req.query)) {
    logSecurityEvent('XSS_ATTEMPT', {
      type: 'query',
      data: req.query
    }, req);
    
    res.status(400).json({
      error: 'Bad request',
      message: 'Potentially malicious content detected'
    });
    return;
  }
  
  // Check for XSS in request body
  if (req.body && checkForXSS(req.body)) {
    logSecurityEvent('XSS_ATTEMPT', {
      type: 'body',
      data: req.body
    }, req);
    
    res.status(400).json({
      error: 'Bad request',
      message: 'Potentially malicious content detected'
    });
    return;
  }
  
  next();
};

/**
 * Request signature validation middleware
 */
export const validateRequestSignature = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.get('X-Signature') || req.get('X-Hub-Signature-256');
    
    if (!signature) {
      logSecurityEvent('MISSING_SIGNATURE', {}, req);
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Request signature is required'
      });
      return;
    }
    
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      logSecurityEvent('INVALID_SIGNATURE', {
        providedSignature,
        expectedSignature
      }, req);
      
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid request signature'
      });
      return;
    }
    
    next();
  };
};

/**
 * Brute force protection middleware
 */
export const bruteForceProtection = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many failed attempts',
    message: 'Account temporarily locked due to too many failed login attempts'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `brute_force:${req.ip}:${req.body.email || req.body.username || 'unknown'}`;
  },
  onLimitReached: (req: Request) => {
    logSecurityEvent('BRUTE_FORCE_DETECTED', {
      ip: req.ip,
      email: req.body.email || req.body.username
    }, req);
  }
});

/**
 * Slow down middleware for suspicious activity
 */
export const suspiciousActivitySlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // Allow 10 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: (req: Request) => req.ip || 'unknown',
  onLimitReached: (req: Request) => {
    logSecurityEvent('SUSPICIOUS_ACTIVITY_SLOWDOWN', {
      ip: req.ip,
      path: req.path
    }, req);
  }
});

/**
 * Comprehensive security middleware stack
 */
export const securityStack = [
  helmetSecurity,
  requestSizeLimiter(),
  validateUserAgent,
  sqlInjectionProtection,
  xssProtection,
  suspiciousActivitySlowDown
];

export default {
  helmetSecurity,
  ipWhitelist,
  validateUserAgent,
  requestSizeLimiter,
  sqlInjectionProtection,
  xssProtection,
  validateRequestSignature,
  bruteForceProtection,
  suspiciousActivitySlowDown,
  securityStack
};