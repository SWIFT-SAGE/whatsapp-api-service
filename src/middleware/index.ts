/**
 * Middleware Index
 * Exports all middleware components for easy importing
 */

// Authentication middleware
export {
  authenticateToken,
  authenticateApiKey,
  requireSubscription,
  requireVerification,
  optionalAuth
} from './auth';

// Rate limiting middleware
export {
  generalRateLimit,
  authRateLimit,
  messageRateLimit,
  webhookRateLimit,
  apiKeyRateLimit,
  createCustomRateLimit,
  checkUserRateLimit
} from './rateLimiter';

// Validation middleware
export {
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
} from './validation';

// Error handling middleware
export {
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
} from './errorHandler';

// Logging middleware
export {
  requestLogger,
  auditLogger,
  logAuditEvent,
  logSecurityEvent,
  performanceLogger,
  logDatabaseOperation,
  logWhatsAppOperation,
  logWebhookDelivery,
  logRateLimit
} from './logging';

// CORS middleware
export {
  createCorsMiddleware,
  developmentCors,
  productionCors,
  apiCors,
  webhookCors,
  corsWithLogging,
  getCorsMiddleware,
  securityHeaders
} from './cors';

// Security middleware
export {
  helmetSecurity,
  ipWhitelist,
  validateUserAgent,
  requestSizeLimiter,
  sqlInjectionProtection,
  xssProtection,
  validateRequestSignature,
  bruteForceProtection,
  suspiciousActivitySlowDown,
  securityStack
} from './security';

// Import all middleware modules for default export
import * as authMiddleware from './auth';
import rateLimiterMiddleware from './rateLimiter';
import validationMiddleware from './validation';
import errorHandlerMiddleware from './errorHandler';
import loggingMiddleware from './logging';
import corsMiddleware from './cors';
import securityMiddleware from './security';

/**
 * Middleware configuration interface
 */
export interface MiddlewareConfig {
  enableAuth: boolean;
  enableRateLimit: boolean;
  enableValidation: boolean;
  enableErrorHandling: boolean;
  enableLogging: boolean;
  enableCors: boolean;
  enableSecurity: boolean;
  environment: 'development' | 'staging' | 'production';
}

/**
 * Default middleware configuration
 */
export const defaultMiddlewareConfig: MiddlewareConfig = {
  enableAuth: true,
  enableRateLimit: true,
  enableValidation: true,
  enableErrorHandling: true,
  enableLogging: true,
  enableCors: true,
  enableSecurity: true,
  environment: (process.env.NODE_ENV as any) || 'development'
};

/**
 * Common middleware stacks for different use cases
 */
export const middlewareStacks = {
  // Basic API middleware stack
  api: [
    'addRequestId',
    'requestLogger',
    'getCorsMiddleware',
    'helmetSecurity',
    'generalRateLimit',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ],

  // Authentication required endpoints
  authenticated: [
    'addRequestId',
    'requestLogger',
    'getCorsMiddleware',
    'helmetSecurity',
    'generalRateLimit',
    'authenticateToken',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ],

  // API key authentication endpoints
  apiKey: [
    'addRequestId',
    'requestLogger',
    'apiCors',
    'helmetSecurity',
    'apiKeyRateLimit',
    'authenticateApiKey',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ],

  // Public endpoints (no authentication)
  public: [
    'addRequestId',
    'requestLogger',
    'getCorsMiddleware',
    'helmetSecurity',
    'generalRateLimit',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ],

  // Authentication endpoints (login, register)
  auth: [
    'addRequestId',
    'requestLogger',
    'getCorsMiddleware',
    'helmetSecurity',
    'authRateLimit',
    'bruteForceProtection',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ],

  // Message sending endpoints
  messaging: [
    'addRequestId',
    'requestLogger',
    'apiCors',
    'helmetSecurity',
    'messageRateLimit',
    'authenticateApiKey',
    'requireSubscription(["basic", "pro", "enterprise"])',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ],

  // Webhook endpoints
  webhook: [
    'addRequestId',
    'requestLogger',
    'webhookCors',
    'helmetSecurity',
    'webhookRateLimit',
    'validateRequestSignature',
    'validateUserAgent'
  ],

  // Admin endpoints
  admin: [
    'addRequestId',
    'requestLogger',
    'getCorsMiddleware',
    'helmetSecurity',
    'generalRateLimit',
    'authenticateToken',
    'requireSubscription(["enterprise"])',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ],

  // File upload endpoints
  upload: [
    'addRequestId',
    'requestLogger',
    'getCorsMiddleware',
    'helmetSecurity',
    'generalRateLimit',
    'authenticateToken',
    'requestSizeLimiter("50mb")',
    'validateUserAgent',
    'sqlInjectionProtection',
    'xssProtection'
  ]
};

/**
 * Error handling middleware stack (should be applied last)
 */
