import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { MongoError } from 'mongodb';

/**
 * Custom error class for application errors
 */
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

/**
 * Predefined error types
 */
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

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, true, 'SERVICE_UNAVAILABLE_ERROR');
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
  path: string;
  requestId?: string;
  stack?: string;
}

/**
 * Handle MongoDB errors
 */
const handleMongoError = (error: MongoError): AppError => {
  switch (error.code) {
    case 11000:
      // Duplicate key error
      const field = Object.keys((error as any).keyValue)[0];
      return new ConflictError(`${field} already exists`);
    case 11001:
      return new ConflictError('Duplicate key error');
    default:
      return new AppError('Database error', 500, true, 'DATABASE_ERROR');
  }
};

/**
 * Handle Mongoose validation errors
 */
const handleValidationError = (error: any): AppError => {
  const errors = Object.values(error.errors).map((err: any) => ({
    field: err.path,
    message: err.message,
    value: err.value
  }));
  
  return new ValidationError('Validation failed', errors);
};

/**
 * Handle JWT errors
 */
const handleJWTError = (error: any): AppError => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  return new AuthenticationError('Authentication failed');
};

/**
 * Handle Cast errors (invalid ObjectId)
 */
const handleCastError = (error: any): AppError => {
  return new ValidationError(`Invalid ${error.path}: ${error.value}`);
};

/**
 * Convert operational errors to AppError
 */
const handleError = (error: any): AppError => {
  // If it's already an AppError, return as is
  if (error instanceof AppError) {
    return error;
  }

  // Handle specific error types
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return handleMongoError(error);
  }
  
  if (error.name === 'ValidationError') {
    return handleValidationError(error);
  }
  
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return handleJWTError(error);
  }
  
  if (error.name === 'CastError') {
    return handleCastError(error);
  }

  // Handle specific HTTP errors
  if (error.status || error.statusCode) {
    return new AppError(
      error.message || 'An error occurred',
      error.status || error.statusCode,
      true,
      error.code
    );
  }

  // Default to internal server error
  return new AppError(
    'Internal server error',
    500,
    false,
    'INTERNAL_SERVER_ERROR'
  );
};

/**
 * Generate request ID for tracking
 */
const generateRequestId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

/**
 * Middleware to add request ID
 */
export const addRequestId = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = req.headers['x-request-id'] as string || generateRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Main error handling middleware
 */
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
  const appError = handleError(error);
  const requestId = req.requestId || generateRequestId();

  // Log error details
  const errorLog = {
    requestId,
    error: {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      stack: appError.stack
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    },
    timestamp: new Date().toISOString()
  };

  // Log based on error severity
  if (appError.statusCode >= 500) {
    logger.error('Server Error:', errorLog);
  } else if (appError.statusCode >= 400) {
    logger.warn('Client Error:', errorLog);
  } else {
    logger.info('Request Error:', errorLog);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: appError.message,
    code: appError.code,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId
  };

  // Add details for validation errors
  if (appError.details) {
    errorResponse.details = appError.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && appError.stack) {
    errorResponse.stack = appError.stack;
  }

  // Send error response
  res.status(appError.statusCode).json(errorResponse);
};

/**
 * Handle 404 errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

/**
 * Async error wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      error: {
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

/**
 * Middleware to handle specific WhatsApp API errors
 */
export const whatsappErrorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
  // Handle WhatsApp-specific errors
  if (error.code === 'WHATSAPP_SESSION_NOT_FOUND') {
    const appError = new NotFoundError('WhatsApp session');
    return next(appError);
  }
  
  if (error.code === 'WHATSAPP_NOT_CONNECTED') {
    const appError = new ServiceUnavailableError('WhatsApp session not connected');
    return next(appError);
  }
  
  if (error.code === 'WHATSAPP_MESSAGE_FAILED') {
    const appError = new AppError('Failed to send WhatsApp message', 422, true, 'MESSAGE_SEND_FAILED');
    return next(appError);
  }
  
  // Pass to general error handler
  next(error);
};

/**
 * Initialize error handling
 */
export const initializeErrorHandling = (): void => {
  handleUncaughtException();
  handleUnhandledRejection();
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  addRequestId,
  whatsappErrorHandler,
  initializeErrorHandling
};