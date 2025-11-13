import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Interface for request logging data
 */
interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  path: string;
  query: any;
  params: any;
  headers: any;
  body?: any;
  ip: string;
  userAgent: string;
  userId?: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: any;
}

/**
 * Interface for audit log data
 */
interface AuditLogData {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ip: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * Sensitive fields to exclude from logging
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'refresh_token',
  'access_token',
  'webhookSecret',
  'twoFactorSecret'
];

/**
 * Sensitive headers to exclude from logging
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-webhook-secret'
];

/**
 * Sanitize object by removing sensitive fields
 */
const sanitizeObject = (obj: any, depth: number = 0): any => {
  if (depth > 3 || !obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Sanitize headers by removing sensitive ones
 */
const sanitizeHeaders = (headers: any): any => {
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Generate request ID if not present
 */
const generateRequestId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = req.requestId || generateRequestId();
  
  // Add request ID to request and response
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Prepare initial log data
  const logData: RequestLogData = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: sanitizeObject(req.query),
    params: sanitizeObject(req.params),
    headers: sanitizeHeaders(req.headers),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  };

  // Log request body for non-GET requests (excluding file uploads)
  if (req.method !== 'GET' && req.body && !req.file && !req.files) {
    logData.body = sanitizeObject(req.body);
  }

  // Log incoming request
  logger.info('Incoming Request:', logData);

  // Override res.end to capture response data
  const originalEnd = res.end;


  res.end = function(chunk?: any, encoding?: any, cb?: () => void): Response {
    return originalEnd.call(this, chunk, encoding);
  
  };

  next();
};

/**
 * Audit logging middleware
 */
export const auditLogger = (action: string, resource: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Store audit info in request for later use
    req.auditInfo = {
      action,
      resource,
      resourceId: req.params.id || req.body.id,
      details: sanitizeObject({
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        body: req.body
      })
    };

    next();
  };
};

/**
 * Log audit event after request completion
 */
export const logAuditEvent = (req: Request, res: Response, success: boolean, error?: string): void => {
  if (!req.auditInfo || !req.user) {
    return;
  }

  const auditData: AuditLogData = {
    userId: req.user.id,
    action: req.auditInfo.action,
    resource: req.auditInfo.resource,
    resourceId: req.auditInfo.resourceId,
    details: req.auditInfo.details,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date().toISOString(),
    success,
    error
  };

  if (success) {
    logger.info('Audit Event:', auditData);
  } else {
    logger.warn('Audit Event Failed:', auditData);
  }
};

/**
 * Security event logging
 */
export const logSecurityEvent = (event: string, details: any, req: Request): void => {
  const securityLog = {
    event,
    details: sanitizeObject(details),
    request: {
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      path: req.path,
      method: req.method,
      userId: req.user?.id
    },
    timestamp: new Date().toISOString()
  };

  logger.warn('Security Event:', securityLog);
};

/**
 * Performance logging middleware
 */
export const performanceLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    const performanceData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memory: {
        heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(endMemory.heapTotal / 1024 / 1024 * 100) / 100, // MB
        external: Math.round(endMemory.external / 1024 / 1024 * 100) / 100 // MB
      },
      timestamp: new Date().toISOString()
    };

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow Request:', performanceData);
    } else if (duration > 500) {
      logger.info('Performance Log:', performanceData);
    }
  });

  next();
};

/**
 * Database operation logging
 */
export const logDatabaseOperation = (operation: string, collection: string, query: any, duration: number, error?: any): void => {
  const dbLog = {
    operation,
    collection,
    query: sanitizeObject(query),
    duration: Math.round(duration * 100) / 100,
    timestamp: new Date().toISOString(),
    error: error ? {
      message: error.message,
      code: error.code
    } : undefined
  };

  if (error) {
    logger.error('Database Operation Failed:', dbLog);
  } else if (duration > 1000) {
    logger.warn('Slow Database Operation:', dbLog);
  } else {
    logger.debug('Database Operation:', dbLog);
  }
};

/**
 * WhatsApp API operation logging
 */
export const logWhatsAppOperation = (operation: string, sessionId: string, details: any, success: boolean, error?: any): void => {
  const whatsappLog = {
    operation,
    sessionId,
    details: sanitizeObject(details),
    success,
    timestamp: new Date().toISOString(),
    error: error ? {
      message: error.message,
      code: error.code
    } : undefined
  };

  if (success) {
    logger.info('WhatsApp Operation:', whatsappLog);
  } else {
    logger.error('WhatsApp Operation Failed:', whatsappLog);
  }
};

/**
 * Webhook delivery logging
 */
export const logWebhookDelivery = (webhookId: string, url: string, event: string, success: boolean, duration: number, error?: any): void => {
  const webhookLog = {
    webhookId,
    url,
    event,
    success,
    duration: Math.round(duration * 100) / 100,
    timestamp: new Date().toISOString(),
    error: error ? {
      message: error.message,
      code: error.code,
      status: error.status
    } : undefined
  };

  if (success) {
    logger.info('Webhook Delivered:', webhookLog);
  } else {
    logger.error('Webhook Delivery Failed:', webhookLog);
  }
};

/**
 * Rate limit logging
 */
export const logRateLimit = (identifier: string, limit: number, current: number, windowMs: number): void => {
  const rateLimitLog = {
    identifier,
    limit,
    current,
    windowMs,
    timestamp: new Date().toISOString()
  };

  logger.warn('Rate Limit Exceeded:', rateLimitLog);
};

export default {
  requestLogger,
  auditLogger,
  logAuditEvent,
  logSecurityEvent,
  performanceLogger,
  logDatabaseOperation,
  logWhatsAppOperation,
  logWebhookDelivery,
  logRateLimit
};