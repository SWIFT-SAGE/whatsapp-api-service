import { body, param, query } from 'express-validator';
import { IUser } from '../models/User';
import { Request } from 'express';
import WhatsappSession from '../models/WhatsappSession';

// Session ID parameter validation
export const validateSessionId = [
  param('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Session ID can only contain letters, numbers, underscores, and hyphens')
];

// MongoDB ObjectId parameter validation
export const validateSessionObjectId = [
  param('sessionId')
    .isMongoId()
    .withMessage('Invalid session ID format')
];

// Create session validation
export const validateCreateSession = [
  body('sessionId')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Session ID can only contain letters, numbers, underscores, and hyphens')
    .custom(async (sessionId: string, meta) => {
      const existingSession = await WhatsappSession.findOne({ 
        sessionId, 
        userId: meta.req.user as IUser)?._id
      });
      if (existingSession) {
        throw new Error('Session ID already exists for this user');
      }
      return true;
    }),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Session name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Session name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('webhookUrl')
    .optional()
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true
    })
    .withMessage('Webhook URL must be a valid HTTP or HTTPS URL')
    .isLength({ max: 2048 })
    .withMessage('Webhook URL must be less than 2048 characters'),
  body('webhookEvents')
    .optional()
    .isArray()
    .withMessage('Webhook events must be an array'),
  body('webhookEvents.*')
    .optional()
    .isIn([
      'message', 'message_create', 'message_revoke_everyone', 'message_revoke_me',
      'message_ack', 'message_edit', 'unread_count', 'contact_changed',
      'group_join', 'group_leave', 'group_update', 'qr', 'ready',
      'authenticated', 'auth_failure', 'disconnected'
    ])
    .withMessage('Invalid webhook event type'),
  body('autoReply')
    .optional()
    .isObject()
    .withMessage('Auto reply must be an object'),
  body('autoReply.enabled')
    .optional()
    .isBoolean()
    .withMessage('Auto reply enabled must be a boolean'),
  body('autoReply.message')
    .optional()
    .isString()
    .withMessage('Auto reply message must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Auto reply message must be between 1 and 1000 characters'),
  body('autoReply.delay')
    .optional()
    .isInt({ min: 0, max: 300 })
    .withMessage('Auto reply delay must be between 0 and 300 seconds')
    .toInt(),
  body('businessHours')
    .optional()
    .isObject()
    .withMessage('Business hours must be an object'),
  body('businessHours.enabled')
    .optional()
    .isBoolean()
    .withMessage('Business hours enabled must be a boolean'),
  body('businessHours.timezone')
    .optional()
    .isIn([
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
      'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland'
    ])
    .withMessage('Invalid timezone'),
  body('businessHours.schedule')
    .optional()
    .isObject()
    .withMessage('Business hours schedule must be an object'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  body('settings.markMessagesRead')
    .optional()
    .isBoolean()
    .withMessage('Mark messages read must be a boolean'),
  body('settings.sendReadReceipts')
    .optional()
    .isBoolean()
    .withMessage('Send read receipts must be a boolean'),
  body('settings.sendPresenceUpdates')
    .optional()
    .isBoolean()
    .withMessage('Send presence updates must be a boolean'),
  body('settings.logMessages')
    .optional()
    .isBoolean()
    .withMessage('Log messages must be a boolean')
];

