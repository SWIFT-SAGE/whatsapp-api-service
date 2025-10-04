import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// Using in-memory store for rate limiting instead of Redis
// Note: In a production environment with multiple instances,
// you might want to use a distributed solution or database for rate limiting

/**
 * General API rate limiter
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ping';
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for ${req.user?.id || req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `auth:${req.ip}`,
  handler: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Message sending rate limiter
 */
export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => {
    // Different limits based on subscription plan
    if (!req.user) return 10;
    
    switch (req.user.subscription.plan) {
      case 'enterprise':
        return 10000; // Unlimited messages
      case 'pro':
        return 5000; // High limit for pro
      case 'basic':
        return 500; // Moderate limit for basic
      case 'free':
      default:
        return 50; // Conservative limit for free
    }
  },
  message: {
    error: 'Message rate limit exceeded for your subscription plan.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `messages:${req.user?.id || req.ip}`,
  handler: (req: Request, res: Response) => {
    logger.warn(`Message rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      error: 'Message rate limit exceeded for your subscription plan.',
      retryAfter: '1 minute'
    });
  }
});

/**
 * Webhook rate limiter
 */
export const webhookRateLimit = rateLimit({
  // Using in-memory store by default
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook calls per minute
  message: {
    error: 'Webhook rate limit exceeded.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `webhook:${req.user?.id || req.ip}`,
  handler: (req: Request, res: Response) => {
    logger.warn(`Webhook rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      error: 'Webhook rate limit exceeded.',
      retryAfter: '1 minute'
    });
  }
});

/**
 * API key rate limiter
 */
export const apiKeyRateLimit = rateLimit({
  // Using in-memory store by default
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => {
    // Different limits based on subscription plan
    if (!req.user) return 50;
    
    switch (req.user.subscription.plan) {
      case 'enterprise':
        return 20000; // Very high API limit
      case 'pro':
        return 10000; // High API limit
      case 'basic':
        return 1000; // Moderate API limit
      case 'free':
      default:
        return 100; // Basic API limit
    }
  },
  message: {
    error: 'API rate limit exceeded for your subscription plan.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `api:${req.user?.id || req.ip}`,
  handler: (req: Request, res: Response) => {
    logger.warn(`API rate limit exceeded for user ${req.user?.id}`);
    res.status(429).json({
      error: 'API rate limit exceeded for your subscription plan.',
      retryAfter: '1 minute'
    });
  }
});

/**
 * Custom rate limiter factory
 */
export const createCustomRateLimit = (options: {
  windowMs: number;
  max: number | ((req: Request) => number);
  message?: string;
  keyPrefix?: string;
}) => {
  return rateLimit({
    // Using in-memory store by default
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: options.message || 'Rate limit exceeded.',
      retryAfter: `${Math.ceil(options.windowMs / 1000)} seconds`
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const prefix = options.keyPrefix || 'custom';
      return `${prefix}:${req.user?.id || req.ip}`;
    },
    handler: (req: Request, res: Response) => {
      logger.warn(`Custom rate limit exceeded for ${req.user?.id || req.ip}`);
      res.status(429).json({
        error: options.message || 'Rate limit exceeded.',
        retryAfter: `${Math.ceil(options.windowMs / 1000)} seconds`
      });
    }
  });
};

/**
 * Middleware to check user-specific rate limits from database
 */
export const checkUserRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      next();
      return;
    }

    const user = req.user;
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 1000); // 1 minute window

    // Check if user has exceeded their plan limits
    const planLimits = {
      free: { messagesPerMinute: 10, apiCallsPerMinute: 50 },
      basic: { messagesPerMinute: 100, apiCallsPerMinute: 200 },
      pro: { messagesPerMinute: 500, apiCallsPerMinute: 1000 },
      enterprise: { messagesPerMinute: 1000, apiCallsPerMinute: 2000 }
    };

    const limits = planLimits[user.subscription.plan as keyof typeof planLimits] || planLimits.free;

    // This would typically check against a usage tracking system
    // For now, we'll rely on the express-rate-limit middleware above
    
    next();
  } catch (error) {
    logger.error('Error checking user rate limit:', error);
    next(); // Continue on error to avoid blocking requests
  }
};

export default {
  generalRateLimit,
  authRateLimit,
  messageRateLimit,
  webhookRateLimit,
  apiKeyRateLimit,
  createCustomRateLimit,
  checkUserRateLimit
};