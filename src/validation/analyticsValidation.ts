import { body, param, query } from 'express-validator';

// Analytics period validation
const validPeriods = ['hour', 'day', 'week', 'month', 'quarter', 'year'];
const validMetrics = [
  'messages', 'sessions', 'users', 'api_calls', 'webhooks', 'errors',
  'response_time', 'uptime', 'storage', 'bandwidth', 'costs'
];
const validGroupBy = [
  'hour', 'day', 'week', 'month', 'year', 'session', 'user', 'type', 'status'
];

// Get analytics validation
export const validateGetAnalytics = [
  query('period')
    .optional()
    .isIn(validPeriods)
    .withMessage('Invalid period. Must be one of: hour, day, week, month, quarter, year'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date) => {
      const maxPastDate = new Date();
      maxPastDate.setFullYear(maxPastDate.getFullYear() - 2);
      if (value < maxPastDate) {
        throw new Error('Start date cannot be more than 2 years in the past');
      }
      return true;
    }),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date, { req }) => {
      if (value > new Date()) {
        throw new Error('End date cannot be in the future');
      }
      if (req.query && req.query.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      const startDate = req.query && req.query.startDate ? new Date(req.query.startDate as string) : new Date();
      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      if (value.getTime() - startDate.getTime() > maxRange) {
        throw new Error('Date range cannot exceed 1 year');
      }
      return true;
    }),
  query('metrics')
    .optional()
    .custom((value: string) => {
      const metrics = value.split(',').map(m => m.trim());
      if (metrics.length > 10) {
        throw new Error('Maximum 10 metrics allowed');
      }
      for (const metric of metrics) {
        if (!validMetrics.includes(metric)) {
          throw new Error(`Invalid metric: ${metric}`);
        }
      }
      return true;
    }),
  query('groupBy')
    .optional()
    .isIn(validGroupBy)
    .withMessage('Invalid groupBy field'),
  query('sessionId')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID format'),
  query('timezone')
    .optional()
    .isIn([
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
      'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
    ])
    .withMessage('Invalid timezone'),
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv')
];

// Dashboard analytics validation
export const validateGetDashboard = [
  query('period')
    .optional()
    .isIn(['today', 'yesterday', 'week', 'month', 'quarter', 'year'])
    .withMessage('Invalid dashboard period'),
  query('timezone')
    .optional()
    .isIn([
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
      'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
    ])
    .withMessage('Invalid timezone'),
  query('includeComparison')
    .optional()
    .isBoolean()
    .withMessage('Include comparison must be a boolean')
    .toBoolean(),
  query('sessionIds')
    .optional()
    .custom((value: string) => {
      const sessionIds = value.split(',').map(s => s.trim());
      if (sessionIds.length > 50) {
        throw new Error('Maximum 50 session IDs allowed');
      }
      for (const sessionId of sessionIds) {
        if (sessionId.length < 3 || sessionId.length > 50) {
          throw new Error('Each session ID must be between 3 and 50 characters');
        }
      }
      return true;
    })
];

// Usage report validation
export const validateGetUsageReport = [
  query('period')
    .optional()
    .isIn(validPeriods)
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
      if (req.query && req.query.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  query('includeDetails')
    .optional()
    .isBoolean()
    .withMessage('Include details must be a boolean')
    .toBoolean(),
  query('includeCosts')
    .optional()
    .isBoolean()
    .withMessage('Include costs must be a boolean')
    .toBoolean(),
  query('format')
    .optional()
    .isIn(['json', 'csv', 'pdf'])
    .withMessage('Format must be json, csv, or pdf'),
  query('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month', 'session', 'user'])
    .withMessage('Invalid groupBy field')
];

