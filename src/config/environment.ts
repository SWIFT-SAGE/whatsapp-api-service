import { config } from './index';

// Environment-specific configurations
export const environmentConfig = {
  development: {
    // Server settings
    server: {
      port: 3000,
      host: 'localhost',
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
        credentials: true,
      },
    },
    
    // Database settings
    database: {
      debug: true,
      slowQueryThreshold: 1000, // 1 second
      connectionTimeout: 10000,
    },
    
    // Logging settings
    logging: {
      level: 'debug',
      console: true,
      file: false,
      prettyPrint: true,
    },
    
    // Security settings (relaxed for development)
    security: {
      bcryptRounds: 8, // Faster for development
      jwtExpiresIn: '24h',
      rateLimiting: {
        enabled: false, // Disabled for easier development
      },
    },
    
    // Performance settings
    performance: {
      compression: false, // Disabled for easier debugging
      caching: false,     // Disabled for real-time updates
    },
    
    // WhatsApp settings
    whatsapp: {
      headless: false, // Show browser for debugging
      devtools: true,
      slowMo: 100,     // Slow down for debugging
    },
    
    // External services (mock/test versions)
    services: {
      email: {
        mock: true,
        logEmails: true,
      },
      sms: {
        mock: true,
      },
      storage: {
        local: true,
        path: './dev-uploads',
      },
    },
  },
  
  test: {
    // Server settings
    server: {
      port: 0, // Random port for testing
      host: 'localhost',
    },
    
    // Database settings (use test database)
    database: {
      name: 'whatsapp_api_test',
      dropOnStart: true,
      debug: false,
    },
    
    // Logging settings (minimal for tests)
    logging: {
      level: 'error',
      console: false,
      file: false,
    },
    
    // Security settings (fast for testing)
    security: {
      bcryptRounds: 4, // Fastest for tests
      jwtExpiresIn: '1h',
    },
    
    // Performance settings (disabled for tests)
    performance: {
      compression: false,
      caching: false,
    },
    
    // WhatsApp settings (mocked)
    whatsapp: {
      mock: true,
      headless: true,
    },
    
    // External services (all mocked)
    services: {
      email: { mock: true },
      sms: { mock: true },
      storage: { mock: true },
      webhooks: { mock: true },
    },
  },
  
  staging: {
    // Server settings
    server: {
      port: process.env.PORT || 3000,
      host: '0.0.0.0',
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || [],
        credentials: true,
      },
    },
    
    // Database settings
    database: {
      debug: false,
      slowQueryThreshold: 2000, // 2 seconds
      connectionTimeout: 30000,
      ssl: true,
    },
    
    // Logging settings
    logging: {
      level: 'info',
      console: true,
      file: true,
      prettyPrint: false,
    },
    
    // Security settings
    security: {
      bcryptRounds: 10,
      jwtExpiresIn: '7d',
      rateLimiting: {
        enabled: true,
        strict: false, // Less strict than production
      },
    },
    
    // Performance settings
    performance: {
      compression: true,
      caching: true,
      level: 'medium',
    },
    
    // WhatsApp settings
    whatsapp: {
      headless: true,
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
    
    // External services (real but with staging configs)
    services: {
      email: {
        mock: false,
        testMode: true,
      },
      sms: {
        mock: false,
        testMode: true,
      },
      storage: {
        provider: 'aws-s3',
        bucket: process.env.AWS_S3_STAGING_BUCKET,
      },
    },
  },
  
  production: {
    // Server settings
    server: {
      port: process.env.PORT || 3000,
      host: '0.0.0.0',
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || false,
        credentials: true,
      },
      trustProxy: true,
    },
    
    // Database settings
    database: {
      debug: false,
      slowQueryThreshold: 5000, // 5 seconds
      connectionTimeout: 30000,
      ssl: true,
      replicaSet: true,
    },
    
    // Logging settings
    logging: {
      level: 'warn',
      console: false,
      file: true,
      prettyPrint: false,
      structured: true,
    },
    
    // Security settings (strict)
    security: {
      bcryptRounds: 12,
      jwtExpiresIn: '7d',
      rateLimiting: {
        enabled: true,
        strict: true,
      },
      helmet: {
        enabled: true,
        hsts: true,
        csp: true,
      },
    },
    
    // Performance settings (optimized)
    performance: {
      compression: true,
      caching: true,
      level: 'high',
      clustering: true,
    },
    
    // WhatsApp settings (production optimized)
    whatsapp: {
      headless: true,
      devtools: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
    
    // External services (production)
    services: {
      email: {
        mock: false,
        provider: 'aws-ses',
      },
      sms: {
        mock: false,
        provider: 'twilio',
      },
      storage: {
        provider: 'aws-s3',
        bucket: process.env.AWS_S3_BUCKET,
        cdn: process.env.CDN_URL,
      },
      monitoring: {
        enabled: true,
        provider: 'datadog', // or 'newrelic', 'prometheus'
      },
    },
  },
};

