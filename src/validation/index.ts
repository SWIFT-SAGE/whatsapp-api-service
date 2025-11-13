// Export all validation schemas
import { IUser } from '../models/User';
export * from './userValidation';
export * from './sessionValidation';
export * from './messageValidation';

export * from './analyticsValidation';

import { validationResult, ValidationError } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

// Validation result handler middleware
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: ValidationError) => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));
    
    logger.warn('Validation errors:', {
      path: req.path,
      method: req.method,
      errors: errorMessages,
      userId: (req.user as IUser)?._id,
      ip: req.ip
    }); 
    
    const error = new AppError(
      'Validation failed',
      400,
      true,
      JSON.stringify(errorMessages)
    );
    
    return next(error);
  }
  
  next();
};

// Common validation chains
export const commonValidation = {
  // Pagination validation
  pagination: [
    require('express-validator').query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be a positive integer between 1 and 1000')
      .toInt(),
    require('express-validator').query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be a positive integer between 1 and 100')
      .toInt()
  ],
  
  // Search validation
  search: [
    require('express-validator').query('search')
      .optional()
      .isString()
      .withMessage('Search must be a string')
      .isLength({ min: 1, max: 200 })
      .withMessage('Search must be between 1 and 200 characters')
      .trim()
  ],
  
  // Date range validation
  dateRange: [
    require('express-validator').query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date')
      .toDate(),
    require('express-validator').query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .toDate()
      .custom((value: Date, { req }: { req: Request }) => {
        if (req.query && req.query.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
        return true;
      })
  ],
  
  // Sort validation
  sort: (validFields: string[]) => [
    require('express-validator').query('sortBy')
      .optional()
      .isIn(validFields)
      .withMessage(`Sort field must be one of: ${validFields.join(', ')}`),
    require('express-validator').query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],
  
  // MongoDB ObjectId validation
  mongoId: (paramName: string) => [
    require('express-validator').param(paramName)
      .isMongoId()
      .withMessage(`Invalid ${paramName} format`)
  ],
  
  // Boolean query parameter validation
  booleanQuery: (paramName: string) => [
    require('express-validator').query(paramName)
      .optional()
      .isBoolean()
      .withMessage(`${paramName} must be a boolean`)
      .toBoolean()
  ],
  
  // Array validation
  array: (fieldName: string, minItems: number = 1, maxItems: number = 100) => [
    require('express-validator').body(fieldName)
      .isArray({ min: minItems, max: maxItems })
      .withMessage(`${fieldName} must be an array with ${minItems} to ${maxItems} items`)
  ],
  
  // String length validation
  stringLength: (fieldName: string, minLength: number = 1, maxLength: number = 255) => [
    require('express-validator').body(fieldName)
      .isString()
      .withMessage(`${fieldName} must be a string`)
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`)
      .trim()
  ],
  
  // Optional string length validation
  optionalStringLength: (fieldName: string, minLength: number = 1, maxLength: number = 255) => [
    require('express-validator').body(fieldName)
      .optional()
      .isString()
      .withMessage(`${fieldName} must be a string`)
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`)
      .trim()
  ],
  
  // Email validation
  email: (fieldName: string = 'email') => [
    require('express-validator').body(fieldName)
      .isEmail()
      .withMessage(`${fieldName} must be a valid email address`)
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false
      })
  ],
  
  // Optional email validation
  optionalEmail: (fieldName: string = 'email') => [
    require('express-validator').body(fieldName)
      .optional()
      .isEmail()
      .withMessage(`${fieldName} must be a valid email address`)
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false
      })
  ],
  
  // URL validation
  url: (fieldName: string) => [
    require('express-validator').body(fieldName)
      .isURL({ 
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true
      })
      .withMessage(`${fieldName} must be a valid HTTP or HTTPS URL`)
  ],
  
  // Optional URL validation
  optionalUrl: (fieldName: string) => [
    require('express-validator').body(fieldName)
      .optional()
      .isURL({ 
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true
      })
      .withMessage(`${fieldName} must be a valid HTTP or HTTPS URL`)
  ],
  
  // Integer validation
  integer: (fieldName: string, min: number = 1, max: number = Number.MAX_SAFE_INTEGER) => [
    require('express-validator').body(fieldName)
      .isInt({ min, max })
      .withMessage(`${fieldName} must be an integer between ${min} and ${max}`)
      .toInt()
  ],
  
  // Optional integer validation
  optionalInteger: (fieldName: string, min: number = 1, max: number = Number.MAX_SAFE_INTEGER) => [
    require('express-validator').body(fieldName)
      .optional()
      .isInt({ min, max })
      .withMessage(`${fieldName} must be an integer between ${min} and ${max}`)
      .toInt()
  ],
  
  // Float validation
  float: (fieldName: string, min: number = 0, max: number = Number.MAX_VALUE) => [
    require('express-validator').body(fieldName)
      .isFloat({ min, max })
      .withMessage(`${fieldName} must be a number between ${min} and ${max}`)
      .toFloat()
  ],
  
  // Optional float validation
  optionalFloat: (fieldName: string, min: number = 0, max: number = Number.MAX_VALUE) => [
    require('express-validator').body(fieldName)
      .optional()
      .isFloat({ min, max })
      .withMessage(`${fieldName} must be a number between ${min} and ${max}`)
      .toFloat()
  ],
  
  // Boolean validation
  boolean: (fieldName: string) => [
    require('express-validator').body(fieldName)
      .isBoolean()
      .withMessage(`${fieldName} must be a boolean`)
      .toBoolean()
  ],
  
  // Optional boolean validation
  optionalBoolean: (fieldName: string) => [
    require('express-validator').body(fieldName)
      .optional()
      .isBoolean()
      .withMessage(`${fieldName} must be a boolean`)
      .toBoolean()
  ],
  
  // Date validation
  date: (fieldName: string) => [
    require('express-validator').body(fieldName)
      .isISO8601()
      .withMessage(`${fieldName} must be a valid ISO 8601 date`)
      .toDate()
  ],
  
  // Optional date validation
  optionalDate: (fieldName: string) => [
    require('express-validator').body(fieldName)
      .optional()
      .isISO8601()
      .withMessage(`${fieldName} must be a valid ISO 8601 date`)
      .toDate()
  ],
  
  // Enum validation
  enum: (fieldName: string, values: string[]) => [
    require('express-validator').body(fieldName)
      .isIn(values)
      .withMessage(`${fieldName} must be one of: ${values.join(', ')}`)
  ],
  
  // Optional enum validation
  optionalEnum: (fieldName: string, values: string[]) => [
    require('express-validator').body(fieldName)
      .optional()
      .isIn(values)
      .withMessage(`${fieldName} must be one of: ${values.join(', ')}`)
  ]
};

