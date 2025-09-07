import { Router, Request, Response } from 'express';
import { asyncHandler, successResponse } from '../utils/errorHandler';
import { getSystemHealth, getMetrics, runHealthChecks } from '../utils/monitoring';
import { logger } from '../utils/logger';
import { config } from '../config';
import { rateLimit } from 'express-rate-limit';
import os from 'os';
import process from 'process';

const router = Router();

// Rate limiting for health endpoints
const healthRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many health check requests',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all health routes
router.use(healthRateLimit);

/**
 * @route GET /health
 * @desc Basic health check endpoint
 * @access Public
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const health = await getSystemHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    success: true,
    status: health.status,
    timestamp: health.timestamp,
    uptime: health.uptime,
    version: health.version,
    environment: health.environment,
  });
}));

/**
 * @route GET /health/detailed
 * @desc Detailed health check with all components
 * @access Public
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const health = await getSystemHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    success: true,
    ...health,
  });
}));

/**
 * @route GET /health/live
 * @desc Kubernetes liveness probe endpoint
 * @access Public
 */
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  // Simple liveness check - just verify the process is running
  res.status(200).json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}));

/**
 * @route GET /health/ready
 * @desc Kubernetes readiness probe endpoint
 * @access Public
 */
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  const healthChecks = await runHealthChecks();
  
  // Check if critical services are healthy
  const criticalServices = ['database', 'redis'];
  const criticalHealthy = criticalServices.every(service => 
    !healthChecks[service] || healthChecks[service].status === 'healthy'
  );
  
  const statusCode = criticalHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    success: criticalHealthy,
    status: criticalHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: healthChecks,
  });
}));

/**
 * @route GET /health/metrics
 * @desc Application metrics endpoint
 * @access Public (but should be restricted in production)
 */
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const metrics = getMetrics();
  successResponse(res, metrics, 'Metrics retrieved successfully');
}));

/**
 * @route GET /health/system
 * @desc System information endpoint
 * @access Public (but should be restricted in production)
 */
router.get('/system', asyncHandler(async (req: Request, res: Response) => {
  const systemInfo = {
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      pid: process.pid,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    },
    os: {
      hostname: os.hostname(),
      type: os.type(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    application: {
      name: 'whatsapp-api-service',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env,
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    },
  };
  
  successResponse(res, systemInfo, 'System information retrieved successfully');
}));

/**
 * @route GET /health/dependencies
 * @desc Check external dependencies status
 * @access Public (but should be restricted in production)
 */
router.get('/dependencies', asyncHandler(async (req: Request, res: Response) => {
  const healthChecks = await runHealthChecks();
  
  const dependencies = {
    database: healthChecks.database || { status: 'unknown', message: 'Not configured' },
    redis: healthChecks.redis || { status: 'unknown', message: 'Not configured' },
    whatsapp: {
      status: 'healthy', // This would be replaced with actual WhatsApp service check
      message: 'WhatsApp Web client status',
      lastCheck: new Date(),
    },
  };
  
  const allHealthy = Object.values(dependencies).every(
    dep => dep.status === 'healthy' || dep.status === 'unknown'
  );
  
  const statusCode = allHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    success: allHealthy,
    status: allHealthy ? 'all_dependencies_healthy' : 'some_dependencies_unhealthy',
    timestamp: new Date().toISOString(),
    dependencies,
  });
}));

/**
 * @route GET /health/ping
 * @desc Simple ping endpoint for basic connectivity test
 * @access Public
 */
router.get('/ping', asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString(),
    server: os.hostname(),
  });
}));

/**
 * @route GET /health/version
 * @desc Application version information
 * @access Public
 */
router.get('/version', asyncHandler(async (req: Request, res: Response) => {
  const versionInfo = {
    application: {
      name: 'whatsapp-api-service',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env,
      buildDate: process.env.BUILD_DATE || 'unknown',
      gitCommit: process.env.GIT_COMMIT || 'unknown',
      gitBranch: process.env.GIT_BRANCH || 'unknown',
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    dependencies: {
      // This would be populated from package.json in a real application
      express: '^4.18.0',
      mongoose: '^7.0.0',
      winston: '^3.8.0',
      // ... other dependencies
    },
  };
  
  successResponse(res, versionInfo, 'Version information retrieved successfully');
}));

/**
 * @route POST /health/log-test
 * @desc Test logging functionality (development only)
 * @access Public (development only)
 */
if (config.isDevelopment) {
  router.post('/log-test', asyncHandler(async (req: Request, res: Response) => {
    const { level = 'info', message = 'Test log message' } = req.body;
    
    // Test different log levels
    switch (level) {
      case 'error':
        logger.error(message, { test: true, timestamp: new Date() });
        break;
      case 'warn':
        logger.warn(message, { test: true, timestamp: new Date() });
        break;
      case 'info':
        logger.info(message, { test: true, timestamp: new Date() });
        break;
      case 'debug':
        logger.debug(message, { test: true, timestamp: new Date() });
        break;
      default:
        logger.info(message, { test: true, timestamp: new Date() });
    }
    
    successResponse(res, { level, message }, 'Log test completed');
  }));
}

export default router;