import { Request, Response, NextFunction } from 'express';
import { logger, logError, logPerformance, logSecurityEvent } from './logger';
import { config } from '../config';
import os from 'os';
import process from 'process';
import { performance } from 'perf_hooks';

// Metrics collection interface
interface Metrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
  performance: {
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    totalResponseTime: number;
    requestCount: number;
  };
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: number[];
    connections: number;
  };
  whatsapp: {
    messagesSent: number;
    messagesReceived: number;
    sessionsActive: number;
    sessionsTotal: number;
    webhooksFired: number;
    webhookErrors: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
    recent: Array<{
      timestamp: Date;
      error: string;
      endpoint?: string;
      userId?: string;
    }>;
  };
}

// Global metrics store
const metrics: Metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    byMethod: {},
    byStatus: {},
    byEndpoint: {},
  },
  performance: {
    avgResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    totalResponseTime: 0,
    requestCount: 0,
  },
  system: {
    uptime: 0,
    memory: process.memoryUsage(),
    cpu: [],
    connections: 0,
  },
  whatsapp: {
    messagesSent: 0,
    messagesReceived: 0,
    sessionsActive: 0,
    sessionsTotal: 0,
    webhooksFired: 0,
    webhookErrors: 0,
  },
  errors: {
    total: 0,
    byType: {},
    byEndpoint: {},
    recent: [],
  },
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  // Track request start
  metrics.requests.total++;
  metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;
  metrics.requests.byEndpoint[req.route?.path || req.path] = 
    (metrics.requests.byEndpoint[req.route?.path || req.path] || 0) + 1;
  
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    const endMemory = process.memoryUsage();
    
    // Update performance metrics
    metrics.performance.requestCount++;
    metrics.performance.totalResponseTime += duration;
    metrics.performance.avgResponseTime = 
      metrics.performance.totalResponseTime / metrics.performance.requestCount;
    metrics.performance.maxResponseTime = Math.max(metrics.performance.maxResponseTime, duration);
    metrics.performance.minResponseTime = Math.min(metrics.performance.minResponseTime, duration);
    
    // Track status codes
    const statusCode = res.statusCode.toString();
    metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;
    
    if (res.statusCode >= 200 && res.statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.errors++;
    }
    
    // Log slow requests
    if (duration > config.monitoring.healthCheck.timeout) {
      logPerformance('Slow request detected', duration, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        },
      });
    }
  });
  
  next();
};

// Error tracking middleware
export const errorTracker = (error: Error, req: Request, res: Response, next: NextFunction) => {
  // Update error metrics
  metrics.errors.total++;
  metrics.errors.byType[error.name] = (metrics.errors.byType[error.name] || 0) + 1;
  metrics.errors.byEndpoint[req.route?.path || req.path] = 
    (metrics.errors.byEndpoint[req.route?.path || req.path] || 0) + 1;
  
  // Add to recent errors (keep last 100)
  metrics.errors.recent.unshift({
    timestamp: new Date(),
    error: error.message,
    endpoint: req.route?.path || req.path,
    userId: (req as any).user?.id,
  });
  
  if (metrics.errors.recent.length > 100) {
    metrics.errors.recent = metrics.errors.recent.slice(0, 100);
  }
  
  // Log error with context
  logError(error, {
    requestId: (req as any).requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
  });
  
  next(error);
};

// System metrics collector
export const collectSystemMetrics = () => {
  metrics.system.uptime = process.uptime();
  metrics.system.memory = process.memoryUsage();
  metrics.system.cpu = os.loadavg();
  
  // Log system metrics periodically
  if (config.monitoring.systemMetrics.enabled) {
    logger.debug('System metrics collected', {
      uptime: metrics.system.uptime,
      memory: {
        rss: `${Math.round(metrics.system.memory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(metrics.system.memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(metrics.system.memory.heapTotal / 1024 / 1024)}MB`,
      },
      cpu: metrics.system.cpu,
    });
  }
};

// WhatsApp metrics helpers
export const trackWhatsAppMetrics = {
  messageSent: () => {
    metrics.whatsapp.messagesSent++;
  },
  messageReceived: () => {
    metrics.whatsapp.messagesReceived++;
  },
  sessionCreated: () => {
    metrics.whatsapp.sessionsTotal++;
    metrics.whatsapp.sessionsActive++;
  },
  sessionDestroyed: () => {
    metrics.whatsapp.sessionsActive = Math.max(0, metrics.whatsapp.sessionsActive - 1);
  },
  webhookFired: () => {
    metrics.whatsapp.webhooksFired++;
  },
  webhookError: () => {
    metrics.whatsapp.webhookErrors++;
  },
};

// Health check system
interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  lastCheck?: Date;
}

