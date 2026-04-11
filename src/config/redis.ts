import IORedis from 'ioredis';
import { logger } from '../utils/logger';

type RedisClient = InstanceType<typeof IORedis>;

let redisClient: RedisClient | null = null;
let redisAvailable = false;

/**
 * Create a Redis client if REDIS_URL is configured.
 * Falls back gracefully — in-memory fallback is used in rate limiter.
 */
const createRedisClient = (): RedisClient | null => {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set — rate limiting will use in-memory store (not suitable for multi-instance deployments)');
    return null;
  }

  try {
    const client = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });

    client.on('connect', () => {
      redisAvailable = true;
      logger.info('Redis connected — distributed rate limiting active');
    });

    client.on('error', (err: Error) => {
      if (redisAvailable) {
        logger.warn('Redis connection error — falling back to in-memory rate limiting:', err.message);
        redisAvailable = false;
      }
    });

    client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    client.connect().catch(() => {
      // logged via 'error' event
    });

    return client;
  } catch (err) {
    logger.warn('Failed to create Redis client:', err);
    return null;
  }
};

export const getRedisClient = (): RedisClient | null => redisClient;
export const isRedisAvailable = (): boolean => redisAvailable;

// Initialise once at module load
redisClient = createRedisClient();

export default redisClient;
