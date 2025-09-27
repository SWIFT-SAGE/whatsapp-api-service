// Import services for internal use
import userService from './UserService';
import sessionService from './SessionService';
import messageService from './MessageService';
import whatsappService from './whatsappService';
import emailService from './EmailService';
import rateLimitService from './rateLimitService';
import analyticsService from './AnalyticsService';
import webhookService from './WebhookService';
import notificationService from './NotificationService';

// Service exports
export { userService, sessionService, messageService, whatsappService, emailService, rateLimitService, analyticsService, webhookService, notificationService };

// Type exports
export type { CreateUserData, UpdateUserData, LoginData, ChangePasswordData, UserStats } from './UserService';
export type { CreateSessionData, UpdateSessionData, SessionStats } from './SessionService';
export type { SendMessageData, MessageFilter, MessageStats, BulkMessageData } from './MessageService';

// Service Configuration
export interface ServiceConfig {
  email: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  sms: {
    enabled: boolean;
    provider: 'twilio' | 'aws-sns';
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;
  };
  push: {
    enabled: boolean;
    provider: 'firebase' | 'onesignal';
    apiKey?: string;
    appId?: string;
  };
  analytics: {
    enabled: boolean;
    retentionDays: number;
  };
  webhooks: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
  };
  rateLimiting: {
    enabled: boolean;
    redis: {
      host: string;
      port: number;
      password?: string;
    };
  };
}

// Default Service Configuration
export const defaultServiceConfig: ServiceConfig = {
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@whatsapp-api.com'
  },
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    provider: (process.env.SMS_PROVIDER as any) || 'twilio',
    apiKey: process.env.SMS_API_KEY,
    apiSecret: process.env.SMS_API_SECRET,
    fromNumber: process.env.SMS_FROM_NUMBER
  },
  push: {
    enabled: process.env.PUSH_ENABLED === 'true',
    provider: (process.env.PUSH_PROVIDER as any) || 'firebase',
    apiKey: process.env.PUSH_API_KEY,
    appId: process.env.PUSH_APP_ID
  },
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365')
  },
  webhooks: {
    enabled: process.env.WEBHOOKS_ENABLED !== 'false',
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000')
  },
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    }
  }
};

// Service Health Check
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  lastCheck: Date;
  responseTime?: number;
}

// Service Manager
export class ServiceManager {
  private services: Map<string, any> = new Map();
  private healthChecks: Map<string, ServiceHealth> = new Map();

  constructor() {
    this.registerServices();
    this.startHealthChecks();
  }

  /**
   * Register all services
   */
  private registerServices(): void {
    this.services.set('user', userService);
    this.services.set('session', sessionService);
    this.services.set('message', messageService);
    this.services.set('webhook', webhookService);
    this.services.set('analytics', analyticsService);
    this.services.set('email', emailService);
    this.services.set('notification', notificationService);
    this.services.set('whatsapp', whatsappService);
    this.services.set('rateLimit', rateLimitService);
  }

  /**
   * Get service by name
   */
  getService<T = any>(name: string): T | undefined {
    return this.services.get(name);
  }

  /**
   * Get all services
   */
  getAllServices(): Map<string, any> {
    return new Map(this.services);
  }

  /**
   * Get service health status
   */
  getServiceHealth(name: string): ServiceHealth | undefined {
    return this.healthChecks.get(name);
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Check if all services are healthy
   */
  areAllServicesHealthy(): boolean {
    return Array.from(this.healthChecks.values()).every(
      health => health.status === 'healthy'
    );
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    // Initial health check
    this.performHealthChecks();

    // Periodic health checks every 5 minutes
    setInterval(() => {
      this.performHealthChecks();
    }, 5 * 60 * 1000);
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    const services = [
      { name: 'user', service: userService },
      { name: 'session', service: sessionService },
      { name: 'message', service: messageService },
      { name: 'webhook', service: webhookService },
      { name: 'analytics', service: analyticsService },
      { name: 'email', service: emailService },
      { name: 'notification', service: notificationService },
      { name: 'whatsapp', service: whatsappService },
      { name: 'rateLimit', service: rateLimitService }
    ];

    for (const { name, service } of services) {
      const startTime = Date.now();
      let health: ServiceHealth;

      try {
        // Check if service has a health check method
        if ('healthCheck' in service && typeof service.healthCheck === 'function') {
          const isHealthy = await service.healthCheck();
          health = {
            service: name,
            status: isHealthy ? 'healthy' : 'unhealthy',
            lastCheck: new Date(),
            responseTime: Date.now() - startTime
          };
        } else {
          // Basic check - service exists and is accessible
          health = {
            service: name,
            status: service ? 'healthy' : 'unhealthy',
            lastCheck: new Date(),
            responseTime: Date.now() - startTime
          };
        }
      } catch (error) {
        health = {
          service: name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }

      this.healthChecks.set(name, health);
    }
  }

  /**
   * Gracefully shutdown all services
   */
  async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    for (const [name, service] of this.services) {
      if (typeof service.close === 'function') {
        shutdownPromises.push(
          service.close().catch((error: Error) => {
          })
        );
      }
    }

    await Promise.all(shutdownPromises);
  }
}

// Export singleton instance
export const serviceManager = new ServiceManager();

// Utility functions
export const getServiceConfig = (): ServiceConfig => defaultServiceConfig;

export const isServiceEnabled = (serviceName: keyof ServiceConfig): boolean => {
  const config = getServiceConfig();
  return config[serviceName]?.enabled ?? false;
};

export const getServiceHealth = (serviceName: string): ServiceHealth | undefined => {
  return serviceManager.getServiceHealth(serviceName);
};

export const getAllServicesHealth = (): ServiceHealth[] => {
  return serviceManager.getAllServiceHealth();
};

export const areAllServicesHealthy = (): boolean => {
  return serviceManager.areAllServicesHealthy();
};

// Service initialization
export const initializeServices = async (): Promise<void> => {
  
  try {
    // Initialize services that need setup
    const initPromises: Promise<void>[] = [];

    // Add initialization promises for services that need it
    // Example: if (isServiceEnabled('email')) initPromises.push(EmailService.initialize());
    
    await Promise.all(initPromises);
  } catch (error) {
    throw error;
  }
};

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await serviceManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await serviceManager.shutdown();
  process.exit(0);
});