const healthChecks: Record<string, () => Promise<HealthCheck>> = {
  database: async (): Promise<HealthCheck> => {
    const start = performance.now();
    try {
      // This would be replaced with actual database ping
      // await mongoose.connection.db.admin().ping();
      const responseTime = performance.now() - start;
      return {
        name: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: (error as Error).message,
        responseTime: performance.now() - start,
        lastCheck: new Date(),
      };
    }
  },
  
  redis: async (): Promise<HealthCheck> => {
    const start = performance.now();
    try {
      // This would be replaced with actual Redis ping
      // await redisClient.ping();
      const responseTime = performance.now() - start;
      return {
        name: 'redis',
        status: responseTime < 500 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        message: (error as Error).message,
        responseTime: performance.now() - start,
        lastCheck: new Date(),
      };
    }
  },
  
  memory: async (): Promise<HealthCheck> => {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let message = '';
    
    if (heapUsedPercent > 90) {
      status = 'unhealthy';
      message = 'Memory usage critical';
    } else if (heapUsedPercent > 75) {
      status = 'degraded';
      message = 'Memory usage high';
    }
    
    return {
      name: 'memory',
      status,
      message,
      lastCheck: new Date(),
    };
  },
  
  disk: async (): Promise<HealthCheck> => {
    try {
      // This would be replaced with actual disk space check
      // const stats = await fs.promises.statfs('/');
      return {
        name: 'disk',
        status: 'healthy',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'unhealthy',
        message: (error as Error).message,
        lastCheck: new Date(),
      };
    }
  },
};

// Run health checks
export const runHealthChecks = async (): Promise<Record<string, HealthCheck>> => {
  const results: Record<string, HealthCheck> = {};
  
  for (const [name, checkFn] of Object.entries(healthChecks)) {
    try {
      results[name] = await checkFn();
    } catch (error) {
      results[name] = {
        name,
        status: 'unhealthy',
        message: (error as Error).message,
        lastCheck: new Date(),
      };
    }
  }
  
  return results;
};

// Get overall system health
export const getSystemHealth = async () => {
  const healthChecks = await runHealthChecks();
  const overallStatus = Object.values(healthChecks).every(check => check.status === 'healthy')
    ? 'healthy'
    : Object.values(healthChecks).some(check => check.status === 'unhealthy')
    ? 'unhealthy'
    : 'degraded';
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    checks: healthChecks,
  };
};

// Get current metrics
export const getMetrics = () => {
  return {
    ...metrics,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
};

// Reset metrics (useful for testing)
export const resetMetrics = () => {
  metrics.requests = {
    total: 0,
    success: 0,
    errors: 0,
    byMethod: {},
    byStatus: {},
    byEndpoint: {},
  };
  metrics.performance = {
    avgResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    totalResponseTime: 0,
    requestCount: 0,
  };
  metrics.whatsapp = {
    messagesSent: 0,
    messagesReceived: 0,
    sessionsActive: 0,
    sessionsTotal: 0,
    webhooksFired: 0,
    webhookErrors: 0,
  };
  metrics.errors = {
    total: 0,
    byType: {},
    byEndpoint: {},
    recent: [],
  };
};

// Security monitoring
export const securityMonitor = {
  trackFailedLogin: (ip: string, userAgent?: string) => {
    logSecurityEvent('Failed login attempt', {
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  },
  
  trackSuspiciousActivity: (activity: string, details: Record<string, any>) => {
    logSecurityEvent('Suspicious activity detected', {
      activity,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },
  
  trackRateLimitExceeded: (ip: string, endpoint: string) => {
    logSecurityEvent('Rate limit exceeded', {
      ip,
      endpoint,
      timestamp: new Date().toISOString(),
    });
  },
};

// Start monitoring services
export const startMonitoring = () => {
  // Collect system metrics periodically
  if (config.monitoring.systemMetrics.enabled) {
    setInterval(collectSystemMetrics, config.monitoring.systemMetrics.interval);
  }
  
  // Log metrics summary periodically
  setInterval(() => {
    logger.info('Metrics summary', {
      requests: {
        total: metrics.requests.total,
        success: metrics.requests.success,
        errors: metrics.requests.errors,
        errorRate: metrics.requests.total > 0 
          ? (metrics.requests.errors / metrics.requests.total * 100).toFixed(2) + '%'
          : '0%',
      },
      performance: {
        avgResponseTime: Math.round(metrics.performance.avgResponseTime),
        maxResponseTime: Math.round(metrics.performance.maxResponseTime),
      },
      whatsapp: {
        messagesSent: metrics.whatsapp.messagesSent,
        messagesReceived: metrics.whatsapp.messagesReceived,
        sessionsActive: metrics.whatsapp.sessionsActive,
      },
    });
  }, config.monitoring.metricsInterval);
  
  logger.info('Monitoring services started');
};

export default {
  performanceMonitor,
  errorTracker,
  trackWhatsAppMetrics,
  runHealthChecks,
  getSystemHealth,
  getMetrics,
  resetMetrics,
  securityMonitor,
  startMonitoring,
};