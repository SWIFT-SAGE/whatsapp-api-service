import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';
import User from '../models/User';

class RateLimitService {
  private freePlanLimiter!: RateLimiterMemory;
  private basicPlanLimiter!: RateLimiterMemory;
  private proPlanLimiter!: RateLimiterMemory;
  private apiLimiter!: RateLimiterMemory;

  constructor() {
    // Initialize rate limiters using in-memory storage
    this.initializeLimiters();
    logger.info('✓ Initialized in-memory rate limiters');
  }

  private initializeLimiters(): void {
    // Free plan: 5 messages total (not per day)
    this.freePlanLimiter = new RateLimiterMemory({
      keyPrefix: 'free_plan',
      points: 5, // Number of requests
      duration: 2592000, // Per 30 days (in seconds) - monthly reset
      blockDuration: 86400, // Block for 24 hours if limit exceeded
    });

    // Basic plan: 100,000 messages per month
    this.basicPlanLimiter = new RateLimiterMemory({
      keyPrefix: 'basic_plan',
      points: 100000,
      duration: 2592000, // Per 30 days (in seconds) - monthly reset
      blockDuration: 3600, // Block for 1 hour if limit exceeded
    });

    // Pro plan: Unlimited messages from API (very high limit for rate limiter)
    this.proPlanLimiter = new RateLimiterMemory({
      keyPrefix: 'pro_plan',
      points: 999999999, // Effectively unlimited
      duration: 2592000, // Per 30 days (in seconds)
      blockDuration: 1800, // Block for 30 minutes if limit exceeded
    });

    // API rate limiting: 100 requests per 15 minutes
    this.apiLimiter = new RateLimiterMemory({
      keyPrefix: 'api_requests',
      points: 100,
      duration: 900, // 15 minutes
      blockDuration: 900, // Block for 15 minutes
    });
  }

  /**
   * Check if user can send message based on subscription
   */
  async canSendMessage(userId: string, plan?: 'free' | 'basic' | 'pro'): Promise<{ allowed: boolean; remainingPoints?: number; resetTime?: Date }> {
    // Plan-based limits:
    // Free: 5 messages total
    // Basic: 100,000 messages/month
    // Pro: Unlimited API messages
    try {
      // If no plan provided, default to free
      const userPlan = plan || 'free';
      let limiter: RateLimiterMemory;
      
      switch (userPlan) {
        case 'free':
          limiter = this.freePlanLimiter;
          break;
        case 'basic':
          limiter = this.basicPlanLimiter;
          break;
        case 'pro':
          // Pro plan has unlimited API messages, so always return true
          return { allowed: true, remainingPoints: 999999999 };
        default:
          throw new Error(`Unknown plan: ${userPlan}`);
      }

      const result = await limiter.consume(userId);
      return {
        allowed: true,
        remainingPoints: result.remainingPoints,
        resetTime: new Date(Date.now() + result.msBeforeNext)
      };
    } catch (rejRes: any) {
      return {
        allowed: false,
        remainingPoints: rejRes.remainingPoints || 0,
        resetTime: new Date(Date.now() + (rejRes.msBeforeNext || 0))
      };
    }
  }

  /**
   * Check API rate limit
   */
  async checkApiRateLimit(identifier: string): Promise<{ allowed: boolean; remainingPoints?: number; resetTime?: Date }> {
    try {
      const result = await this.apiLimiter.consume(identifier);
      return {
        allowed: true,
        remainingPoints: result.remainingPoints,
        resetTime: new Date(Date.now() + result.msBeforeNext)
      };
    } catch (rejRes: any) {
      return {
        allowed: false,
        remainingPoints: rejRes.remainingPoints || 0,
        resetTime: new Date(Date.now() + rejRes.msBeforeNext)
      };
    }
  }

  /**
   * Get remaining points for user
   */
  async getRemainingPoints(userId: string, plan: string): Promise<number> {
    try {
      const getLimiter = (planName: string) => {
        switch (planName) {
          case 'pro': return this.proPlanLimiter;
          case 'basic': return this.basicPlanLimiter;
          case 'free':
          default: return this.freePlanLimiter;
        }
      };
      const limiter = getLimiter(plan);
      const key = `${plan}_${userId}`;

      const result = await limiter.get(key);
      const getDefaultLimit = (planName: string) => {
        switch (planName) {
          case 'pro': return 100000;
          case 'basic': return 10000;
          case 'free':
          default: return 100;
        }
      };
      return result ? result.remainingPoints || 0 : getDefaultLimit(plan);
    } catch (error) {
      logger.error('Error getting remaining points:', error);
      return 0;
    }
  }

  /**
   * Reset user's rate limit (admin function)
   */
  async resetUserLimit(userId: string, plan: string): Promise<boolean> {
    try {
      const getLimiter = (planName: string) => {
        switch (planName) {
          case 'pro': return this.proPlanLimiter;
          case 'basic': return this.basicPlanLimiter;
          case 'free':
          default: return this.freePlanLimiter;
        }
      };
      const limiter = getLimiter(plan);
      const key = `${plan}_${userId}`;

      await limiter.delete(key);
      logger.info(`Reset rate limit for user ${userId} on ${plan} plan`);
      return true;
    } catch (error) {
      logger.error('Error resetting user limit:', error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string, plan: string): Promise<{ used: number; limit: number; resetTime?: Date }> {
    try {
      const getLimiter = (planName: string) => {
        switch (planName) {
          case 'pro': return this.proPlanLimiter;
          case 'basic': return this.basicPlanLimiter;
          case 'free':
          default: return this.freePlanLimiter;
        }
      };
      const limiter = getLimiter(plan);
      const key = `${plan}_${userId}`;
      const getLimit = (planName: string) => {
        switch (planName) {
          case 'pro': return 100000;
          case 'basic': return 10000;
          case 'free':
          default: return 100;
        }
      };
      const limit = getLimit(plan);

      const result = await limiter.get(key);
      if (!result) {
        return { used: 0, limit };
      }

      return {
        used: limit - (result.remainingPoints || 0),
        limit,
        resetTime: new Date(Date.now() + (result.msBeforeNext || 0))
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      const getLimit = (planName: string) => {
        switch (planName) {
          case 'pro': return 100000;
          case 'basic': return 10000;
          case 'free':
          default: return 100;
        }
      };
      return { used: 0, limit: getLimit(plan) };
    }
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    // No Redis connection to clean up with in-memory storage
    logger.info('Rate limit service cleaned up');
  }
}

export default new RateLimitService();
