import { body, param, query } from 'express-validator';
import { Request } from 'express';
import User from '../models/User';

// Common validation rules
const emailValidation = body('email')
  .isEmail()
  .withMessage('Please provide a valid email address')
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Email must be less than 255 characters');

const passwordValidation = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');

const nameValidation = body('name')
  .trim()
  .isLength({ min: 2, max: 100 })
  .withMessage('Name must be between 2 and 100 characters')
  .matches(/^[a-zA-Z\s'-]+$/)
  .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes');

const phoneValidation = body('phone')
  .optional()
  .isMobilePhone('any', { strictMode: false })
  .withMessage('Please provide a valid phone number');

const subscriptionPlanValidation = body('subscriptionPlan')
  .optional()
  .isIn(['free', 'basic', 'premium', 'enterprise'])
  .withMessage('Invalid subscription plan');

// User registration validation
export const validateUserRegistration = [
  nameValidation,
  emailValidation.custom(async (email: string) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email is already registered');
    }
    return true;
  }),
  passwordValidation,
  body('confirmPassword')
    .custom((value: string, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  phoneValidation,
  body('acceptTerms')
    .isBoolean()
    .withMessage('Accept terms must be a boolean')
    .custom((value: boolean) => {
      if (!value) {
        throw new Error('You must accept the terms and conditions');
      }
      return true;
    }),
  body('marketingConsent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean')
];

// User login validation
export const validateUserLogin = [
  emailValidation,
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password must be less than 128 characters'),
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean')
];

// Email verification validation
export const validateEmailVerification = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid verification token format')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Verification token can only contain alphanumeric characters')
];

// Password reset request validation
export const validatePasswordResetRequest = [
  emailValidation
];

// Password reset validation
export const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid reset token format')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Reset token can only contain alphanumeric characters'),
  passwordValidation,
  body('confirmPassword')
    .custom((value: string, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    })
];

// Change password validation
export const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required')
    .isLength({ max: 128 })
    .withMessage('Current password must be less than 128 characters'),
  passwordValidation,
  body('confirmPassword')
    .custom((value: string, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    })
];

// Update profile validation
export const validateUpdateProfile = [
  nameValidation.optional(),
  phoneValidation,
  body('timezone')
    .optional()
    .isIn([
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
      'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland'
    ])
    .withMessage('Invalid timezone'),
  body('language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'])
    .withMessage('Invalid language code'),
  body('notificationPreferences')
    .optional()
    .isObject()
    .withMessage('Notification preferences must be an object'),
  body('notificationPreferences.email')
    .optional()
    .isObject()
    .withMessage('Email preferences must be an object'),
  body('notificationPreferences.email.enabled')
    .optional()
    .isBoolean()
    .withMessage('Email enabled must be a boolean'),
  body('notificationPreferences.sms')
    .optional()
    .isObject()
    .withMessage('SMS preferences must be an object'),
  body('notificationPreferences.sms.enabled')
    .optional()
    .isBoolean()
    .withMessage('SMS enabled must be a boolean'),
  body('notificationPreferences.push')
    .optional()
    .isObject()
    .withMessage('Push preferences must be an object'),
  body('notificationPreferences.push.enabled')
    .optional()
    .isBoolean()
    .withMessage('Push enabled must be a boolean')
];

// Update subscription validation
export const validateUpdateSubscription = [
  subscriptionPlanValidation.notEmpty().withMessage('Subscription plan is required'),
  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Payment method ID must be between 1 and 100 characters'),
  body('billingCycle')
    .optional()
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be monthly or yearly')
];

// User ID parameter validation
export const validateUserId = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format')
];

