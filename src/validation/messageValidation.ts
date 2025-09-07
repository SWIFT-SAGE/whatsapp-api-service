import { body, param, query } from 'express-validator';
import { Request } from 'express';

// WhatsApp number validation regex
const whatsappNumberRegex = /^\d{10,15}$/;
const whatsappNumberWithCountryRegex = /^\+?[1-9]\d{1,14}$/;

// Message ID parameter validation
export const validateMessageId = [
  param('messageId')
    .isMongoId()
    .withMessage('Invalid message ID format')
];

// Phone number validation helper
const validatePhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // Check if it matches WhatsApp number format
  if (cleanPhone.startsWith('+')) {
    return whatsappNumberWithCountryRegex.test(cleanPhone);
  }
  
  return whatsappNumberRegex.test(cleanPhone);
};

// Send message validation
export const validateSendMessage = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  body('to')
    .notEmpty()
    .withMessage('Recipient phone number is required')
    .custom((phone: string) => {
      if (!validatePhoneNumber(phone)) {
        throw new Error('Invalid WhatsApp phone number format');
      }
      return true;
    }),
  body('message')
    .notEmpty()
    .withMessage('Message content is required')
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1, max: 4096 })
    .withMessage('Message must be between 1 and 4096 characters')
    .trim(),
  body('type')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact'])
    .withMessage('Invalid message type'),
  body('mediaUrl')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Media URL must be a valid HTTP or HTTPS URL')
    .isLength({ max: 2048 })
    .withMessage('Media URL must be less than 2048 characters'),
  body('filename')
    .optional()
    .isString()
    .withMessage('Filename must be a string')
    .isLength({ min: 1, max: 255 })
    .withMessage('Filename must be between 1 and 255 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Filename can only contain letters, numbers, dots, underscores, and hyphens'),
  body('caption')
    .optional()
    .isString()
    .withMessage('Caption must be a string')
    .isLength({ max: 1024 })
    .withMessage('Caption must be less than 1024 characters')
    .trim(),
  body('quotedMessageId')
    .optional()
    .isString()
    .withMessage('Quoted message ID must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Quoted message ID must be between 1 and 100 characters'),
  body('mentionedJidList')
    .optional()
    .isArray()
    .withMessage('Mentioned JID list must be an array'),
  body('mentionedJidList.*')
    .optional()
    .custom((jid: string) => {
      if (!validatePhoneNumber(jid.replace('@c.us', ''))) {
        throw new Error('Invalid mentioned JID format');
      }
      return true;
    }),
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90')
    .toFloat(),
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
    .toFloat(),
  body('location.description')
    .optional()
    .isString()
    .withMessage('Location description must be a string')
    .isLength({ max: 500 })
    .withMessage('Location description must be less than 500 characters'),
  body('contact')
    .optional()
    .isObject()
    .withMessage('Contact must be an object'),
  body('contact.displayName')
    .optional()
    .isString()
    .withMessage('Contact display name must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Contact display name must be between 1 and 100 characters'),
  body('contact.vcard')
    .optional()
    .isString()
    .withMessage('Contact vCard must be a string')
    .isLength({ min: 1, max: 2048 })
    .withMessage('Contact vCard must be between 1 and 2048 characters'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  body('options.linkPreview')
    .optional()
    .isBoolean()
    .withMessage('Link preview must be a boolean'),
  body('options.sendAudioAsVoice')
    .optional()
    .isBoolean()
    .withMessage('Send audio as voice must be a boolean'),
  body('options.parseVCards')
    .optional()
    .isBoolean()
    .withMessage('Parse vCards must be a boolean'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date) => {
      if (value <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      if (value > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
        throw new Error('Scheduled time cannot be more than 30 days in the future');
      }
      return true;
    })
];

// Send bulk messages validation
export const validateSendBulkMessages = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  body('messages')
    .isArray({ min: 1, max: 100 })
    .withMessage('Messages must be an array with 1 to 100 items'),
  body('messages.*.to')
    .notEmpty()
    .withMessage('Recipient phone number is required')
    .custom((phone: string) => {
      if (!validatePhoneNumber(phone)) {
        throw new Error('Invalid WhatsApp phone number format');
      }
      return true;
    }),
  body('messages.*.message')
    .notEmpty()
    .withMessage('Message content is required')
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1, max: 4096 })
    .withMessage('Message must be between 1 and 4096 characters'),
  body('messages.*.type')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact'])
    .withMessage('Invalid message type'),
  body('messages.*.mediaUrl')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Media URL must be a valid HTTP or HTTPS URL'),
  body('messages.*.caption')
    .optional()
    .isString()
    .withMessage('Caption must be a string')
    .isLength({ max: 1024 })
    .withMessage('Caption must be less than 1024 characters'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  body('options.delay')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Delay must be between 1 and 60 seconds')
    .toInt(),
  body('options.stopOnError')
    .optional()
    .isBoolean()
    .withMessage('Stop on error must be a boolean'),
  body('options.randomizeDelay')
    .optional()
    .isBoolean()
    .withMessage('Randomize delay must be a boolean'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date) => {
      if (value <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      if (value > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
        throw new Error('Scheduled time cannot be more than 30 days in the future');
      }
      return true;
    })
];

