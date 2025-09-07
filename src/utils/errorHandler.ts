import { Request, Response, NextFunction } from 'express';
import { logger, logError, logSecurityEvent } from './logger';
import { config } from '../config';
import { ValidationError as ExpressValidationError } from 'express-validator';
import mongoose from 'mongoose';

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service ${service} is unavailable`,
      503,
      true,
      'EXTERNAL_SERVICE_ERROR',
      { service }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 500, true, 'DATABASE_ERROR', { originalError: originalError?.message });
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
    stack?: string;
  };
}

// Format error response
const formatErrorResponse = (error: AppError, requestId?: string): ErrorResponse => {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
  };

  // Add details if available
  if (error.details) {
    response.error.details = error.details;
  }

  // Add stack trace in development
  if (config.isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
};

// Handle different types of errors
const handleCastError = (error: mongoose.Error.CastError): AppError => {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new ValidationError(message);
};

const handleDuplicateFieldsError = (error: any): AppError => {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];
  const message = `${field} '${value}' already exists`;
  return new ConflictError(message);
};

const handleValidationError = (error: mongoose.Error.ValidationError): AppError => {
  const errors = Object.values(error.errors).map((err: any) => {
    return {
      field: err.path,
      message: err.message,
      value: err.value,
    };
  });
  
  return new ValidationError('Validation failed', { errors });
};

const handleJWTError = (): AppError => {
  return new AuthenticationError('Invalid token');
};

const handleJWTExpiredError = (): AppError => {
  return new AuthenticationError('Token expired');
};

// Main error handling middleware
export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError;
  const requestId = (req as any).requestId;

  // Convert known errors to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error.name === 'CastError') {
    appError = handleCastError(error as mongoose.Error.CastError);
  } else if (error.name === 'ValidationError') {
    appError = handleValidationError(error as mongoose.Error.ValidationError);
  } else if ((error as any).code === 11000) {
    appError = handleDuplicateFieldsError(error);
  } else if (error.name === 'JsonWebTokenError') {
    appError = handleJWTError();
  } else if (error.name === 'TokenExpiredError') {
    appError = handleJWTExpiredError();
  } else {
    // Unknown error - log it and return generic error
    appError = new AppError(
      config.isProduction ? 'Something went wrong' : error.message,
      500,
      false
    );
  }

  // Log error with context
  logError(appError, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
    statusCode: appError.statusCode,
    isOperational: appError.isOperational,
  });

  // Log security events for certain errors
  if (appError instanceof AuthenticationError || appError instanceof AuthorizationError) {
    logSecurityEvent('Authentication/Authorization failure', {
      error: appError.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
    });
  }

  // Send error response
  const errorResponse = formatErrorResponse(appError, requestId);
  res.status(appError.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Handle unhandled promise rejections
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });

    // Graceful shutdown
    if (!config.isDevelopment) {
      logger.error('Shutting down due to unhandled promise rejection');
      process.exit(1);
    }
  });
};

// Handle uncaught exceptions
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Graceful shutdown
    logger.error('Shutting down due to uncaught exception');
    process.exit(1);
  });
};

// Graceful shutdown handler
export const gracefulShutdown = (server: any) => {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    server.close((err: Error) => {
      if (err) {
        logger.error('Error during server shutdown', { error: err.message });
        process.exit(1);
      }

      logger.info('Server closed successfully');
      
      // Close database connections
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close()
      } else {
        process.exit(0);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Request timeout handler
export const timeoutHandler = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const error = new AppError('Request timeout', 408, true, 'REQUEST_TIMEOUT');
        next(error);
      }
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// Validation error handler for express-validator
export const handleValidationErrors = (errors: ValidationError[]) => {
  const formattedErrors = errors.map(error => ({
    field: error?.code,
    message: error?.message,
    value: error?.details,
    location: error?.stack,
  }));

  throw new ValidationError('Validation failed', { errors: formattedErrors });
};

// Success response helper
export const successResponse = (
  res: Response,
  data: any,
  message: string = 'Success',
  statusCode: number = 200
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Pagination response helper
export const paginationResponse = (
  res: Response,
  data: any[],
  total: number,
  page: number,
  limit: number,
  message: string = 'Success'
) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    },
    timestamp: new Date().toISOString(),
  });
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  globalErrorHandler,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  gracefulShutdown,
  notFoundHandler,
  timeoutHandler,
  handleValidationErrors,
  successResponse,
  paginationResponse,
};