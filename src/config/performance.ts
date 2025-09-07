import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { config } from './index';

// Compression configuration
export const compressionConfig = {
  // Main compression middleware
  middleware: compression({
    level: config.performance.compression.level,
    threshold: config.performance.compression.threshold,
    filter: (req: Request, res: Response) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Don't compress images, videos, or already compressed files
      const contentType = res.getHeader('content-type') as string;
      if (contentType) {
        const skipTypes = [
          'image/',
          'video/',
          'audio/',
          'application/zip',
          'application/gzip',
          'application/x-rar',
          'application/pdf',
        ];
        
        if (skipTypes.some(type => contentType.startsWith(type))) {
          return false;
        }
      }
      
      // Use compression filter
      return compression.filter(req, res);
    },
  }),
  
  // Brotli compression for modern browsers
  brotliConfig: {
    enabled: true,
    quality: 6, // 0-11, higher = better compression but slower
    chunkSize: 1024,
  },
};

// Caching strategies
export const cachingConfig = {
  // Static assets caching
  staticAssets: {
    maxAge: '1y', // 1 year for static assets
    etag: true,
    lastModified: true,
    immutable: true,
  },
  
  // API response caching
  apiCache: {
    defaultTTL: config.performance.cache.ttl,
    checkPeriod: config.performance.cache.checkPeriod,
    maxKeys: 1000,
    
    // Cache keys for different endpoints
    keys: {
      userProfile: (userId: string) => `user:profile:${userId}`,
      sessionInfo: (sessionId: string) => `session:info:${sessionId}`,
      analytics: (userId: string, period: string) => `analytics:${userId}:${period}`,
      webhooks: (userId: string) => `webhooks:${userId}`,
    },
    
    // TTL for different data types
    ttl: {
      userProfile: 300, // 5 minutes
      sessionInfo: 60, // 1 minute
      analytics: 1800, // 30 minutes
      webhooks: 600, // 10 minutes
      messageStats: 120, // 2 minutes
    },
  },
  
  // Redis caching middleware
  redisCache: (ttl: number = 300) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') {
        return next();
      }
      
      const cacheKey = `cache:${req.originalUrl}`;
      
      try {
        // Try to get from cache (Redis implementation would go here)
        // For now, just continue to next middleware
        next();
      } catch (error) {
        // If cache fails, continue without caching
        next();
      }
    };
  },
};

