import winston, { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Create logs directory if it doesn't exist
const logsDir = path.resolve(config.logging.file.path);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format for production
const productionFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, service, userId, sessionId, requestId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: service || 'whatsapp-api',
      ...(requestId ? { requestId } : {}),
      ...(typeof userId === 'object' ? userId : userId ? { userId } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Custom log format for development
const developmentFormat = format.combine(
  format.timestamp({ format: 'HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.colorize({ all: true }),
  format.printf(({ timestamp, level, message, requestId, userId, sessionId, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]`;
    
    if (requestId) logMessage += ` [${requestId}]`;
    if (userId) logMessage += ` [User:${userId}]`;
    if (sessionId) logMessage += ` [Session:${sessionId}]`;
    
    logMessage += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Create logger transports
const loggerTransports: any[] = [];

// Console transport
if (config.logging.console.enabled) {
  loggerTransports.push(
    new transports.Console({
      format: config.isDevelopment ? developmentFormat : productionFormat,
      level: config.logging.level,
    })
  );
}

// File transports (only in production or when explicitly enabled)
if (config.logging.file.enabled) {
  // Error logs
  loggerTransports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: productionFormat,
      maxSize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      zippedArchive: true,
    })
  );
  
  // Combined logs
  loggerTransports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: productionFormat,
      maxSize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      zippedArchive: true,
    })
  );
  
  // Access logs (HTTP requests)
  loggerTransports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      format: productionFormat,
      maxSize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      zippedArchive: true,
    })
  );
}

// Create logger instance
export const logger = createLogger({
  level: config.logging.level,
  format: productionFormat,
  defaultMeta: { 
    service: 'whatsapp-api',
    hostname: os.hostname(),
    pid: process.pid,
  },
  transports: loggerTransports,
  exitOnError: false,
});

// Add custom log levels
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  debug: 'green',
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || 
                   `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Log request start
  logger.http('Request started', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'http';
    
    logger.log(logLevel, 'Request completed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: (req as any).user?.id,
    });
  });
  
  next();
};

// Error logging helper
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

// Security event logging
export const logSecurityEvent = (event: string, details: Record<string, any>) => {
  logger.warn(`Security Event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, context?: Record<string, any>) => {
  const logLevel = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
  
  logger.log(logLevel, `Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...context,
  });
};

// Business event logging
export const logBusinessEvent = (event: string, details: Record<string, any>) => {
  logger.info(`Business Event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// Structured logging helpers
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

// Log stream for external integrations (like Morgan)
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;