// Get messages validation
export const validateGetMessages = [
  query('sessionId')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
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
    .isLength({ min: 1, max: 200 })
    .withMessage('Search must be between 1 and 200 characters')
    .trim(),
  query('type')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'all'])
    .withMessage('Invalid message type filter'),
  query('direction')
    .optional()
    .isIn(['inbound', 'outbound', 'all'])
    .withMessage('Direction must be inbound, outbound, or all'),
  query('status')
    .optional()
    .isIn(['pending', 'sent', 'delivered', 'read', 'failed', 'all'])
    .withMessage('Invalid message status filter'),
  query('from')
    .optional()
    .custom((phone: string) => {
      if (phone && !validatePhoneNumber(phone)) {
        throw new Error('Invalid sender phone number format');
      }
      return true;
    }),
  query('to')
    .optional()
    .custom((phone: string) => {
      if (phone && !validatePhoneNumber(phone)) {
        throw new Error('Invalid recipient phone number format');
      }
      return true;
    }),
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
  query('hasMedia')
    .optional()
    .isBoolean()
    .withMessage('Has media must be a boolean')
    .toBoolean(),
  query('isGroup')
    .optional()
    .isBoolean()
    .withMessage('Is group must be a boolean')
    .toBoolean(),
  query('sortBy')
    .optional()
    .isIn(['timestamp', 'createdAt', 'updatedAt', 'type', 'status'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Message statistics validation
export const validateGetMessageStats = [
  query('sessionId')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
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
    .isIn(['type', 'status', 'direction', 'session', 'contact'])
    .withMessage('Invalid group by field')
];

// Search messages validation
export const validateSearchMessages = [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isString()
    .withMessage('Search query must be a string')
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters')
    .trim(),
  query('sessionId')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  query('type')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'all'])
    .withMessage('Invalid message type filter'),
  query('direction')
    .optional()
    .isIn(['inbound', 'outbound', 'all'])
    .withMessage('Direction must be inbound, outbound, or all'),
  query('from')
    .optional()
    .custom((phone: string) => {
      if (phone && !validatePhoneNumber(phone)) {
        throw new Error('Invalid sender phone number format');
      }
      return true;
    }),
  query('to')
    .optional()
    .custom((phone: string) => {
      if (phone && !validatePhoneNumber(phone)) {
        throw new Error('Invalid recipient phone number format');
      }
      return true;
    }),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
  query('page')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page must be a positive integer between 1 and 100')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be a positive integer between 1 and 50')
    .toInt()
];

// Delete message validation
export const validateDeleteMessage = [
  body('forEveryone')
    .optional()
    .isBoolean()
    .withMessage('For everyone must be a boolean')
    .toBoolean(),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
    .trim()
];

// Bulk delete messages validation
export const validateBulkDeleteMessages = [
  body('messageIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Message IDs must be an array with 1 to 100 items'),
  body('messageIds.*')
    .isMongoId()
    .withMessage('Each message ID must be a valid MongoDB ObjectId'),
  body('forEveryone')
    .optional()
    .isBoolean()
    .withMessage('For everyone must be a boolean')
    .toBoolean(),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
    .trim()
];

// Export messages validation
export const validateExportMessages = [
  query('sessionId')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  query('format')
    .optional()
    .isIn(['json', 'csv', 'xlsx'])
    .withMessage('Export format must be json, csv, or xlsx'),
  query('type')
    .optional()
    .isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'all'])
    .withMessage('Invalid message type filter'),
  query('direction')
    .optional()
    .isIn(['inbound', 'outbound', 'all'])
    .withMessage('Direction must be inbound, outbound, or all'),
  query('status')
    .optional()
    .isIn(['pending', 'sent', 'delivered', 'read', 'failed', 'all'])
    .withMessage('Invalid message status filter'),
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
  query('includeMedia')
    .optional()
    .isBoolean()
    .withMessage('Include media must be a boolean')
    .toBoolean(),
  query('maxRecords')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Max records must be between 1 and 10000')
    .toInt()
];