// Get users query validation
export const validateGetUsers = [
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
  query('subscriptionPlan')
    .optional()
    .isIn(['free', 'basic', 'premium', 'enterprise'])
    .withMessage('Invalid subscription plan filter'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
    .toBoolean(),
  query('isEmailVerified')
    .optional()
    .isBoolean()
    .withMessage('isEmailVerified must be a boolean')
    .toBoolean(),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'name', 'email', 'subscriptionPlan', 'lastLoginAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Refresh token validation
export const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isJWT()
    .withMessage('Invalid refresh token format')
];

// API key generation validation
export const validateGenerateApiKey = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('API key name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s_-]+$/)
    .withMessage('API key name can only contain letters, numbers, spaces, underscores, and hyphens'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  body('permissions.*')
    .optional()
    .isIn(['messages:send', 'messages:read', 'sessions:manage', 'webhooks:manage', 'analytics:read'])
    .withMessage('Invalid permission'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO 8601 date')
    .toDate()
    .custom((value: Date) => {
      if (value <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    })
];

// API key ID parameter validation
export const validateApiKeyId = [
  param('keyId')
    .isMongoId()
    .withMessage('Invalid API key ID format')
];

// Deactivate account validation
export const validateDeactivateAccount = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to deactivate account')
    .isLength({ max: 128 })
    .withMessage('Password must be less than 128 characters'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
    .trim(),
  body('feedback')
    .optional()
    .isString()
    .withMessage('Feedback must be a string')
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters')
    .trim()
];

// Upload avatar validation
export const validateUploadAvatar = [
  body('avatar')
    .optional()
    .custom((value, { req }) => {
      if (!req.file) {
        throw new Error('Avatar file is required');
      }
      
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        throw new Error('Avatar must be a JPEG, PNG, GIF, or WebP image');
      }
      
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        throw new Error('Avatar file size must be less than 5MB');
      }
      
      return true;
    })
];

// Two-factor authentication setup validation
export const validateSetupTwoFactor = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to setup two-factor authentication')
    .isLength({ max: 128 })
    .withMessage('Password must be less than 128 characters')
];

// Two-factor authentication verification validation
export const validateVerifyTwoFactor = [
  body('token')
    .notEmpty()
    .withMessage('Two-factor authentication token is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Two-factor authentication token must be 6 digits')
    .isNumeric()
    .withMessage('Two-factor authentication token must contain only numbers')
];

// Disable two-factor authentication validation
export const validateDisableTwoFactor = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to disable two-factor authentication')
    .isLength({ max: 128 })
    .withMessage('Password must be less than 128 characters'),
  body('token')
    .notEmpty()
    .withMessage('Two-factor authentication token is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Two-factor authentication token must be 6 digits')
    .isNumeric()
    .withMessage('Two-factor authentication token must contain only numbers')
];

// Export data validation
export const validateExportData = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Export format must be json or csv'),
  query('includeMessages')
    .optional()
    .isBoolean()
    .withMessage('Include messages must be a boolean')
    .toBoolean(),
  query('includeSessions')
    .optional()
    .isBoolean()
    .withMessage('Include sessions must be a boolean')
    .toBoolean(),
  query('includeAnalytics')
    .optional()
    .isBoolean()
    .withMessage('Include analytics must be a boolean')
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
export const sanitizeUserInput = {
  name: (name: string): string => name.trim().replace(/\s+/g, ' '),
  email: (email: string): string => email.toLowerCase().trim(),
  phone: (phone: string): string => phone.replace(/\D/g, ''),
  timezone: (timezone: string): string => timezone.trim(),
  language: (language: string): string => language.toLowerCase().trim()
};

// Validation error messages
export const validationMessages = {
  required: (field: string) => `${field} is required`,
  invalid: (field: string) => `Invalid ${field}`,
  tooShort: (field: string, min: number) => `${field} must be at least ${min} characters`,
  tooLong: (field: string, max: number) => `${field} must be less than ${max} characters`,
  invalidFormat: (field: string) => `${field} format is invalid`,
  alreadyExists: (field: string) => `${field} already exists`,
  notFound: (field: string) => `${field} not found`,
  mismatch: (field1: string, field2: string) => `${field1} does not match ${field2}`
};