// Validation utilities
export const validationUtils = {
  // Sanitize string input
  sanitizeString: (str: string): string => {
    return str.trim().replace(/\s+/g, ' ');
  },
  
  // Sanitize phone number
  sanitizePhoneNumber: (phone: string): string => {
    return phone.replace(/[^\d+]/g, '');
  },
  
  // Validate phone number format
  isValidPhoneNumber: (phone: string): boolean => {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) {
      return /^\+?[1-9]\d{1,14}$/.test(cleanPhone);
    }
    return /^\d{10,15}$/.test(cleanPhone);
  },
  
  // Validate email format
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Validate URL format
  isValidUrl: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  },
  
  // Validate MongoDB ObjectId format
  isValidObjectId: (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  },
  
  // Validate date range
  isValidDateRange: (startDate: Date, endDate: Date, maxRangeDays: number = 365): boolean => {
    if (startDate >= endDate) return false;
    
    const rangeDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > maxRangeDays) return false;
    
    if (endDate > new Date()) return false;
    
    return true;
  },
  
  // Validate JSON string
  isValidJson: (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  },
  
  // Validate array of unique values
  hasUniqueValues: (arr: any[]): boolean => {
    return arr.length === new Set(arr).size;
  },
  
  // Validate file extension
  isValidFileExtension: (filename: string, allowedExtensions: string[]): boolean => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedExtensions.includes(extension) : false;
  },
  
  // Validate MIME type
  isValidMimeType: (mimeType: string, allowedTypes: string[]): boolean => {
    return allowedTypes.includes(mimeType);
  },
  
  // Validate password strength
  isStrongPassword: (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  },
  
  // Validate timezone
  isValidTimezone: (timezone: string): boolean => {
    const validTimezones = [
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
      'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
    ];
    return validTimezones.includes(timezone);
  },
  
  // Validate IP address
  isValidIpAddress: (ip: string): boolean => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  },
  
  // Validate hex color
  isValidHexColor: (color: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  },
  
  // Validate base64 string
  isValidBase64: (str: string): boolean => {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }
};

// Error response formatter
export const formatValidationError = (errors: ValidationError[]) => {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors.map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }))
  };
};

// Validation middleware factory
export const createValidationMiddleware = (validations: any[]) => {
  return [
    ...validations,
    handleValidationErrors
  ];
};

// Rate limiting validation
export const rateLimitValidation = {
  // API rate limit validation
  apiRateLimit: [
    require('express-validator').body('maxRequests')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Max requests must be between 1 and 10000')
      .toInt(),
    require('express-validator').body('windowMs')
      .optional()
      .isInt({ min: 1000, max: 3600000 })
      .withMessage('Window must be between 1 second and 1 hour (in milliseconds)')
      .toInt()
  ],
  
  // Message rate limit validation
  messageRateLimit: [
    require('express-validator').body('messagesPerMinute')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Messages per minute must be between 1 and 1000')
      .toInt(),
    require('express-validator').body('messagesPerHour')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Messages per hour must be between 1 and 10000')
      .toInt(),
    require('express-validator').body('messagesPerDay')
      .optional()
      .isInt({ min: 1, max: 100000 })
      .withMessage('Messages per day must be between 1 and 100000')
      .toInt()
  ]
};

// File upload validation
export const fileUploadValidation = {
  // Image upload validation
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  },
  
  // Document upload validation
  document: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'application/rtf'
    ],
    allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf']
  },
  
  // Audio upload validation
  audio: {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/opus'],
    allowedExtensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'opus']
  },
  
  // Video upload validation
  video: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/x-flv', 'video/webm', 'video/3gpp'],
    allowedExtensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', '3gp']
  }
};

// Export types for TypeScript
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResponse {
  error: string;
  code: string;
  details: ValidationErrorDetail[];
}

export interface FileUploadConfig {
  maxSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}
