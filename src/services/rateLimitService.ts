import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import User from '../models/User';

class RateLimitService {
  private redis: Redis;
  private freePlanLimiter!: RateLimiterRedis;
  private basicPlanLimiter!: RateLimiterRedis;
  private apiLimiter!: RateLimiterRedis;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    this.redis.on('error', (err: Error) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('✓ Connected to Redis for rate limiting');
    });

    // Initialize rate limiters
    this.initializeLimiters();
  }

  private initializeLimiters(): void {
    // Free plan: 3 messages per day
    this.freePlanLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'free_plan',
      points: 3, // Number of requests
      duration: 86400, // Per 24 hours (in seconds)
      blockDuration: 86400, // Block for 24 hours if limit exceeded
    });

    // Basic plan: 10,000 messages per month
    this.basicPlanLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'basic_plan',
      points: 10000,
      duration: 2592000, // Per 30 days (in seconds)
      blockDuration: 3600, // Block for 1 hour if limit exceeded
    });

    // API rate limiting: 100 requests per 15 minutes
    this.apiLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'api_requests',
      points: 100,
      duration: 900, // 15 minutes
      blockDuration: 900, // Block for 15 minutes
    });
  }

  /**
   * Check if user can send message based on subscription
   */
  async canSendMessage(userId: string): Promise<{ allowed: boolean; remainingPoints?: number; resetTime?: Date; error?: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { allowed: false, error: 'User not found' };
      }

      // Premium users have unlimited messages
      if (user.subscription.plan === 'premium') {
        return { allowed: true };
      }

      const limiter = user.subscription.plan === 'basic' ? this.basicPlanLimiter : this.freePlanLimiter;
      const key = `${user.subscription.plan}_${userId}`;

      try {
        const result = await limiter.consume(key);
        return {
          allowed: true,
          remainingPoints: result.remainingPoints,
          resetTime: new Date(Date.now() + result.msBeforeNext)
        };
      } catch (rejRes: any) {
        return {
          allowed: false,
          remainingPoints: rejRes.remainingPoints || 0,
          resetTime: new Date(Date.now() + rejRes.msBeforeNext),
          error: 'Rate limit exceeded'
        };
      }
    } catch (error) {
      logger.error('Error checking message rate limit:', error);
      return { allowed: false, error: 'Internal error' };
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
      const limiter = plan === 'basic' ? this.basicPlanLimiter : this.freePlanLimiter;
      const key = `${plan}_${userId}`;

      const result = await limiter.get(key);
      return result ? result.remainingPoints || 0 : (plan === 'basic' ? 10000 : 3);
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
      const limiter = plan === 'basic' ? this.basicPlanLimiter : this.freePlanLimiter;
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
      const limiter = plan === 'basic' ? this.basicPlanLimiter : this.freePlanLimiter;
      const key = `${plan}_${userId}`;
      const limit = plan === 'basic' ? 10000 : 3;

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
      return { used: 0, limit: plan === 'basic' ? 10000 : 3 };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export default new RateLimitService();