// Get current environment configuration
export const getCurrentEnvironmentConfig = () => {
  const env = config.env as keyof typeof environmentConfig;
  return environmentConfig[env] || environmentConfig.development;
};

// Environment validation
export const validateEnvironment = () => {
  const requiredVars = {
    development: ['MONGODB_URI', 'JWT_SECRET'],
    test: ['MONGODB_URI', 'JWT_SECRET'],
    staging: ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'],
    production: [
      'MONGODB_URI',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASS',
    ],
  };
  
  const env = config.env as keyof typeof requiredVars;
  const required = requiredVars[env] || requiredVars.development;
  
  const missing = required.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for ${env}: ${missing.join(', ')}`
    );
  }
};

// Environment-specific middleware
export const environmentMiddleware = {
  // Development-only middleware
  development: [
    // Add development-specific middleware here
  ],
  
  // Test-only middleware
  test: [
    // Add test-specific middleware here
  ],
  
  // Staging-only middleware
  staging: [
    // Add staging-specific middleware here
  ],
  
  // Production-only middleware
  production: [
    // Add production-specific middleware here
  ],
};

// Feature flags based on environment
export const featureFlags = {
  // API Documentation
  apiDocs: {
    enabled: !config.isProduction,
    path: '/docs',
  },
  
  // Debug endpoints
  debugEndpoints: {
    enabled: config.isDevelopment,
    path: '/debug',
  },
  
  // Metrics endpoint
  metricsEndpoint: {
    enabled: config.isProduction || config.env === 'staging' as string,
    path: '/metrics',
    auth: config.isProduction,
  },
  
  // Health check endpoint
  healthCheck: {
    enabled: true,
    path: '/health',
    detailed: !config.isProduction,
  },
  
  // File upload
  fileUpload: {
    enabled: true,
    maxSize: config.isDevelopment ? '50mb' : '10mb',
    allowedTypes: config.isDevelopment 
      ? ['image/*', 'application/*', 'text/*']
      : ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  },
  
  // Webhook testing
  webhookTesting: {
    enabled: !config.isProduction,
    mockEndpoints: config.isDevelopment,
  },
  
  // Analytics
  analytics: {
    enabled: true,
    detailed: config.isProduction,
    realtime: config.isDevelopment,
  },
  
  // Rate limiting
  rateLimiting: {
    enabled: config.isProduction || config.env === 'staging' as keyof typeof environmentConfig,
    strict: config.isProduction,
  },
};

// Environment-specific constants
export const environmentConstants = {
  // Timeouts
  timeouts: {
    request: config.isDevelopment ? 60000 : 30000,
    database: config.isDevelopment ? 10000 : 5000,
    webhook: config.isDevelopment ? 30000 : 10000,
  },
  
  // Limits
  limits: {
    maxSessions: config.isDevelopment ? 5 : (config.isProduction ? 100 : 20),
    maxWebhooks: config.isDevelopment ? 10 : (config.isProduction ? 50 : 25),
    maxApiKeys: config.isDevelopment ? 5 : (config.isProduction ? 20 : 10),
  },
  
  // Intervals
  intervals: {
    healthCheck: config.isDevelopment ? 60000 : 30000,
    cleanup: config.isDevelopment ? 300000 : 60000,
    metrics: config.isDevelopment ? 30000 : 10000,
  },
};

export default {
  environmentConfig,
  getCurrentEnvironmentConfig,
  validateEnvironment,
  environmentMiddleware,
  featureFlags,
  environmentConstants,
};