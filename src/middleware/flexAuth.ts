import { Request, Response, NextFunction } from 'express';
import { authenticateToken, authenticateApiKey } from './auth';
import { logger } from '../utils/logger';

/**
 * Flexible authentication middleware that accepts both JWT token and API key
 * Tries JWT token first (for dashboard), then API key (for external API calls)
 */
export const flexibleAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Check if JWT token exists (cookie-based auth for dashboard)
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    // Try JWT authentication first
    logger.debug('Attempting JWT authentication');
    return authenticateToken(req, res, next);
  }
  
  // Check if API key exists (header-based auth for API)
  const apiKey = req.headers['x-api-key'] as string;
  
  if (apiKey) {
    // Try API key authentication
    logger.debug('Attempting API key authentication');
    return authenticateApiKey(req, res, next);
  }
  
  // No authentication provided
  logger.warn('No authentication credentials provided');
  res.status(401).json({ 
    success: false,
    error: 'Authentication required. Please provide either a JWT token or API key.' 
  });
};

export default flexibleAuth;