// Database optimization
export const databaseOptimization = {
  // Connection pooling settings
  connectionPool: {
    min: config.isDevelopment ? 2 : 5,
    max: config.isProduction ? 20 : 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  
  // Query optimization
  queryOptimization: {
    // Pagination defaults
    defaultLimit: 20,
    maxLimit: 100,
    
    // Index hints for common queries
    indexes: {
      users: ['email', 'apiKey', 'createdAt'],
      sessions: ['userId', 'status', 'createdAt'],
      messages: ['sessionId', 'timestamp', 'type', 'status'],
      webhooks: ['userId', 'events', 'active'],
      analytics: ['userId', 'timestamp', 'eventType'],
    },
    
    // Query timeouts
    timeouts: {
      select: 10000, // 10 seconds
      insert: 5000,  // 5 seconds
      update: 5000,  // 5 seconds
      delete: 3000,  // 3 seconds
    },
  },
};

// Memory optimization
export const memoryOptimization = {
  // Garbage collection hints
  gc: {
    // Force GC after processing large requests
    forceGCThreshold: 100 * 1024 * 1024, // 100MB
    
    // Memory usage monitoring
    memoryWarningThreshold: 0.8, // 80% of available memory
    memoryErrorThreshold: 0.95,  // 95% of available memory
  },
  
  // Object pooling for frequently created objects
  objectPools: {
    // Pool for response objects
    responsePool: {
      max: 100,
      min: 10,
    },
    
    // Pool for request processing objects
    requestPool: {
      max: 50,
      min: 5,
    },
  },
  
  // Memory monitoring middleware
  memoryMonitor: (req: Request, res: Response, next: NextFunction) => {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = usedMemory / totalMemory;
    
    // Add memory info to response headers in development
    if (config.isDevelopment) {
      res.setHeader('X-Memory-Usage', `${Math.round(memoryUsagePercent * 100)}%`);
      res.setHeader('X-Memory-Used', `${Math.round(usedMemory / 1024 / 1024)}MB`);
    }
    
    // Log warning if memory usage is high
    if (memoryUsagePercent > memoryOptimization.gc.memoryWarningThreshold) {
      console.warn(`High memory usage: ${Math.round(memoryUsagePercent * 100)}%`);
    }
    
    next();
  },
};

// Request optimization
export const requestOptimization = {
  // Request parsing limits
  bodyParser: {
    json: {
      limit: '10mb',
      strict: true,
      type: 'application/json',
    },
    urlencoded: {
      limit: '10mb',
      extended: true,
      parameterLimit: 1000,
    },
    raw: {
      limit: '50mb',
      type: 'application/octet-stream',
    },
  },
  
  // Request timeout configuration
  timeout: {
    server: 30000,    // 30 seconds server timeout
    request: 25000,   // 25 seconds request timeout
    keepAlive: 5000,  // 5 seconds keep-alive timeout
  },
  
  // Request deduplication
  deduplication: {
    enabled: true,
    windowMs: 1000, // 1 second window
    keyGenerator: (req: Request) => {
      return `${req.ip}:${req.method}:${req.originalUrl}:${JSON.stringify(req.body)}`;
    },
  },
};

// Response optimization
export const responseOptimization = {
  // Response headers for performance
  headers: {
    // Cache control for different content types
    cacheControl: {
      static: 'public, max-age=31536000, immutable', // 1 year
      api: 'private, no-cache, no-store, must-revalidate',
      html: 'private, no-cache',
    },
    
    // Performance hints
    performance: {
      'X-DNS-Prefetch-Control': 'on',
      'X-Preload': 'prefetch',
    },
  },
  
  // Response streaming for large data
  streaming: {
    enabled: true,
    chunkSize: 64 * 1024, // 64KB chunks
    highWaterMark: 16 * 1024, // 16KB buffer
  },
  
  // JSON response optimization
  json: {
    // Remove null values to reduce payload size
    removeNull: true,
    
    // Compress JSON responses
    compress: true,
    
    // Use faster JSON serialization
    fastStringify: true,
  },
};

// CDN and asset optimization
export const assetOptimization = {
  // Static file serving
  static: {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    index: false,
    dotfiles: 'ignore',
    
    // Set proper MIME types
    setHeaders: (res: Response, path: string) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      } else if (path.endsWith('.woff2')) {
        res.setHeader('Content-Type', 'font/woff2');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  },
  
  // Image optimization
  images: {
    // Supported formats in order of preference
    formats: ['webp', 'avif', 'jpeg', 'png'],
    
    // Quality settings
    quality: {
      webp: 80,
      avif: 75,
      jpeg: 85,
      png: 90,
    },
    
    // Responsive image sizes
    sizes: [320, 640, 768, 1024, 1280, 1920],
  },
};

// Performance monitoring
export const performanceMonitoring = {
  // Request timing middleware
  timing: (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Add timing header
      res.setHeader('X-Response-Time', `${duration}ms`);
      
      // Log slow requests
      if (duration > 1000) { // Slower than 1 second
        console.warn(`Slow request: ${req.method} ${req.originalUrl} - ${duration}ms`);
      }
      
      // Store metrics (would integrate with monitoring service)
      if (config.monitoring.metrics) {
        // Store timing metrics
      }
    });
    
    next();
  },
  
  // Performance metrics collection
  metrics: {
    // Request metrics
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      averageResponseTime: 0,
    },
    
    // System metrics
    system: {
      memoryUsage: () => process.memoryUsage(),
      cpuUsage: () => process.cpuUsage(),
      uptime: () => process.uptime(),
    },
  },
};

// Load balancing and clustering
export const scalingConfig = {
  // Cluster configuration
  cluster: {
    enabled: config.isProduction,
    workers: config.isProduction ? require('os').cpus().length : 1,
    
    // Worker process settings
    worker: {
      maxMemory: '512mb',
      restartDelay: 1000,
      maxRestarts: 5,
    },
  },
  
  // Load balancing strategies
  loadBalancing: {
    strategy: 'round-robin', // 'round-robin', 'least-connections', 'ip-hash'
    healthCheck: {
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3,
    },
  },
};

export default {
  compressionConfig,
  cachingConfig,
  databaseOptimization,
  memoryOptimization,
  requestOptimization,
  responseOptimization,
  assetOptimization,
  performanceMonitoring,
  scalingConfig,
};