// Message template validation
export const validateMessageTemplate = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Template name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('Template name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('content')
    .notEmpty()
    .withMessage('Template content is required')
    .isString()
    .withMessage('Template content must be a string')
    .isLength({ min: 1, max: 4096 })
    .withMessage('Template content must be between 1 and 4096 characters'),
  body('variables')
    .optional()
    .isArray()
    .withMessage('Template variables must be an array'),
  body('variables.*')
    .optional()
    .isString()
    .withMessage('Each template variable must be a string')
    .matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .withMessage('Template variables must be valid identifiers'),
  body('category')
    .optional()
    .isIn(['marketing', 'utility', 'authentication'])
    .withMessage('Invalid template category'),
  body('language')
    .optional()
    .isIn(['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'ar', 'hi', 'zh'])
    .withMessage('Invalid template language'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean')
    .toBoolean()
];

// Send template message validation
export const validateSendTemplateMessage = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Session ID must be between 3 and 50 characters'),
  body('to')
    .notEmpty()
    .withMessage('Recipient phone number is required')
    .custom((phone: string) => {
      if (!validatePhoneNumber(phone)) {
        throw new Error('Invalid WhatsApp phone number format');
      }
      return true;
    }),
  body('templateId')
    .isMongoId()
    .withMessage('Invalid template ID format'),
  body('variables')
    .optional()
    .isObject()
    .withMessage('Template variables must be an object'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date) => {
      if (value <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      return true;
    })
];

// Message reaction validation
export const validateMessageReaction = [
  body('reaction')
    .notEmpty()
    .withMessage('Reaction is required')
    .isString()
    .withMessage('Reaction must be a string')
    .isLength({ min: 1, max: 10 })
    .withMessage('Reaction must be between 1 and 10 characters')
    .matches(/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u)
    .withMessage('Reaction must be a valid emoji')
];

// Message forward validation
export const validateForwardMessage = [
  body('to')
    .isArray({ min: 1, max: 10 })
    .withMessage('Recipients must be an array with 1 to 10 items'),
  body('to.*')
    .custom((phone: string) => {
      if (!validatePhoneNumber(phone)) {
        throw new Error('Invalid WhatsApp phone number format');
      }
      return true;
    }),
  body('withQuote')
    .optional()
    .isBoolean()
    .withMessage('With quote must be a boolean')
    .toBoolean()
];

// Common validation helpers
export const sanitizeMessageInput = {
  phoneNumber: (phone: string): string => {
    return phone.replace(/[^\d+]/g, '');
  },
  message: (message: string): string => {
    return message.trim().replace(/\s+/g, ' ');
  },
  filename: (filename: string): string => {
    return filename.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  }
};

// Message validation error messages
export const messageValidationMessages = {
  phoneNumberRequired: 'Phone number is required',
  phoneNumberInvalid: 'Invalid WhatsApp phone number format',
  messageRequired: 'Message content is required',
  messageEmpty: 'Message cannot be empty',
  messageTooLong: 'Message is too long',
  sessionIdRequired: 'Session ID is required',
  sessionIdInvalid: 'Session ID format is invalid',
  mediaUrlInvalid: 'Media URL is invalid',
  messageTypeInvalid: 'Invalid message type',
  locationInvalid: 'Location coordinates are invalid',
  contactInvalid: 'Contact information is invalid',
  scheduledTimeInvalid: 'Scheduled time must be in the future',
  bulkMessageLimit: 'Bulk messages limited to 100 recipients',
  templateNotFound: 'Message template not found',
  templateVariablesMissing: 'Required template variables are missing'
};

// Message type validation
export const isValidMessageType = (type: string): boolean => {
  return ['text', 'image', 'audio', 'video', 'document', 'location', 'contact'].includes(type);
};

// Message status validation
export const isValidMessageStatus = (status: string): boolean => {
  return ['pending', 'sent', 'delivered', 'read', 'failed'].includes(status);
};

// Message direction validation
export const isValidMessageDirection = (direction: string): boolean => {
  return ['inbound', 'outbound'].includes(direction);
};

// File type validation for media messages
export const isValidMediaType = (filename: string, messageType: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const validExtensions: { [key: string]: string[] } = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
    audio: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'opus'],
    video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', '3gp'],
    document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf']
  };
  
  return extension ? validExtensions[messageType]?.includes(extension) || false : false;
};

// Contact validation helper
export const validateContactInfo = (contact: any): boolean => {
  if (!contact || typeof contact !== 'object') return false;
  
  if (!contact.displayName || typeof contact.displayName !== 'string') return false;
  if (!contact.vcard || typeof contact.vcard !== 'string') return false;
  
  // Basic vCard format validation
  const vcardRegex = /^BEGIN:VCARD[\s\S]*END:VCARD$/;
  return vcardRegex.test(contact.vcard);
};

// Location validation helper
export const validateLocationInfo = (location: any): boolean => {
  if (!location || typeof location !== 'object') return false;
  
  const { latitude, longitude } = location;
  
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) return false;
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) return false;
  
  return true;
};

// Message content validation based on type
export const validateMessageContent = (type: string, content: any): boolean => {
  switch (type) {
    case 'text':
      return typeof content === 'string' && content.trim().length > 0;
    case 'location':
      return validateLocationInfo(content);
    case 'contact':
      return validateContactInfo(content);
    case 'image':
    case 'audio':
    case 'video':
    case 'document':
      return typeof content === 'string' && (content.startsWith('http') || content.startsWith('data:'));
    default:
      return false;
  }
};