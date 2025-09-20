import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('localhost'),
  
  // Database Configuration
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  MONGODB_DB_NAME: z.string().default('whatsapp_api'),
  
  // Redis Configuration has been removed

  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Email Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SMTP_SECURE: z.string().transform(val => val === 'true').default('false'),
  
  // WhatsApp Configuration
  WHATSAPP_SESSION_PATH: z.string().default('./sessions'),
  WHATSAPP_MAX_SESSIONS: z.string().transform(Number).default('10'),
  WHATSAPP_SESSION_TIMEOUT: z.string().transform(Number).default('300000'), // 5 minutes
  WHATSAPP_MAX_RETRY: z.string().transform(Number).default('3'),
  
  // File Upload Configuration
  UPLOAD_PATH: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'), // 10MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,application/pdf,text/plain'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  RATE_LIMIT_MESSAGE: z.string().default('Too many requests, please try again later'),
  
  // Security
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('false'),
  HELMET_ENABLED: z.string().transform(val => val === 'true').default('true'),
  CORS_METHODS: z.string().default('GET,POST,PUT,DELETE,OPTIONS'),
  CORS_HEADERS: z.string().default('Content-Type,Authorization'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),
  LOG_MAX_SIZE: z.string().default('20m'),
  LOG_MAX_FILES: z.string().transform(Number).default('5'), 
  LOG_FILE_NAME: z.string().default('app.log'),
  
  // Monitoring & Analytics
  ANALYTICS_ENABLED: z.string().transform(val => val === 'true').default('true'),
  METRICS_ENABLED: z.string().transform(val => val === 'true').default('true'),
  HEALTH_CHECK_INTERVAL: z.string().transform(Number).default('30000'), // 30 seconds
  
  // Webhook Configuration
  WEBHOOK_TIMEOUT: z.string().transform(Number).default('10000'), // 10 seconds
  WEBHOOK_RETRY_ATTEMPTS: z.string().transform(Number).default('3'),
  WEBHOOK_RETRY_DELAY: z.string().transform(Number).default('1000'), // 1 second
  
  // API Configuration
  API_VERSION: z.string().default('v1'),
  API_PREFIX: z.string().default('/api'),
  API_DOCS_ENABLED: z.string().transform(val => val === 'true').default('true'),
  
  // Performance
  COMPRESSION_ENABLED: z.string().transform(val => val === 'true').default('true'),
  COMPRESSION_LEVEL: z.string().transform(Number).default('6'),
  CACHE_TTL: z.string().transform(Number).default('3600'), // 1 hour
  
  // External Services
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  
  // Development
  DEBUG: z.string().transform(val => val === 'true').default('false'),
  MOCK_WHATSAPP: z.string().transform(val => val === 'true').default('false'),
});

// Validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  parseResult.error.issues.forEach(issue => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

const env = parseResult.data;

// Configuration object
export const config = {
  // Environment
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Server
  server: {
    port: env.PORT,
    host: env.HOST,
    baseUrl: `http://${env.HOST}:${env.PORT}`,
  },
  
  // Database
  database: {
    uri: env.MONGODB_URI,
    name: env.MONGODB_DB_NAME,
    options: {
      maxPoolSize: env.NODE_ENV === 'production' ? 20 : 10,
    
      bufferMaxEntries: 0,
      bufferCommands: false,
    },
  },
  
  // Redis configuration has been removed,
  
  // JWT
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    algorithm: 'HS256' as const,
    issuer: 'whatsapp-api-service',
    audience: 'whatsapp-api-users',
  },
  
  // Email
  email: {
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASS ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      } : undefined,
    },
    from: env.SMTP_FROM || 'noreply@whatsapp-api.com',
    templates: {
      path: path.join(__dirname, '../templates/email'),
      cache: env.NODE_ENV === 'production',
    },
  },
  
  // WhatsApp
  whatsapp: {
    sessionPath: path.resolve(env.WHATSAPP_SESSION_PATH),
    maxSessions: env.WHATSAPP_MAX_SESSIONS,
    sessionTimeout: env.WHATSAPP_SESSION_TIMEOUT,
    puppeteerOptions: {
      headless: env.NODE_ENV === 'production',
      args: env.NODE_ENV === 'production' ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ] : [],
    },
  },
  
  // File Upload
  upload: {
    path: path.resolve(env.UPLOAD_PATH),
    maxSize: env.MAX_FILE_SIZE,
    allowedTypes: env.ALLOWED_FILE_TYPES.split(','),
    limits: {
      fileSize: env.MAX_FILE_SIZE,
      files: 10,
      fields: 20,
    },
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: env.RATE_LIMIT_MESSAGE,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: any) => env.NODE_ENV === 'development' && req.ip === '127.0.0.1',
  },
  
  // Security
  security: {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: env.CORS_CREDENTIALS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    },
    helmet: {
      enabled: env.HELMET_ENABLED,
      contentSecurityPolicy: env.NODE_ENV === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      } : false,
    },
    bcrypt: {
      rounds: env.NODE_ENV === 'production' ? 12 : 10,
    },
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
    file: {
      enabled: env.NODE_ENV === 'production',
      path: env.LOG_FILE_PATH,
      maxSize: env.LOG_MAX_SIZE,
      maxFiles: env.LOG_MAX_FILES,
    },
    console: {
      enabled: env.NODE_ENV !== 'production',
      colorize: env.NODE_ENV === 'development',
    },
  },
  
  // Monitoring
  monitoring: {
    analytics: env.ANALYTICS_ENABLED,
    metrics: env.METRICS_ENABLED,
    metricsInterval: 60000, // 1 minute
    systemMetrics: {
      enabled: env.METRICS_ENABLED,
      interval: 30000, // 30 seconds
    },
    healthCheck: {
      interval: env.HEALTH_CHECK_INTERVAL,
      timeout: 5000,
    },
  },
  
  // Webhooks
  webhooks: {
    timeout: env.WEBHOOK_TIMEOUT,
    retryAttempts: env.WEBHOOK_RETRY_ATTEMPTS,
    retryDelay: env.WEBHOOK_RETRY_DELAY,
    maxPayloadSize: '1mb',
  },
  
  // API
  api: {
    version: env.API_VERSION,
    prefix: env.API_PREFIX,
    docs: {
      enabled: env.API_DOCS_ENABLED,
      path: '/docs',
      title: 'WhatsApp API Service',
      version: '1.0.0',
    },
  },
  
  // Performance
  performance: {
    compression: {
      enabled: env.COMPRESSION_ENABLED,
      level: env.COMPRESSION_LEVEL,
      threshold: 1024,
    },
    cache: {
      ttl: env.CACHE_TTL,
      checkPeriod: 600, // 10 minutes
    },
  },
  
  // External Services
  services: {
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      phoneNumber: env.TWILIO_PHONE_NUMBER,
    },
    aws: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: env.AWS_REGION,
      s3: {
        bucket: env.AWS_S3_BUCKET,
      },
    },
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    },
  },
  
  // Development
  development: {
    debug: env.DEBUG,
    mockWhatsApp: env.MOCK_WHATSAPP,
  },
} as const;

// Type definitions
export type Config = typeof config;
export type Environment = typeof env.NODE_ENV;

// Validation helpers
export const validateConfig = () => {
  const requiredInProduction = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];
  
  if (config.isProduction) {
    const missing = requiredInProduction.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }
  }
};

// Initialize configuration
validateConfig();

export default config;