// System analytics validation (admin only)
export const validateGetSystemAnalytics = [
  query('period')
    .optional()
    .isIn(validPeriods)
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
      if (req.query && req.query.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  query('metrics')
    .optional()
    .custom((value: string) => {
      const systemMetrics = [
        'total_users', 'active_users', 'total_sessions', 'active_sessions',
        'total_messages', 'total_api_calls', 'total_webhooks', 'system_errors',
        'avg_response_time', 'system_uptime', 'storage_usage', 'bandwidth_usage',
        'revenue', 'costs', 'profit_margin'
      ];
      const metrics = value.split(',').map(m => m.trim());
      if (metrics.length > 15) {
        throw new Error('Maximum 15 metrics allowed');
      }
      for (const metric of metrics) {
        if (!systemMetrics.includes(metric)) {
          throw new Error(`Invalid system metric: ${metric}`);
        }
      }
      return true;
    }),
  query('groupBy')
    .optional()
    .isIn(['hour', 'day', 'week', 'month', 'subscription', 'region'])
    .withMessage('Invalid groupBy field'),
  query('includeBreakdown')
    .optional()
    .isBoolean()
    .withMessage('Include breakdown must be a boolean')
    .toBoolean()
];

// Track event validation
export const validateTrackEvent = [
  body('event')
    .notEmpty()
    .withMessage('Event name is required')
    .isString()
    .withMessage('Event name must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Event name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Event name can only contain letters, numbers, underscores, dots, and hyphens'),
  body('properties')
    .optional()
    .isObject()
    .withMessage('Properties must be an object')
    .custom((properties: any) => {
      if (properties) {
        // Limit number of properties
        if (Object.keys(properties).length > 50) {
          throw new Error('Maximum 50 properties allowed');
        }
        
        // Validate property names and values
        for (const [key, value] of Object.entries(properties)) {
          if (typeof key !== 'string' || key.length > 100) {
            throw new Error('Property names must be strings with max 100 characters');
          }
          
          if (!['string', 'number', 'boolean'].includes(typeof value)) {
            throw new Error('Property values must be string, number, or boolean');
          }
          
          if (typeof value === 'string' && (value as string).length > 1000) {
            throw new Error('String property values must be max 1000 characters');
          }
        }
      }
      return true;
    }),
  body('sessionId')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Timestamp must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date) => {
      const now = new Date();
      const maxPast = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      const maxFuture = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour in future
      
      if (value < maxPast || value > maxFuture) {
        throw new Error('Timestamp must be within 24 hours past to 1 hour future');
      }
      return true;
    })
];

// Batch track events validation
export const validateBatchTrackEvents = [
  body('events')
    .isArray({ min: 1, max: 100 })
    .withMessage('Events must be an array with 1 to 100 items'),
  body('events.*.event')
    .notEmpty()
    .withMessage('Event name is required')
    .isString()
    .withMessage('Event name must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Event name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Event name can only contain letters, numbers, underscores, dots, and hyphens'),
  body('events.*.properties')
    .optional()
    .isObject()
    .withMessage('Properties must be an object'),
  body('events.*.sessionId')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  body('events.*.timestamp')
    .optional()
    .isISO8601()
    .withMessage('Timestamp must be a valid ISO 8601 date')
    .toDate()
];

