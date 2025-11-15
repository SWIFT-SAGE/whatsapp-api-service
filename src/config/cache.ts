import { logger } from '../utils/logger';

/**
 * Simple in-memory cache implementation
 * For production, replace with Redis
 */
class CacheManager {
  private cache: Map<string, { value: any; expiry: number }>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.cache = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Set cache value with TTL
   */
  set(key: string, value: any, ttlSeconds: number = 300): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
    logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Get cache value
   */
  get<T = any>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      logger.debug(`Cache MISS: ${key}`);
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }

    logger.debug(`Cache HIT: ${key}`);
    return item.value as T;
  }

  /**
   * Delete cache key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache CLEARED: ${size} items removed`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get or set pattern - fetch from cache or execute function
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch new data
    const value = await fetchFn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Start cleanup interval to remove expired items
   */
  private startCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let removed = 0;

      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiry) {
          this.cache.delete(key);
          removed++;
        }
      }

      if (removed > 0) {
        logger.debug(`Cache cleanup: removed ${removed} expired items`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string): number {
    let removed = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`Cache invalidated: ${removed} items matching pattern "${pattern}"`);
    }

    return removed;
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Cache key generators
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userSessions: (userId: string) => `user:${userId}:sessions`,
  session: (sessionId: string) => `session:${sessionId}`,
  messages: (sessionId: string, page: number) => `messages:${sessionId}:${page}`,
  analytics: (userId: string, period: string) => `analytics:${userId}:${period}`,
  dashboardStats: (userId: string) => `dashboard:${userId}:stats`,
  templates: (userId: string) => `templates:${userId}`,
  webhooks: (userId: string) => `webhooks:${userId}`,
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 1800,       // 30 minutes
  VERY_LONG: 3600,  // 1 hour
};

export default cache;