export const errorMiddlewareStack = [
  'whatsappErrorHandler',
  'errorHandler',
  'notFoundHandler'
];

/**
 * Get middleware stack by name
 */
export const getMiddlewareStack = (stackName: keyof typeof middlewareStacks): string[] => {
  return middlewareStacks[stackName] || middlewareStacks.api;
};

/**
 * Apply middleware stack to Express app or router
 */
export const applyMiddlewareStack = (app: any, stackName: keyof typeof middlewareStacks): void => {
  const stack = getMiddlewareStack(stackName);
  
  stack.forEach(middlewareName => {
    // Parse middleware with parameters
    const match = middlewareName.match(/^([^(]+)(?:\((.+)\))?$/);
    if (!match) return;
    
    const [, name, params] = match;
    
    // Get middleware function
    const middleware = getMiddlewareFunction(name, params);
    if (middleware) {
      app.use(middleware);
    }
  });
};

/**
 * Get middleware function by name
 */
const getMiddlewareFunction = (name: string, params?: string): any => {
  // Import all middleware functions
  const middlewareFunctions = {
    // From this index file exports
    addRequestId: require('./errorHandler').addRequestId,
    requestLogger: require('./logging').requestLogger,
    getCorsMiddleware: require('./cors').getCorsMiddleware,
    helmetSecurity: require('./security').helmetSecurity,
    generalRateLimit: require('./rateLimiter').generalRateLimit,
    authenticateToken: require('./auth').authenticateToken,
    authenticateApiKey: require('./auth').authenticateApiKey,
    requireSubscription: require('./auth').requireSubscription,
    validateUserAgent: require('./security').validateUserAgent,
    sqlInjectionProtection: require('./security').sqlInjectionProtection,
    xssProtection: require('./security').xssProtection,
    apiCors: require('./cors').apiCors,
    apiKeyRateLimit: require('./rateLimiter').apiKeyRateLimit,
    authRateLimit: require('./rateLimiter').authRateLimit,
    bruteForceProtection: require('./security').bruteForceProtection,
    messageRateLimit: require('./rateLimiter').messageRateLimit,
    webhookCors: require('./cors').webhookCors,
    webhookRateLimit: require('./rateLimiter').webhookRateLimit,
    validateRequestSignature: require('./security').validateRequestSignature,
    requestSizeLimiter: require('./security').requestSizeLimiter,
    whatsappErrorHandler: require('./errorHandler').whatsappErrorHandler,
    errorHandler: require('./errorHandler').errorHandler,
    notFoundHandler: require('./errorHandler').notFoundHandler
  };
  
  const middlewareFunction = middlewareFunctions[name as keyof typeof middlewareFunctions];
  
  if (!middlewareFunction) {
    console.warn(`Middleware function '${name}' not found`);
    return null;
  }
  
  // Handle middleware with parameters
  if (params) {
    try {
      // Parse parameters (simple JSON-like parsing)
      const parsedParams = params.startsWith('[') || params.startsWith('{') 
        ? JSON.parse(params)
        : params.replace(/"/g, '');
      
      return middlewareFunction(parsedParams);
    } catch (error) {
      console.warn(`Failed to parse parameters for middleware '${name}':`, params);
      return middlewareFunction;
    }
  }
  
  return middlewareFunction;
};

/**
 * Validation middleware combinations
 */
export const validationStacks = {
  userRegistration: [
    'validateUserRegistration',
    'handleValidationErrors'
  ],
  userLogin: [
    'validateUserLogin',
    'handleValidationErrors'
  ],
  userUpdate: [
    'validateUserUpdate',
    'handleValidationErrors'
  ],
  passwordChange: [
    'validatePasswordChange',
    'handleValidationErrors'
  ],
  sessionCreation: [
    'validateSessionCreation',
    'handleValidationErrors'
  ],
  messageSend: [
    'validateMessageSend',
    'handleValidationErrors'
  ],
  webhookConfig: [
    'validateWebhookConfig',
    'handleValidationErrors'
  ],
  apiKeyCreation: [
    'validateApiKeyCreation',
    'handleValidationErrors'
  ],
  pagination: [
    'validatePagination',
    'handleValidationErrors'
  ],
  dateRange: [
    'validateDateRange',
    'handleValidationErrors'
  ]
};

/**
 * Default export with all middleware modules
 */
export default {
  auth: authMiddleware,
  rateLimiter: rateLimiterMiddleware,
  validation: validationMiddleware,
  errorHandler: errorHandlerMiddleware,
  logging: loggingMiddleware,
  cors: corsMiddleware,
  security: securityMiddleware,
  stacks: middlewareStacks,
  validationStacks,
  errorStack: errorMiddlewareStack,
  config: defaultMiddlewareConfig,
  getStack: getMiddlewareStack,
  applyStack: applyMiddlewareStack
};