// Update session validation
export const validateUpdateSession = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Session name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Session name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('webhookUrl')
    .optional()
    .custom((value: string) => {
      if (value === '') return true; // Allow empty string to remove webhook
      return true;
    })
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true
    })
    .withMessage('Webhook URL must be a valid HTTP or HTTPS URL')
    .isLength({ max: 2048 })
    .withMessage('Webhook URL must be less than 2048 characters'),
  body('webhookEvents')
    .optional()
    .isArray()
    .withMessage('Webhook events must be an array'),
  body('webhookEvents.*')
    .optional()
    .isIn([
      'message', 'message_create', 'message_revoke_everyone', 'message_revoke_me',
      'message_ack', 'message_edit', 'unread_count', 'contact_changed',
      'group_join', 'group_leave', 'group_update', 'qr', 'ready',
      'authenticated', 'auth_failure', 'disconnected'
    ])
    .withMessage('Invalid webhook event type'),
  body('autoReply')
    .optional()
    .isObject()
    .withMessage('Auto reply must be an object'),
  body('autoReply.enabled')
    .optional()
    .isBoolean()
    .withMessage('Auto reply enabled must be a boolean'),
  body('autoReply.message')
    .optional()
    .isString()
    .withMessage('Auto reply message must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Auto reply message must be between 1 and 1000 characters'),
  body('autoReply.delay')
    .optional()
    .isInt({ min: 0, max: 300 })
    .withMessage('Auto reply delay must be between 0 and 300 seconds')
    .toInt(),
  body('businessHours')
    .optional()
    .isObject()
    .withMessage('Business hours must be an object'),
  body('businessHours.enabled')
    .optional()
    .isBoolean()
    .withMessage('Business hours enabled must be a boolean'),
  body('businessHours.timezone')
    .optional()
    .isIn([
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
      'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland'
    ])
    .withMessage('Invalid timezone'),
  body('businessHours.schedule')
    .optional()
    .isObject()
    .withMessage('Business hours schedule must be an object'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  body('settings.markMessagesRead')
    .optional()
    .isBoolean()
    .withMessage('Mark messages read must be a boolean'),
  body('settings.sendReadReceipts')
    .optional()
    .isBoolean()
    .withMessage('Send read receipts must be a boolean'),
  body('settings.sendPresenceUpdates')
    .optional()
    .isBoolean()
    .withMessage('Send presence updates must be a boolean'),
  body('settings.logMessages')
    .optional()
    .isBoolean()
    .withMessage('Log messages must be a boolean')
];

// Get sessions query validation
export const validateGetSessions = [
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
  query('status')
    .optional()
    .isIn(['connected', 'disconnected', 'connecting', 'qr_required'])
    .withMessage('Invalid status filter'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'sessionId', 'status', 'lastConnectedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Session restart validation
export const validateRestartSession = [
  body('force')
    .optional()
    .isBoolean()
    .withMessage('Force must be a boolean')
    .toBoolean(),
  body('clearData')
    .optional()
    .isBoolean()
    .withMessage('Clear data must be a boolean')
    .toBoolean()
];

// Session QR code validation
export const validateGetQRCode = [
  query('format')
    .optional()
    .isIn(['png', 'svg', 'base64'])
    .withMessage('QR code format must be png, svg, or base64'),
  query('size')
    .optional()
    .isInt({ min: 100, max: 1000 })
    .withMessage('QR code size must be between 100 and 1000 pixels')
    .toInt(),
  query('margin')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('QR code margin must be between 0 and 50 pixels')
    .toInt()
];

// Session logs validation
export const validateGetSessionLogs = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be a positive integer between 1 and 1000')
    .toInt(),
  query('level')
    .optional()
    .isIn(['error', 'warn', 'info', 'debug'])
    .withMessage('Invalid log level'),
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
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ min: 1, max: 200 })
    .withMessage('Search must be between 1 and 200 characters')
    .trim()
];

// Session statistics validation
export const validateGetSessionStats = [
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
    })
];