// Export analytics validation
export const validateExportAnalytics = [
  query('type')
    .isIn(['analytics', 'usage', 'system', 'events'])
    .withMessage('Export type must be analytics, usage, system, or events'),
  query('format')
    .optional()
    .isIn(['json', 'csv', 'xlsx'])
    .withMessage('Format must be json, csv, or xlsx'),
  query('period')
    .optional()
    .isIn(validPeriods)
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
      if (req.query && req.query.startDate && value <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  query('includeRawData')
    .optional()
    .isBoolean()
    .withMessage('Include raw data must be a boolean')
    .toBoolean(),
  query('compress')
    .optional()
    .isBoolean()
    .withMessage('Compress must be a boolean')
    .toBoolean(),
  query('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
];

// Analytics alerts validation
export const validateCreateAlert = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Alert name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Alert name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('metric')
    .isIn(validMetrics)
    .withMessage('Invalid metric for alert'),
  body('condition')
    .isIn(['greater_than', 'less_than', 'equals', 'not_equals', 'percentage_change'])
    .withMessage('Invalid alert condition'),
  body('threshold')
    .isNumeric()
    .withMessage('Threshold must be a number')
    .toFloat(),
  body('period')
    .isIn(['5min', '15min', '30min', '1hour', '6hour', '12hour', '24hour'])
    .withMessage('Invalid alert period'),
  body('channels')
    .isArray({ min: 1, max: 5 })
    .withMessage('Channels must be an array with 1 to 5 items'),
  body('channels.*')
    .isIn(['email', 'sms', 'webhook', 'slack', 'discord'])
    .withMessage('Invalid notification channel'),
  body('recipients')
    .isArray({ min: 1, max: 10 })
    .withMessage('Recipients must be an array with 1 to 10 items'),
  body('recipients.*')
    .isEmail()
    .withMessage('Each recipient must be a valid email address')
    .normalizeEmail(),
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
  body('webhookUrl')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Webhook URL must be a valid HTTP or HTTPS URL'),
  body('cooldownMinutes')
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage('Cooldown must be between 5 and 1440 minutes')
    .toInt()
];

// Update alert validation
export const validateUpdateAlert = [
  param('alertId')
    .isMongoId()
    .withMessage('Invalid alert ID format'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Alert name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Alert name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('metric')
    .optional()
    .isIn(validMetrics)
    .withMessage('Invalid metric for alert'),
  body('condition')
    .optional()
    .isIn(['greater_than', 'less_than', 'equals', 'not_equals', 'percentage_change'])
    .withMessage('Invalid alert condition'),
  body('threshold')
    .optional()
    .isNumeric()
    .withMessage('Threshold must be a number')
    .toFloat(),
  body('period')
    .optional()
    .isIn(['5min', '15min', '30min', '1hour', '6hour', '12hour', '24hour'])
    .withMessage('Invalid alert period'),
  body('channels')
    .optional()
    .isArray({ min: 1, max: 5 })
    .withMessage('Channels must be an array with 1 to 5 items'),
  body('channels.*')
    .optional()
    .isIn(['email', 'sms', 'webhook', 'slack', 'discord'])
    .withMessage('Invalid notification channel'),
  body('recipients')
    .optional()
    .isArray({ min: 1, max: 10 })
    .withMessage('Recipients must be an array with 1 to 10 items'),
  body('recipients.*')
    .optional()
    .isEmail()
    .withMessage('Each recipient must be a valid email address')
    .normalizeEmail(),
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
  body('webhookUrl')
    .optional()
    .custom((value: string) => {
      if (value === '') return true; // Allow empty string to remove webhook
      return true;
    })
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Webhook URL must be a valid HTTP or HTTPS URL'),
  body('cooldownMinutes')
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage('Cooldown must be between 5 and 1440 minutes')
    .toInt()
];

// Get alerts validation
export const validateGetAlerts = [
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
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
  query('metric')
    .optional()
    .isIn(validMetrics)
    .withMessage('Invalid metric filter'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'metric', 'lastTriggeredAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Common validation helpers
export const sanitizeAnalyticsInput = {
  period: (period: string): string => period.toLowerCase(),
  metric: (metric: string): string => metric.toLowerCase(),
  groupBy: (groupBy: string): string => groupBy.toLowerCase()
};

// Analytics validation error messages
export const analyticsValidationMessages = {
  periodInvalid: 'Invalid time period',
  dateRangeInvalid: 'Invalid date range',
  dateRangeTooLarge: 'Date range is too large',
  metricsInvalid: 'Invalid metrics specified',
  metricsTooMany: 'Too many metrics requested',
  groupByInvalid: 'Invalid groupBy field',
  timezoneInvalid: 'Invalid timezone',
  formatInvalid: 'Invalid export format',
  eventNameInvalid: 'Invalid event name',
  propertiesInvalid: 'Invalid event properties',
  alertNameInvalid: 'Invalid alert name',
  alertMetricInvalid: 'Invalid alert metric',
  alertConditionInvalid: 'Invalid alert condition',
  alertThresholdInvalid: 'Invalid alert threshold',
  alertChannelsInvalid: 'Invalid notification channels',
  alertRecipientsInvalid: 'Invalid alert recipients'
};

// Period validation helper
export const isValidPeriod = (period: string): boolean => {
  return validPeriods.includes(period);
};

// Metric validation helper
export const isValidMetric = (metric: string): boolean => {
  return validMetrics.includes(metric);
};

// Group by validation helper
export const isValidGroupBy = (groupBy: string): boolean => {
  return validGroupBy.includes(groupBy);
};

// Date range validation helper
export const validateDateRange = (startDate: Date, endDate: Date): boolean => {
  if (startDate >= endDate) return false;
  
  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
  if (endDate.getTime() - startDate.getTime() > maxRange) return false;
  
  const maxPastDate = new Date();
  maxPastDate.setFullYear(maxPastDate.getFullYear() - 2);
  if (startDate < maxPastDate) return false;
  
  if (endDate > new Date()) return false;
  
  return true;
};

// Event properties validation helper
export const validateEventProperties = (properties: any): boolean => {
  if (!properties || typeof properties !== 'object') return true;
  
  if (Object.keys(properties).length > 50) return false;
  
  for (const [key, value] of Object.entries(properties)) {
    if (typeof key !== 'string' || key.length > 100) return false;
    if (!['string', 'number', 'boolean'].includes(typeof value)) return false;
    if (typeof value === 'string' && (value as string).length > 1000) return false;
  }
  
  return true;
};

// Alert condition validation helper
export const isValidAlertCondition = (condition: string): boolean => {
  return ['greater_than', 'less_than', 'equals', 'not_equals', 'percentage_change'].includes(condition);
};

// Notification channel validation helper
export const isValidNotificationChannel = (channel: string): boolean => {
  return ['email', 'sms', 'webhook', 'slack', 'discord'].includes(channel);
};