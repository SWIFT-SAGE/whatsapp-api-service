import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { logger } from '../utils/logger';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : error.type,
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));
    
    logger.warn('Validation errors:', { errors: formattedErrors, path: req.path });
    
    res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
    return;
  }
  
  next();
};

/**
 * User registration validation
 */
export const validateUserRegistration: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('company')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Company name must be less than 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required')
];

/**
 * User login validation
 */
export const validateUserLogin: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * User profile update validation
 */
export const validateUserUpdate: ValidationChain[] = [
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('company')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Company name must be less than 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('timezone')
    .optional()
    .isIn(['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'])
    .withMessage('Invalid timezone'),
  body('language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'zh', 'ja', 'ko'])
    .withMessage('Invalid language code')
];

/**
 * Password change validation
 */
export const validatePasswordChange: ValidationChain[] = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

/**
 * WhatsApp session creation validation
 */
export const validateSessionCreation: ValidationChain[] = [
  body('phoneNumber')
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('webhookUrl')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Valid webhook URL is required'),
  body('settings.rateLimitPerMinute')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Rate limit must be between 1 and 1000'),
  body('settings.maxDailyMessages')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Max daily messages must be between 1 and 10000')
];

/**
 * Message sending validation
 */
export const validateMessageSend: ValidationChain[] = [
  body('to')
    .isMobilePhone('any')
    .withMessage('Valid recipient phone number is required'),
  body('type')
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'gif'])
    .withMessage('Invalid message type'),
  body('content')
    .custom((value, { req }) => {
      if (req.body.type === 'text' && (!value || value.trim().length === 0)) {
        throw new Error('Text content is required for text messages');
      }
      if (req.body.type === 'text' && value.length > 4096) {
        throw new Error('Text content must be less than 4096 characters');
      }
      return true;
    }),
  body('mediaUrl')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Valid media URL is required'),
  body('fileName')
    .optional()
    .isLength({ max: 255 })
    .withMessage('File name must be less than 255 characters'),
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required'),
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required')
];

/**
 * Webhook configuration validation
 */
export const validateWebhookConfig: ValidationChain[] = [
  body('url')
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Valid webhook URL is required'),
  body('events')
    .isArray({ min: 1 })
    .withMessage('At least one event must be selected'),
  body('events.*')
    .isIn(['message.received', 'message.sent', 'message.delivered', 'message.read', 'session.connected', 'session.disconnected', 'qr.updated'])
    .withMessage('Invalid webhook event'),
  body('secret')
    .optional()
    .isLength({ min: 16, max: 64 })
    .withMessage('Webhook secret must be between 16 and 64 characters'),
  body('timeout')
    .optional()
    .isInt({ min: 1000, max: 30000 })
    .withMessage('Timeout must be between 1000 and 30000 milliseconds'),
  body('retryPolicy.maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Max retries must be between 0 and 10'),
  body('retryPolicy.retryDelay')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('Retry delay must be between 1000 and 300000 milliseconds')
];

/**
 * API key creation validation
 */
export const validateApiKeyCreation: ValidationChain[] = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('API key name must be between 1 and 100 characters'),
  body('permissions')
    .isArray({ min: 1 })
    .withMessage('At least one permission must be selected'),
  body('permissions.*')
    .isIn(['messages:send', 'messages:read', 'sessions:create', 'sessions:read', 'sessions:delete', 'webhooks:create', 'webhooks:read', 'webhooks:update', 'webhooks:delete', 'analytics:read'])
    .withMessage('Invalid permission'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Valid expiration date is required'),
  body('allowedIPs')
    .optional()
    .isArray()
    .withMessage('Allowed IPs must be an array'),
  body('allowedIPs.*')
    .optional()
    .isIP()
    .withMessage('Invalid IP address'),
  body('allowedDomains')
    .optional()
    .isArray()
    .withMessage('Allowed domains must be an array'),
  body('allowedDomains.*')
    .optional()
    .isFQDN()
    .withMessage('Invalid domain name')
];

/**
 * MongoDB ObjectId validation
 */
export const validateObjectId = (field: string): ValidationChain => {
  return param(field)
    .isMongoId()
    .withMessage(`Invalid ${field} format`);
};

/**
 * Pagination validation
 */
export const validatePagination: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'email', 'status'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

/**
 * Date range validation
 */
export const validateDateRange: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
    .custom((value, { req }) => {
      if (req?.query?.startDate && value && new Date(value) <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

/**
 * Custom validation for file uploads
 */
export const validateFileUpload = (allowedTypes: string[], maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file) {
      res.status(400).json({ error: 'File is required' });
      return;
    }

    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({ 
        error: 'Invalid file type', 
        allowedTypes,
        receivedType: req.file.mimetype 
      });
      return;
    }

    if (req.file.size > maxSize) {
      res.status(400).json({ 
        error: 'File too large', 
        maxSize: `${maxSize / 1024 / 1024}MB`,
        receivedSize: `${req.file.size / 1024 / 1024}MB`
      });
      return;
    }

    next();
  };
};

export default {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validatePasswordChange,
  validateSessionCreation,
  validateMessageSend,
  validateWebhookConfig,
  validateApiKeyCreation,
  validateObjectId,
  validatePagination,
  validateDateRange,
  validateFileUpload
};