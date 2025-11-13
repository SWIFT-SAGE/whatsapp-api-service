import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { logger } from '../utils/logger';
import { config } from '../config';

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

/**
 * Middleware to authenticate JWT tokens for web routes (redirects to login)
 */
export const authenticateWeb = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    
    logger.info('Web authentication check', {
      hasAuthHeader: !!authHeader,
      hasCookieToken: !!req.cookies?.authToken,
      tokenLength: token?.length || 0,
      url: req.url
    });
    
    if (!token) {
      logger.info('No token found, redirecting to login');
      // Clear any invalid cookies
      res.clearCookie('authToken');
      // Set cache control headers to prevent caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.redirect('/login');
      return;
    }

    // Validate token format
    if (typeof token !== 'string' || token.length < 10) {
      logger.warn('Invalid token format received for web route', { 
        tokenLength: token?.length || 0,
        tokenType: typeof token,
        tokenPreview: token ? token.substring(0, 10) + '...' : 'undefined'
      });
      // Clear invalid cookie
      res.clearCookie('authToken');
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.redirect('/login');
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      logger.warn('User not found for token, redirecting to login');
      res.clearCookie('authToken');
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.redirect('/login');
      return;
    }

    logger.info('Web authentication successful', { userId: user._id });
    req.user = user;
    next();
  } catch (error) {
    logger.error('Web authentication error:', error);
    res.clearCookie('authToken');
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.redirect('/login');
  }
};

/**
 * Middleware to authenticate JWT tokens for API routes (returns JSON)
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

    const user = req.user as IUser;
    if (!requiredPlans.includes(user.subscription.plan)) {
      res.status(403).json({ 
        error: 'Insufficient subscription plan',
        currentPlan: user.subscription.plan,
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

  const user = req.user as IUser;
  logger.info('Verification check:', { 
    userId: user._id,
    isVerified: user.isVerified,
    isEmailVerified: user.isEmailVerified
  });

  if (!user.isVerified) {
    logger.warn('User not verified', { userId: user._id });
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
