import { Types } from 'mongoose';
import Webhook, { IWebhook, IWebhookLog } from '../models/Webhook';
import User from '../models/User';
import WhatsappSession from '../models/WhatsappSession';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { URL } from 'url';

interface CreateWebhookData {
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  sessionId?: string;
}

interface UpdateWebhookData {
  url?: string;
  events?: string[];
  secret?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  isActive?: boolean;
}

interface WebhookDelivery {
  webhookId: string;
  event: string;
  payload: any;
  attempt: number;
  maxRetries: number;
}

interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  averageResponseTime: number;
  lastDelivery?: Date;
}

class WebhookService {
  private deliveryQueue: WebhookDelivery[] = [];
  private isProcessingQueue = false;
  private readonly SUPPORTED_EVENTS = [
    'message.received',
    'message.sent',
    'message.delivered',
    'message.read',
    'session.connected',
    'session.disconnected',
    'session.qr',
    'contact.added',
    'group.joined',
    'group.left'
  ];

  constructor() {
    // Start processing webhook delivery queue
    this.startQueueProcessor();
  }

  /**
   * Create a new webhook
   */
  async createWebhook(userId: string, webhookData: CreateWebhookData): Promise<IWebhook> {
    try {
      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Validate webhook URL
      if (!this.isValidUrl(webhookData.url)) {
        throw new ValidationError('Invalid webhook URL');
      }

      // Validate events
      const invalidEvents = webhookData.events.filter(event => !this.SUPPORTED_EVENTS.includes(event));
      if (invalidEvents.length > 0) {
        throw new ValidationError(`Unsupported events: ${invalidEvents.join(', ')}`);
      }

      // Verify session ownership if sessionId provided
      let sessionObjectId;
      if (webhookData.sessionId) {
        const session = await WhatsappSession.findOne({ sessionId: webhookData.sessionId, userId });
        if (!session) {
          throw new NotFoundError('Session not found');
        }
        sessionObjectId = session._id;
      }

      // Check webhook limits based on subscription
      await this.checkWebhookLimits(userId);

      // Generate secret if not provided
      const secret = webhookData.secret || this.generateWebhookSecret();

      // Create webhook
      const webhook = new Webhook({
        userId,
        sessionId: sessionObjectId,
        url: webhookData.url,
        secret,
        events: webhookData.events,
        headers: webhookData.headers || {},
        timeout: webhookData.timeout || 5000,
        retryPolicy: webhookData.retryPolicy || {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      });

      await webhook.save();

      // Test webhook delivery
      await this.testWebhookDelivery(webhook);

      logger.info(`Webhook created: ${webhook._id} for user: ${userId}`);
      return webhook;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating webhook:', error);
      throw new AppError('Failed to create webhook');
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string, userId: string): Promise<IWebhook> {
    try {
      const webhook = await Webhook.findOne({ _id: webhookId, userId });
      if (!webhook) {
        throw new NotFoundError('Webhook not found');
      }
      return webhook;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting webhook:', error);
      throw new AppError('Failed to retrieve webhook');
    }
  }

  /**
   * Get all webhooks for a user
   */
  async getUserWebhooks(userId: string, sessionId?: string): Promise<IWebhook[]> {
    try {
      const query: any = { userId };
      
      if (sessionId) {
        const session = await WhatsappSession.findOne({ sessionId, userId });
        if (session) {
          query.sessionId = session._id;
        }
      }

      return await Webhook.find(query).sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Error getting user webhooks:', error);
      throw new AppError('Failed to retrieve webhooks');
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(webhookId: string, userId: string, updateData: UpdateWebhookData): Promise<IWebhook> {
    try {
      const webhook = await this.getWebhook(webhookId, userId);

      // Validate URL if being updated
      if (updateData.url && !this.isValidUrl(updateData.url)) {
        throw new ValidationError('Invalid webhook URL');
      }

      // Validate events if being updated
      if (updateData.events) {
        const invalidEvents = updateData.events.filter(event => !this.SUPPORTED_EVENTS.includes(event));
        if (invalidEvents.length > 0) {
          throw new ValidationError(`Unsupported events: ${invalidEvents.join(', ')}`);
        }
      }

      // Update webhook
      Object.assign(webhook, updateData);
      await webhook.save();

      // Test webhook if URL or events changed
      if (updateData.url || updateData.events) {
        await this.testWebhookDelivery(webhook);
      }

      logger.info(`Webhook updated: ${webhookId}`);
      return webhook;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating webhook:', error);
      throw new AppError('Failed to update webhook');
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, userId: string): Promise<void> {
    try {
      const webhook = await this.getWebhook(webhookId, userId);
      await Webhook.findByIdAndDelete(webhook._id);

      logger.info(`Webhook deleted: ${webhookId}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting webhook:', error);
      throw new AppError('Failed to delete webhook');
    }
  }

  /**
   * Test webhook delivery
   */
  async testWebhookDelivery(webhook: IWebhook): Promise<{ success: boolean; responseTime: number; error?: string }> {
    try {
      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        sessionId: webhook.sessionId?.toString(),
        data: {
          message: 'This is a test webhook delivery'
        }
      };

      const startTime = Date.now();
      const result = await this.deliverWebhook(webhook, testPayload);
      const responseTime = Date.now() - startTime;

      return {
        success: result.success,
        responseTime,
        error: result.error
      };
    } catch (error) {
      logger.error('Error testing webhook delivery:', error);
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trigger webhook for event
   */
  async triggerWebhook(event: string, data: any, userId?: string, sessionId?: Types.ObjectId): Promise<void> {
    try {
      const query: any = { isActive: true, events: event };
      if (userId) query.userId = userId;
      if (sessionId) query.sessionId = sessionId;
      const webhooks = await Webhook.find(query);
      
      for (const webhook of webhooks) {
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          sessionId: sessionId?.toString(),
          data
        };

        // Add to delivery queue
        this.addToDeliveryQueue({
          webhookId: webhook._id.toString(),
          event,
          payload,
          attempt: 1,
          maxRetries: webhook.retryPolicy.maxRetries
        });
      }
    } catch (error) {
      logger.error('Error triggering webhooks:', error);
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string, userId: string, days = 30): Promise<WebhookStats> {
    try {
      const webhook = await this.getWebhook(webhookId, userId);
      
      const stats: WebhookStats = {
        totalDeliveries: webhook.successCount + webhook.failureCount,
        successfulDeliveries: webhook.successCount,
        failedDeliveries: webhook.failureCount,
        successRate: webhook.successCount + webhook.failureCount > 0 
          ? (webhook.successCount / (webhook.successCount + webhook.failureCount)) * 100 
          : 0,
        averageResponseTime: 0, // Would need to track response times
        lastDelivery: webhook.lastTriggeredAt
      };

      return stats;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting webhook stats:', error);
      throw new AppError('Failed to get webhook statistics');
    }
  }

  /**
   * Get webhook delivery logs
   */
  async getWebhookLogs(webhookId: string, userId: string, limit = 50): Promise<any[]> {
    try {
      const webhook = await this.getWebhook(webhookId, userId);
      
      // Return recent error logs (in a real implementation, you'd store delivery logs)
      return (webhook.logs || []).slice(-limit).reverse();
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting webhook logs:', error);
      throw new AppError('Failed to get webhook logs');
    }
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId: string, userId: string): Promise<{ secret: string }> {
    try {
      const webhook = await this.getWebhook(webhookId, userId);
      
      const newSecret = this.generateWebhookSecret();
      webhook.secret = newSecret;
      await webhook.save();

      logger.info(`Webhook secret regenerated: ${webhookId}`);
      return { secret: newSecret };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error regenerating webhook secret:', error);
      throw new AppError('Failed to regenerate webhook secret');
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      logger.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Add webhook delivery to queue
   */
  private addToDeliveryQueue(delivery: WebhookDelivery): void {
    this.deliveryQueue.push(delivery);
  }

  /**
   * Start processing webhook delivery queue
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.isProcessingQueue && this.deliveryQueue.length > 0) {
        this.isProcessingQueue = true;
        await this.processDeliveryQueue();
        this.isProcessingQueue = false;
      }
    }, 1000); // Process every second
  }

  /**
   * Process webhook delivery queue
   */
  private async processDeliveryQueue(): Promise<void> {
    while (this.deliveryQueue.length > 0) {
      const delivery = this.deliveryQueue.shift()!;
      
      try {
        const webhook = await Webhook.findById(delivery.webhookId);
        if (!webhook || !webhook.isActive) {
          continue;
        }

        const result = await this.deliverWebhook(webhook, delivery.payload);
        
        if (!result.success && delivery.attempt < delivery.maxRetries) {
          // Retry with exponential backoff
          const delay = webhook.retryPolicy.retryDelay * Math.pow(webhook.retryPolicy.backoffMultiplier, delivery.attempt - 1);
          
          setTimeout(() => {
            this.addToDeliveryQueue({
              ...delivery,
              attempt: delivery.attempt + 1
            });
          }, delay);
        }
      } catch (error) {
        logger.error('Error processing webhook delivery:', error);
      }
    }
  }

  /**
   * Deliver webhook payload
   */
  private async deliverWebhook(webhook: IWebhook, payload: any): Promise<{ success: boolean; error?: string }> {
    try {
      const signature = crypto.createHmac('sha256', webhook.secret || '').update(JSON.stringify(payload)).digest('hex');
      
      const response: AxiosResponse = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'WhatsApp-API-Service/1.0',
          ...(webhook.headers ? Object.fromEntries(webhook.headers) : {})
        },
        timeout: webhook.timeout,
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Update success metrics
      await webhook.incrementSuccess();
      
      logger.debug(`Webhook delivered successfully: ${webhook.url}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update failure metrics
      await webhook.incrementFailure(errorMessage);
      
      logger.error(`Webhook delivery failed: ${webhook.url} - ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check webhook limits based on subscription
   */
  private async checkWebhookLimits(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    const existingWebhooks = await Webhook.countDocuments({ userId });
    let maxWebhooks: number;

    switch (user.subscription.plan) {
      case 'free':
        maxWebhooks = 1;
        break;
      case 'basic':
        maxWebhooks = 5;
        break;
      case 'premium':
        maxWebhooks = 50;
        break;
      default:
        maxWebhooks = 1;
    }

    if (existingWebhooks >= maxWebhooks) {
      throw new ValidationError(`Maximum webhooks limit (${maxWebhooks}) reached for ${user.subscription.plan} plan`);
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get supported events
   */
  getSupportedEvents(): string[] {
    return [...this.SUPPORTED_EVENTS];
  }

  /**
   * Cleanup old webhook logs (maintenance task)
   */
  async cleanupOldLogs(olderThanDays = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const webhooks = await Webhook.find({});
      let cleanedCount = 0;

      for (const webhook of webhooks) {
        const originalLogCount = Array.isArray(webhook.logs) ? webhook.logs.length : 0;
         if (webhook && webhook.logs) {
           const filteredErrors = Array.isArray(webhook.logs) ? webhook.logs.filter((log: IWebhookLog) => new Date(log.timestamp) > cutoffDate) : [];
           webhook.logs = filteredErrors as IWebhookLog[];
         } else if (webhook) {
           webhook.logs = [] as IWebhookLog[];
         }
         
         if (Array.isArray(webhook.logs) && webhook.logs.length < originalLogCount) {
           await webhook.save();
           cleanedCount += originalLogCount - webhook.logs.length;
         }
      }

      logger.info(`Cleaned up ${cleanedCount} old webhook logs`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up webhook logs:', error);
      return 0;
    }
  }

  /**
   * Disable failed webhooks (maintenance task)
   */
  async disableFailedWebhooks(failureThreshold = 10, failureRate = 0.9): Promise<number> {
    try {
      const webhooks = await Webhook.find({ isActive: true });
      let disabledCount = 0;

      for (const webhook of webhooks) {
        const totalAttempts = webhook.successCount + webhook.failureCount;
        
        if (totalAttempts >= failureThreshold) {
          const currentFailureRate = webhook.failureCount / totalAttempts;
          
          if (currentFailureRate >= failureRate) {
            webhook.isActive = false;
            await webhook.save();
            disabledCount++;
            
            logger.warn(`Disabled webhook due to high failure rate: ${webhook.url}`);
          }
        }
      }

      logger.info(`Disabled ${disabledCount} failed webhooks`);
      return disabledCount;
    } catch (error) {
      logger.error('Error disabling failed webhooks:', error);
      return 0;
    }
  }
}

export default new WebhookService();