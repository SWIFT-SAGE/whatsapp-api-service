import { body, param, query } from 'express-validator';
import { Request } from 'express';
import { IUser } from '../models/User';
import Webhook from '../models/Webhook';

// Webhook ID parameter validation
export const validateWebhookId = [
  param('webhookId')
    .isMongoId()
    .withMessage('Invalid webhook ID format')
];

// Valid webhook events
const validWebhookEvents = [
  'message', 'message_create', 'message_revoke_everyone', 'message_revoke_me',
  'message_ack', 'message_edit', 'unread_count', 'contact_changed',
  'group_join', 'group_leave', 'group_update', 'qr', 'ready',
  'authenticated', 'auth_failure', 'disconnected', 'battery_info',
  'call_received', 'call_accepted', 'call_rejected'
];

// Valid HTTP methods for webhooks
const validHttpMethods = ['POST', 'PUT', 'PATCH'];

// Create webhook validation
export const validateCreateWebhook = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Webhook name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Webhook name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('url')
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      require_host: true
    })
    .withMessage('Webhook URL must be a valid HTTP or HTTPS URL')
    .isLength({ max: 2048 })
    .withMessage('Webhook URL must be less than 2048 characters')
    .custom(async (url: string, meta: any) => {
      // Check if URL is already used by this user
      const existingWebhook = await Webhook.findOne({ 
        url, 
        userId: ((meta.req as Request).user as IUser)?._id
      });
      if (existingWebhook) {
        throw new Error('Webhook URL already exists for this user');
      }
      return true;
    }),
  body('events')
    .isArray({ min: 1, max: 20 })
    .withMessage('Events must be an array with 1 to 20 items'),
  body('events.*')
    .isIn(validWebhookEvents)
    .withMessage('Invalid webhook event type'),
  body('method')
    .optional()
    .isIn(validHttpMethods)
    .withMessage('HTTP method must be POST, PUT, or PATCH'),
  body('headers')
    .optional()
    .isObject()
    .withMessage('Headers must be an object')
    .custom((headers: any) => {
      if (headers) {
        // Validate header names and values
        for (const [key, value] of Object.entries(headers)) {
          if (typeof key !== 'string' || typeof value !== 'string') {
            throw new Error('Header names and values must be strings');
          }
          if (key.length > 100 || (value as string).length > 500) {
            throw new Error('Header names must be ≤100 chars, values ≤500 chars');
          }
          // Prevent sensitive headers
          const lowerKey = key.toLowerCase();
          if (['authorization', 'cookie', 'set-cookie'].includes(lowerKey)) {
            throw new Error(`Header '${key}' is not allowed`);
          }
        }
        // Limit number of custom headers
        if (Object.keys(headers).length > 20) {
          throw new Error('Maximum 20 custom headers allowed');
        }
      }
      return true;
    }),
  body('secret')
    .optional()
    .isString()
    .withMessage('Secret must be a string')
    .isLength({ min: 8, max: 128 })
    .withMessage('Secret must be between 8 and 128 characters')
    .matches(/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/)
    .withMessage('Secret contains invalid characters'),
  body('timeout')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Timeout must be between 1 and 60 seconds')
    .toInt(),
  body('retryAttempts')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('Retry attempts must be between 0 and 5')
    .toInt(),
  body('retryDelay')
    .optional()
    .isInt({ min: 1, max: 300 })
    .withMessage('Retry delay must be between 1 and 300 seconds')
    .toInt(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean')
    .toBoolean(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  body('filters.sessionIds')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Session IDs filter must be an array with max 50 items'),
  body('filters.sessionIds.*')
    .optional()
    .isString()
    .withMessage('Each session ID must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  body('filters.messageTypes')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Message types filter must be an array with max 10 items'),
  body('filters.messageTypes.*')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact'])
    .withMessage('Invalid message type in filter'),
  body('filters.phoneNumbers')
    .optional()
    .isArray({ max: 100 })
    .withMessage('Phone numbers filter must be an array with max 100 items'),
  body('filters.phoneNumbers.*')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format in filter'),
  body('rateLimiting')
    .optional()
    .isObject()
    .withMessage('Rate limiting must be an object'),
  body('rateLimiting.enabled')
    .optional()
    .isBoolean()
    .withMessage('Rate limiting enabled must be a boolean'),
  body('rateLimiting.maxRequests')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max requests must be between 1 and 1000')
    .toInt(),
  body('rateLimiting.windowMs')
    .optional()
    .isInt({ min: 1000, max: 3600000 })
    .withMessage('Window must be between 1 second and 1 hour (in milliseconds)')
    .toInt()
];

// Update webhook validation
export const validateUpdateWebhook = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Webhook name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Webhook name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('url')
    .optional()
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      require_host: true
    })
    .withMessage('Webhook URL must be a valid HTTP or HTTPS URL')
    .isLength({ max: 2048 })
    .withMessage('Webhook URL must be less than 2048 characters'),
  body('events')
    .optional()
    .isArray({ min: 1, max: 20 })
    .withMessage('Events must be an array with 1 to 20 items'),
  body('events.*')
    .optional()
    .isIn(validWebhookEvents)
    .withMessage('Invalid webhook event type'),
  body('method')
    .optional()
    .isIn(validHttpMethods)
    .withMessage('HTTP method must be POST, PUT, or PATCH'),
  body('headers')
    .optional()
    .isObject()
    .withMessage('Headers must be an object')
    .custom((headers: any) => {
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          if (typeof key !== 'string' || typeof value !== 'string') {
            throw new Error('Header names and values must be strings');
          }
          if (key.length > 100 || (value as string).length > 500) {
            throw new Error('Header names must be ≤100 chars, values ≤500 chars');
          }
          const lowerKey = key.toLowerCase();
          if (['authorization', 'cookie', 'set-cookie'].includes(lowerKey)) {
            throw new Error(`Header '${key}' is not allowed`);
          }
        }
        if (Object.keys(headers).length > 20) {
          throw new Error('Maximum 20 custom headers allowed');
        }
      }
      return true;
    }),
  body('secret')
    .optional()
    .custom((value: string) => {
      if (value === '') return true; // Allow empty string to remove secret
      return true;
    })
    .isString()
    .withMessage('Secret must be a string')
    .isLength({ min: 8, max: 128 })
    .withMessage('Secret must be between 8 and 128 characters')
    .matches(/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/)
    .withMessage('Secret contains invalid characters'),
  body('timeout')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Timeout must be between 1 and 60 seconds')
    .toInt(),
  body('retryAttempts')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('Retry attempts must be between 0 and 5')
    .toInt(),
  body('retryDelay')
    .optional()
    .isInt({ min: 1, max: 300 })
    .withMessage('Retry delay must be between 1 and 300 seconds')
    .toInt(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean')
    .toBoolean(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  body('filters.sessionIds')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Session IDs filter must be an array with max 50 items'),
  body('filters.sessionIds.*')
    .optional()
    .isString()
    .withMessage('Each session ID must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  body('filters.messageTypes')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Message types filter must be an array with max 10 items'),
  body('filters.messageTypes.*')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact'])
    .withMessage('Invalid message type in filter'),
  body('filters.phoneNumbers')
    .optional()
    .isArray({ max: 100 })
    .withMessage('Phone numbers filter must be an array with max 100 items'),
  body('filters.phoneNumbers.*')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format in filter'),
  body('rateLimiting')
    .optional()
    .isObject()
    .withMessage('Rate limiting must be an object'),
  body('rateLimiting.enabled')
    .optional()
    .isBoolean()
    .withMessage('Rate limiting enabled must be a boolean'),
  body('rateLimiting.maxRequests')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max requests must be between 1 and 1000')
    .toInt(),
  body('rateLimiting.windowMs')
    .optional()
    .isInt({ min: 1000, max: 3600000 })
    .withMessage('Window must be between 1 second and 1 hour (in milliseconds)')
    .toInt()
];

// Get webhooks validation
export const validateGetWebhooks = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a positive integer between 1 and 100')
    .toInt(),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search must be between 1 and 100 characters')
    .trim(),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
  query('event')
    .optional()
    .isIn(validWebhookEvents)
    .withMessage('Invalid webhook event filter'),
  query('method')
    .optional()
    .isIn(validHttpMethods)
    .withMessage('Invalid HTTP method filter'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'url', 'isActive', 'lastTriggeredAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Test webhook validation
export const validateTestWebhook = [
  body('event')
    .optional()
    .isIn(validWebhookEvents)
    .withMessage('Invalid webhook event type'),
  body('testData')
    .optional()
    .isObject()
    .withMessage('Test data must be an object'),
  body('timeout')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Test timeout must be between 1 and 30 seconds')
    .toInt()
];

// Webhook logs validation
export const validateGetWebhookLogs = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a positive integer between 1 and 100')
    .toInt(),
  query('status')
    .optional()
    .isIn(['success', 'failed', 'pending', 'timeout'])
    .withMessage('Invalid status filter'),
  query('event')
    .optional()
    .isIn(validWebhookEvents)
    .withMessage('Invalid event filter'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date, { req }) => {
      if (req?.query?.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  query('httpStatus')
    .optional()
    .isInt({ min: 100, max: 599 })
    .withMessage('HTTP status must be between 100 and 599')
    .toInt(),
  query('sortBy')
    .optional()
    .isIn(['timestamp', 'status', 'event', 'responseTime', 'httpStatus'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Webhook statistics validation
export const validateGetWebhookStats = [
  query('period')
    .optional()
    .isIn(['hour', 'day', 'week', 'month', 'year'])
    .withMessage('Invalid period'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date, { req }) => {
      if (req?.query?.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  query('groupBy')
    .optional()
    .isIn(['event', 'status', 'webhook', 'hour', 'day'])
    .withMessage('Invalid group by field')
];

// Bulk webhook operations validation
export const validateBulkWebhookOperation = [
  body('webhookIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('Webhook IDs must be an array with 1 to 50 items'),
  body('webhookIds.*')
    .isMongoId()
    .withMessage('Each webhook ID must be a valid MongoDB ObjectId'),
  body('operation')
    .isIn(['activate', 'deactivate', 'delete', 'test'])
    .withMessage('Operation must be activate, deactivate, delete, or test')
];

// Webhook retry validation
export const validateRetryWebhook = [
  body('logIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Log IDs must be an array with 1 to 100 items'),
  body('logIds.*')
    .isMongoId()
    .withMessage('Each log ID must be a valid MongoDB ObjectId'),
  body('force')
    .optional()
    .isBoolean()
    .withMessage('Force must be a boolean')
    .toBoolean()
];

// Webhook export validation
export const validateExportWebhooks = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Export format must be json or csv'),
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('Include inactive must be a boolean')
    .toBoolean(),
  query('includeLogs')
    .optional()
    .isBoolean()
    .withMessage('Include logs must be a boolean')
    .toBoolean(),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date, { req }) => {
      if (req?.query?.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

// Webhook signature validation
export const validateWebhookSignature = [
  body('payload')
    .notEmpty()
    .withMessage('Payload is required')
    .isString()
    .withMessage('Payload must be a string'),
  body('signature')
    .notEmpty()
    .withMessage('Signature is required')
    .isString()
    .withMessage('Signature must be a string')
    .matches(/^sha256=[a-f0-9]{64}$/)
    .withMessage('Invalid signature format'),
  body('timestamp')
    .notEmpty()
    .withMessage('Timestamp is required')
    .isInt({ min: 1 })
    .withMessage('Timestamp must be a positive integer')
    .toInt()
    .custom((value: number) => {
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 300; // 5 minutes
      if (Math.abs(now - value) > maxAge) {
        throw new Error('Timestamp is too old or too far in the future');
      }
      return true;
    })
];

// Common validation helpers
export const sanitizeWebhookInput = {
  url: (url: string): string => url.trim(),
  name: (name: string): string => name.trim().replace(/\s+/g, ' '),
  description: (description: string): string => description.trim(),
  secret: (secret: string): string => secret.trim()
};

// Webhook validation error messages
export const webhookValidationMessages = {
  nameRequired: 'Webhook name is required',
  nameInvalid: 'Webhook name format is invalid',
  urlRequired: 'Webhook URL is required',
  urlInvalid: 'Webhook URL format is invalid',
  urlExists: 'Webhook URL already exists',
  eventsRequired: 'At least one event is required',
  eventInvalid: 'Invalid webhook event type',
  methodInvalid: 'Invalid HTTP method',
  headersInvalid: 'Invalid headers format',
  secretInvalid: 'Invalid secret format',
  timeoutInvalid: 'Invalid timeout value',
  retryAttemptsInvalid: 'Invalid retry attempts value',
  retryDelayInvalid: 'Invalid retry delay value',
  filtersInvalid: 'Invalid filters configuration',
  rateLimitingInvalid: 'Invalid rate limiting configuration',
  webhookNotFound: 'Webhook not found',
  webhookInactive: 'Webhook is inactive',
  testDataInvalid: 'Invalid test data format',
  signatureInvalid: 'Invalid webhook signature',
  timestampInvalid: 'Invalid or expired timestamp'
};

// Webhook event validation
export const isValidWebhookEvent = (event: string): boolean => {
  return validWebhookEvents.includes(event);
};

// HTTP method validation
export const isValidHttpMethod = (method: string): boolean => {
  return validHttpMethods.includes(method.toUpperCase());
};

// Webhook status validation
export const isValidWebhookStatus = (status: string): boolean => {
  return ['success', 'failed', 'pending', 'timeout'].includes(status);
};

// URL validation helper
export const isValidWebhookUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Check for localhost in production (optional)
    if (process.env.NODE_ENV === 'production' && 
        (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
      return false;
    }
    
    // Check for private IP ranges in production (optional)
    if (process.env.NODE_ENV === 'production') {
      const ip = parsedUrl.hostname;
      const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./
      ];
      
      if (privateRanges.some(range => range.test(ip))) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
};

// Webhook headers validation helper
export const validateWebhookHeaders = (headers: any): boolean => {
  if (!headers || typeof headers !== 'object') return true; // Optional
  
  const forbiddenHeaders = [
    'authorization', 'cookie', 'set-cookie', 'host', 'content-length',
    'transfer-encoding', 'connection', 'upgrade'
  ];
  
  for (const [key, value] of Object.entries(headers)) {
    if (typeof key !== 'string' || typeof value !== 'string') return false;
    if (forbiddenHeaders.includes(key.toLowerCase())) return false;
    if (key.length > 100 || (value as string).length > 500) return false;
  }
  
  return Object.keys(headers).length <= 20;
};

// Webhook filters validation helper
export const validateWebhookFilters = (filters: any): boolean => {
  if (!filters || typeof filters !== 'object') return true; // Optional
  
  const { sessionIds, messageTypes, phoneNumbers } = filters;
  
  if (sessionIds && (!Array.isArray(sessionIds) || sessionIds.length > 50)) {
    return false;
  }
  
  if (messageTypes && (!Array.isArray(messageTypes) || messageTypes.length > 10)) {
    return false;
  }
  
  if (phoneNumbers && (!Array.isArray(phoneNumbers) || phoneNumbers.length > 100)) {
    return false;
  }
  
  return true;
};

// Rate limiting validation helper
export const validateRateLimiting = (rateLimiting: any): boolean => {
  if (!rateLimiting || typeof rateLimiting !== 'object') return true; // Optional
  
  const { enabled, maxRequests, windowMs } = rateLimiting;
  
  if (enabled !== undefined && typeof enabled !== 'boolean') return false;
  if (maxRequests !== undefined && (typeof maxRequests !== 'number' || maxRequests < 1 || maxRequests > 1000)) return false;
  if (windowMs !== undefined && (typeof windowMs !== 'number' || windowMs < 1000 || windowMs > 3600000)) return false;
  
  return true;
};