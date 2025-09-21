import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { logger } from '../utils/logger';
import { config } from '../config';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    
    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader) {
      token = authHeader.split(' ')[1]; // Bearer TOKEN
    }
    
    // If no token in header, check cookies
    if (!token) {
      token = req.cookies?.authToken;
    }
    
    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    // Validate token format
    if (typeof token !== 'string' || token.length < 10) {
      logger.warn('Invalid token format received', { 
        tokenLength: token?.length || 0,
        tokenType: typeof token,
        tokenPreview: token ? token.substring(0, 10) + '...' : 'undefined'
      });
      res.status(401).json({ error: 'Invalid token format' });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else {
      res.status(403).json({ error: 'Authentication failed' });
    }
  }
};

/**
 * Middleware to authenticate API key
 */
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    logger.info('API Key authentication attempt:', { 
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'none',
      endpoint: req.path,
      method: req.method
    });

    if (!apiKey) {
      logger.warn('No API key provided');
      res.status(401).json({ error: 'API key required' });
      return;
    }

    const user = await User.findOne({ apiKey }).select('-password');
    
    logger.info('User lookup result:', { 
      userFound: !!user,
      userId: user?._id,
      subscriptionActive: user?.subscription?.isActive
    });

    if (!user) {
      logger.warn('Invalid API key provided');
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    if (!user.subscription.isActive) {
      logger.warn('User subscription inactive', { userId: user._id });
      res.status(403).json({ error: 'Subscription inactive' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to check subscription plan
 */
export const requireSubscription = (requiredPlans: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!requiredPlans.includes(req.user.subscription.plan)) {
      res.status(403).json({ 
        error: 'Insufficient subscription plan',
        currentPlan: req.user.subscription.plan,
        requiredPlans
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user is verified
 */
export const requireVerification = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    logger.warn('No user found in requireVerification');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  logger.info('Verification check:', { 
    userId: req.user._id,
    isVerified: req.user.isVerified,
    isEmailVerified: req.user.isEmailVerified
  });

  if (!req.user.isVerified) {
    logger.warn('User not verified', { userId: req.user._id });
    res.status(403).json({ error: 'Email verification required' });
    return;
  }

  next();
};

/**
 * Optional authentication - sets user if token is valid but doesn't fail if not
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    
    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader) {
      token = authHeader.split(' ')[1];
    }
    
    // If no token in header, check cookies
    if (!token) {
      token = req.cookies?.authToken;
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const user = await User.findById(decoded.userId).select('-password');
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Silently continue without user
    next();
  }
};
