import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware to add query optimization hints
 */
export const queryOptimization = (req: Request, res: Response, next: NextFunction): void => {
  // Add lean() hint for read-only queries
  req.queryHints = {
    lean: true, // Return plain JavaScript objects instead of Mongoose documents
    limit: 100, // Default limit to prevent large result sets
    select: null // Fields to select (null = all)
  };

  next();
};

/**
 * Middleware to log slow queries
 */
export const slowQueryLogger = (threshold: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Override res.json to capture response time
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        logger.warn('Slow query detected', {
          method: req.method,
          url: req.originalUrl,
          duration: `${duration}ms`,
          query: req.query,
          body: req.body
        });
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Add pagination helpers to request
 */
export const paginationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items
  const skip = (page - 1) * limit;

  req.pagination = {
    page,
    limit,
    skip
  };

  next();
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      queryHints?: {
        lean: boolean;
        limit: number;
        select: string | null;
      };
      pagination?: {
        page: number;
        limit: number;
        skip: number;
      };
    }
  }
}

export default {
  queryOptimization,
  slowQueryLogger,
  paginationMiddleware
};

