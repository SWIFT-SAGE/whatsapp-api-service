import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';
import redisClient, { isRedisAvailable } from '../config/redis';

// Lazy-load RateLimiterRedis to avoid hard failure if ioredis isn't installed
let RateLimiterRedis: any;
try {
  RateLimiterRedis = require('rate-limiter-flexible').RateLimiterRedis;
} catch {
  // falls back to memory store
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a RateLimiterRedis when Redis is available, else RateLimiterMemory.
 * Called lazily on first request so Redis has time to connect.
 */
const makeLimiter = (opts: {
  keyPrefix: string;
  points: number;
  duration: number; // seconds
}): RateLimiterAbstract => {
  if (redisClient && isRedisAvailable()) {
    return new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: opts.keyPrefix,
      points: opts.points,
      duration: opts.duration,
    });
  }
  return new RateLimiterMemory({
    keyPrefix: opts.keyPrefix,
    points: opts.points,
    duration: opts.duration,
  });
};

/**
 * Convert a rate-limiter-flexible limiter into Express middleware.
 */
const toMiddleware = (
  getLimiter: () => RateLimiterAbstract,
  keyFn: (req: Request) => string,
  retryMsg: string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limiter = getLimiter();
      await limiter.consume(keyFn(req));
      next();
    } catch {
      logger.warn(`Rate limit exceeded: ${keyFn(req)} on ${req.path}`);
      res.set('Retry-After', retryMsg);
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.', retryAfter: retryMsg },
      });
    }
  };
};

// ─── Limiter singletons (created once on first use) ─────────────────────────

let _general: RateLimiterAbstract | null = null;
const getGeneral = () => {
  if (!_general) _general = makeLimiter({ keyPrefix: 'rl:general', points: 1000, duration: 900 }); // 1000/15 min
  return _general;
};

let _auth: RateLimiterAbstract | null = null;
const getAuth = () => {
  if (!_auth) _auth = makeLimiter({ keyPrefix: 'rl:auth', points: 5, duration: 900 }); // 5/15 min
  return _auth;
};

let _msgFree: RateLimiterAbstract | null = null;
const getMsgFree = () => {
  if (!_msgFree) _msgFree = makeLimiter({ keyPrefix: 'rl:msg:free', points: 5, duration: 60 });
  return _msgFree;
};

let _msgBasic: RateLimiterAbstract | null = null;
const getMsgBasic = () => {
  if (!_msgBasic) _msgBasic = makeLimiter({ keyPrefix: 'rl:msg:basic', points: 1000, duration: 60 });
  return _msgBasic;
};

let _msgPro: RateLimiterAbstract | null = null;
const getMsgPro = () => {
  if (!_msgPro) _msgPro = makeLimiter({ keyPrefix: 'rl:msg:pro', points: 100000, duration: 60 });
  return _msgPro;
};

// ─── Exported middleware ─────────────────────────────────────────────────────

/** General API — 1 000 req / 15 min per user-or-IP */
export const generalRateLimit = toMiddleware(
  getGeneral,
  (req) => `general:${(req.user as any)?._id || req.ip}`,
  '15 minutes'
);

/** Auth endpoints — 5 attempts / 15 min per IP */
export const authRateLimit = toMiddleware(
  getAuth,
  (req) => `auth:${req.ip}`,
  '15 minutes'
);

/** Message sending — plan-aware limits */
export const messageRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const plan = (req.user as any)?.subscription?.plan || 'free';
  const key = `msg:${(req.user as any)?._id || req.ip}`;
  const getLimiter =
    plan === 'pro' ? getMsgPro : plan === 'basic' ? getMsgBasic : getMsgFree;

  try {
    await getLimiter().consume(key);
    next();
  } catch {
    logger.warn(`Message rate limit exceeded for user ${(req.user as any)?._id} (plan: ${plan})`);
    res.status(429).json({
      success: false,
      error: {
        code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
        message: 'Message rate limit exceeded for your subscription plan.',
        plan,
        retryAfter: '1 minute',
      },
    });
  }
};

/** Webhooks — 100/min per user */
export const webhookRateLimit = toMiddleware(
  () => makeLimiter({ keyPrefix: 'rl:webhook', points: 100, duration: 60 }),
  (req) => `webhook:${(req.user as any)?._id || req.ip}`,
  '1 minute'
);

/** API-key callers — plan-aware */
export const apiKeyRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const plan = (req.user as any)?.subscription?.plan || 'free';
  const points = plan === 'pro' ? 20000 : plan === 'basic' ? 2000 : 10;
  const limiter = makeLimiter({ keyPrefix: `rl:apikey:${plan}`, points, duration: 60 });

  try {
    await limiter.consume(`apikey:${(req.user as any)?._id || req.ip}`);
    next();
  } catch {
    res.status(429).json({
      success: false,
      error: {
        code: 'API_RATE_LIMIT_EXCEEDED',
        message: 'API rate limit exceeded for your subscription plan.',
        plan,
        retryAfter: '1 minute',
      },
    });
  }
};

/** Factory for custom rate limits */
export const createCustomRateLimit = (opts: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}) => {
  const limiter = makeLimiter({
    keyPrefix: opts.keyPrefix || 'rl:custom',
    points: opts.max,
    duration: Math.ceil(opts.windowMs / 1000),
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await limiter.consume(`${opts.keyPrefix || 'custom'}:${(req.user as any)?._id || req.ip}`);
      next();
    } catch {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: opts.message || 'Rate limit exceeded.' },
      });
    }
  };
};

/** No-op passthrough — kept for compatibility */
export const checkUserRateLimit = (_req: Request, _res: Response, next: NextFunction) => next();

export default {
  generalRateLimit,
  authRateLimit,
  messageRateLimit,
  webhookRateLimit,
  apiKeyRateLimit,
  createCustomRateLimit,
  checkUserRateLimit,
};