// Bulk session operations validation
export const validateBulkSessionOperation = [
  body('sessionIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('Session IDs must be an array with 1 to 50 items'),
  body('sessionIds.*')
    .isMongoId()
    .withMessage('Each session ID must be a valid MongoDB ObjectId'),
  body('operation')
    .isIn(['start', 'stop', 'restart', 'delete'])
    .withMessage('Operation must be start, stop, restart, or delete'),
  body('force')
    .optional()
    .isBoolean()
    .withMessage('Force must be a boolean')
    .toBoolean()
];

// Session backup validation
export const validateBackupSession = [
  body('includeMessages')
    .optional()
    .isBoolean()
    .withMessage('Include messages must be a boolean')
    .toBoolean(),
  body('includeContacts')
    .optional()
    .isBoolean()
    .withMessage('Include contacts must be a boolean')
    .toBoolean(),
  body('includeSettings')
    .optional()
    .isBoolean()
    .withMessage('Include settings must be a boolean')
    .toBoolean(),
  body('format')
    .optional()
    .isIn(['json', 'zip'])
    .withMessage('Backup format must be json or zip')
];

// Session restore validation
export const validateRestoreSession = [
  body('backupData')
    .notEmpty()
    .withMessage('Backup data is required')
    .isObject()
    .withMessage('Backup data must be an object'),
  body('overwrite')
    .optional()
    .isBoolean()
    .withMessage('Overwrite must be a boolean')
    .toBoolean(),
  body('restoreMessages')
    .optional()
    .isBoolean()
    .withMessage('Restore messages must be a boolean')
    .toBoolean(),
  body('restoreContacts')
    .optional()
    .isBoolean()
    .withMessage('Restore contacts must be a boolean')
    .toBoolean(),
  body('restoreSettings')
    .optional()
    .isBoolean()
    .withMessage('Restore settings must be a boolean')
    .toBoolean()
];

// Session clone validation
export const validateCloneSession = [
  body('newSessionId')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('New session ID must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('New session ID can only contain letters, numbers, underscores, and hyphens')
    .custom(async (sessionId: string, meta) => {
      const existingSession = await WhatsappSession.findOne({ 
        sessionId, 
        userId: meta.req.user as IUser)?._id
      });
      if (existingSession) {
        throw new Error('New session ID already exists for this user');
      }
      return true;
    }),
  body('newName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('New session name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('New session name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('cloneSettings')
    .optional()
    .isBoolean()
    .withMessage('Clone settings must be a boolean')
    .toBoolean(),
  body('cloneWebhooks')
    .optional()
    .isBoolean()
    .withMessage('Clone webhooks must be a boolean')
    .toBoolean()
];

// Session export validation
export const validateExportSession = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Export format must be json or csv'),
  query('includeMessages')
    .optional()
    .isBoolean()
    .withMessage('Include messages must be a boolean')
    .toBoolean(),
  query('includeContacts')
    .optional()
    .isBoolean()
    .withMessage('Include contacts must be a boolean')
    .toBoolean(),
  query('includeSettings')
    .optional()
    .isBoolean()
    .withMessage('Include settings must be a boolean')
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

// Common validation helpers
export const sanitizeSessionInput = {
  sessionId: (sessionId: string): string => sessionId.trim().toLowerCase(),
  name: (name: string): string => name.trim().replace(/\s+/g, ' '),
  description: (description: string): string => description.trim(),
  webhookUrl: (url: string): string => url.trim()
};

// Session validation error messages
export const sessionValidationMessages = {
  sessionIdRequired: 'Session ID is required',
  sessionIdInvalid: 'Session ID format is invalid',
  sessionIdExists: 'Session ID already exists',
  sessionNotFound: 'Session not found',
  sessionNotConnected: 'Session is not connected',
  sessionAlreadyConnected: 'Session is already connected',
  webhookUrlInvalid: 'Webhook URL is invalid',
  webhookEventInvalid: 'Invalid webhook event type',
  autoReplyMessageTooLong: 'Auto reply message is too long',
  businessHoursInvalid: 'Business hours configuration is invalid',
  settingsInvalid: 'Session settings are invalid'
};

// Session status validation
export const isValidSessionStatus = (status: string): boolean => {
  return ['connected', 'disconnected', 'connecting', 'qr_required'].includes(status);
};

// Webhook event validation
export const isValidWebhookEvent = (event: string): boolean => {
  const validEvents = [
    'message', 'message_create', 'message_revoke_everyone', 'message_revoke_me',
    'message_ack', 'message_edit', 'unread_count', 'contact_changed',
    'group_join', 'group_leave', 'group_update', 'qr', 'ready',
    'authenticated', 'auth_failure', 'disconnected'
  ];
  return validEvents.includes(event);
};

// Business hours validation helper
export const validateBusinessHoursSchedule = (schedule: any): boolean => {
  if (!schedule || typeof schedule !== 'object') return false;
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of days) {
    if (schedule[day]) {
      const daySchedule = schedule[day];
      if (!daySchedule.enabled || typeof daySchedule.enabled !== 'boolean') continue;
      
      if (daySchedule.enabled) {
        if (!daySchedule.start || !daySchedule.end) return false;
        if (typeof daySchedule.start !== 'string' || typeof daySchedule.end !== 'string') return false;
        
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(daySchedule.start) || !timeRegex.test(daySchedule.end)) return false;
      }
    }
  }
  
  return true;
};
