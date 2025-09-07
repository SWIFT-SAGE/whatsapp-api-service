import { Types } from 'mongoose';
import User from '../models/User';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import EmailService from './EmailService';
import axios from 'axios';

interface NotificationConfig {
  email: {
    enabled: boolean;
    templates: Record<string, boolean>;
  };
  sms: {
    enabled: boolean;
    provider: 'twilio' | 'aws-sns' | 'custom';
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;
  };
  push: {
    enabled: boolean;
    provider: 'firebase' | 'onesignal' | 'custom';
    apiKey?: string;
    appId?: string;
  };
  webhook: {
    enabled: boolean;
    url?: string;
    secret?: string;
  };
}

interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  expiresAt?: Date;
}

interface BulkNotificationData {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  batchSize?: number;
}

type NotificationType = 
  | 'welcome'
  | 'email_verification'
  | 'password_reset'
  | 'password_changed'
  | 'subscription_updated'
  | 'usage_alert'
  | 'webhook_failed'
  | 'session_disconnected'
  | 'session_connected'
  | 'message_failed'
  | 'api_limit_reached'
  | 'payment_failed'
  | 'payment_success'
  | 'monthly_report'
  | 'security_alert'
  | 'maintenance'
  | 'custom';

type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'in_app';

interface NotificationPreferences {
  userId: string;
  email: {
    enabled: boolean;
    types: Record<NotificationType, boolean>;
  };
  sms: {
    enabled: boolean;
    types: Record<NotificationType, boolean>;
  };
  push: {
    enabled: boolean;
    types: Record<NotificationType, boolean>;
  };
  webhook: {
    enabled: boolean;
    types: Record<NotificationType, boolean>;
  };
  inApp: {
    enabled: boolean;
    types: Record<NotificationType, boolean>;
  };
}

interface NotificationLog {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'failed' | 'expired';
  title: string;
  message: string;
  data?: Record<string, any>;
  sentAt?: Date;
  failedAt?: Date;
  error?: string;
  createdAt: Date;
}

class NotificationService {
  private config: NotificationConfig;
  private preferences: Map<string, NotificationPreferences> = new Map();
  private logs: NotificationLog[] = [];
  private queue: NotificationData[] = [];
  private processing = false;

  constructor() {
    this.config = {
      email: {
        enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
        templates: {
          welcome: true,
          email_verification: true,
          password_reset: true,
          password_changed: true,
          subscription_updated: true,
          usage_alert: true,
          webhook_failed: true,
          session_disconnected: true,
          monthly_report: true,
          security_alert: true
        }
      },
      sms: {
        enabled: process.env.SMS_NOTIFICATIONS_ENABLED === 'true',
        provider: (process.env.SMS_PROVIDER as any) || 'twilio',
        apiKey: process.env.SMS_API_KEY,
        apiSecret: process.env.SMS_API_SECRET,
        fromNumber: process.env.SMS_FROM_NUMBER
      },
      push: {
        enabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
        provider: (process.env.PUSH_PROVIDER as any) || 'firebase',
        apiKey: process.env.PUSH_API_KEY,
        appId: process.env.PUSH_APP_ID
      },
      webhook: {
        enabled: process.env.WEBHOOK_NOTIFICATIONS_ENABLED === 'true',
        url: process.env.WEBHOOK_NOTIFICATION_URL,
        secret: process.env.WEBHOOK_NOTIFICATION_SECRET
      }
    };

    this.startQueueProcessor();
  }

  /**
   * Send notification to user
   */
  async sendNotification(notification: NotificationData): Promise<boolean> {
    try {
      const user = await User.findById(notification.userId);
      if (!user) {
        throw new AppError('User not found');
      }

      const preferences = await this.getUserPreferences(notification.userId);
      const channels = notification.channels || this.getDefaultChannels(notification.type);
      
      let success = false;
      const results: Record<NotificationChannel, boolean> = {} as any;

      // Send through each enabled channel
      for (const channel of channels) {
        if (this.shouldSendToChannel(channel, notification.type, preferences)) {
          try {
            const result = await this.sendToChannel(channel, notification, user);
            results[channel] = result;
            if (result) success = true;

            // Log the attempt
            this.logNotification({
              id: this.generateId(),
              userId: notification.userId,
              type: notification.type,
              channel,
              status: result ? 'sent' : 'failed',
              title: notification.title,
              message: notification.message,
              data: notification.data,
              sentAt: result ? new Date() : undefined,
              failedAt: result ? undefined : new Date(),
              createdAt: new Date()
            });
          } catch (error) {
            logger.error(`Failed to send ${channel} notification:`, error);
            results[channel] = false;
            
            this.logNotification({
              id: this.generateId(),
              userId: notification.userId,
              type: notification.type,
              channel,
              status: 'failed',
              title: notification.title,
              message: notification.message,
              data: notification.data,
              failedAt: new Date(),
              error: error instanceof Error ? error.message : 'Unknown error',
              createdAt: new Date()
            });
          }
        }
      }

      logger.info(`Notification sent to user ${notification.userId}:`, {
        type: notification.type,
        channels: results,
        success
      });

      return success;
    } catch (error) {
      logger.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(bulkData: BulkNotificationData): Promise<{ sent: number; failed: number }> {
    const batchSize = bulkData.batchSize || 50;
    let sent = 0;
    let failed = 0;

    try {
      // Process in batches
      for (let i = 0; i < bulkData.userIds.length; i += batchSize) {
        const batch = bulkData.userIds.slice(i, i + batchSize);
        const promises = batch.map(async (userId) => {
          const notification: NotificationData = {
            userId,
            type: bulkData.type,
            title: bulkData.title,
            message: bulkData.message,
            data: bulkData.data,
            channels: bulkData.channels,
            priority: bulkData.priority
          };

          const result = await this.sendNotification(notification);
          return result;
        });

        const results = await Promise.all(promises);
        sent += results.filter(r => r).length;
        failed += results.filter(r => !r).length;

        // Add delay between batches
        if (i + batchSize < bulkData.userIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Bulk notifications completed: ${sent} sent, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      logger.error('Bulk notifications failed:', error);
      return { sent, failed: bulkData.userIds.length };
    }
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(notification: NotificationData): Promise<string> {
    try {
      const id = this.generateId();
      const scheduledNotification = { ...notification, scheduledAt: notification.scheduledAt || new Date() };
      
      this.queue.push(scheduledNotification);
      
      logger.info(`Notification scheduled for ${notification.scheduledAt}:`, {
        id,
        type: notification.type,
        userId: notification.userId
      });

      return id;
    } catch (error) {
      logger.error('Error scheduling notification:', error);
      throw new AppError('Failed to schedule notification');
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      if (this.preferences.has(userId)) {
        return this.preferences.get(userId)!;
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found');
      }

      // Default preferences
      const defaultPreferences: NotificationPreferences = {
        userId,
        email: {
          enabled: true,
          types: {
            welcome: true,
            email_verification: true,
            password_reset: true,
            password_changed: true,
            subscription_updated: true,
            usage_alert: true,
            webhook_failed: true,
            session_disconnected: true,
            session_connected: false,
            message_failed: true,
            api_limit_reached: true,
            payment_failed: true,
            payment_success: true,
            monthly_report: true,
            security_alert: true,
            maintenance: true,
            custom: false
          }
        },
        sms: {
          enabled: false,
          types: {
            welcome: false,
            email_verification: false,
            password_reset: true,
            password_changed: true,
            subscription_updated: false,
            usage_alert: true,
            webhook_failed: false,
            session_disconnected: false,
            session_connected: false,
            message_failed: false,
            api_limit_reached: true,
            payment_failed: true,
            payment_success: false,
            monthly_report: false,
            security_alert: true,
            maintenance: true,
            custom: false
          }
        },
        push: {
          enabled: true,
          types: {
            welcome: true,
            email_verification: false,
            password_reset: false,
            password_changed: true,
            subscription_updated: true,
            usage_alert: true,
            webhook_failed: true,
            session_disconnected: true,
            session_connected: true,
            message_failed: true,
            api_limit_reached: true,
            payment_failed: true,
            payment_success: true,
            monthly_report: false,
            security_alert: true,
            maintenance: true,
            custom: true
          }
        },
        webhook: {
          enabled: false,
          types: {
            welcome: false,
            email_verification: false,
            password_reset: false,
            password_changed: false,
            subscription_updated: true,
            usage_alert: true,
            webhook_failed: true,
            session_disconnected: true,
            session_connected: true,
            message_failed: true,
            api_limit_reached: true,
            payment_failed: true,
            payment_success: true,
            monthly_report: true,
            security_alert: true,
            maintenance: true,
            custom: true
          }
        },
        inApp: {
          enabled: true,
          types: {
            welcome: true,
            email_verification: false,
            password_reset: false,
            password_changed: true,
            subscription_updated: true,
            usage_alert: true,
            webhook_failed: true,
            session_disconnected: true,
            session_connected: true,
            message_failed: true,
            api_limit_reached: true,
            payment_failed: true,
            payment_success: true,
            monthly_report: true,
            security_alert: true,
            maintenance: true,
            custom: true
          }
        }
      };

      // Use user's preferences if available, otherwise use defaults
      const preferences = (user as any).notificationPreferences || defaultPreferences;
      this.preferences.set(userId, preferences);
      
      return preferences;
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      throw new AppError('Failed to get notification preferences');
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      const updatedPreferences = { ...currentPreferences, ...preferences };
      
      // Update in database
      await User.findByIdAndUpdate(userId, {
        notificationPreferences: updatedPreferences
      });

      // Update cache
      this.preferences.set(userId, updatedPreferences);
      
      logger.info(`Notification preferences updated for user ${userId}`);
      return updatedPreferences;
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw new AppError('Failed to update notification preferences');
    }
  }

  /**
   * Get notification logs
   */
  getNotificationLogs(userId?: string, limit = 100): NotificationLog[] {
    let logs = this.logs;
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    
    return logs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(userId?: string): any {
    let logs = this.logs;
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    const total = logs.length;
    const sent = logs.filter(log => log.status === 'sent').length;
    const failed = logs.filter(log => log.status === 'failed').length;
    const pending = logs.filter(log => log.status === 'pending').length;

    const byChannel = logs.reduce((acc, log) => {
      acc[log.channel] = (acc[log.channel] || 0) + 1;
      return acc;
    }, {} as Record<NotificationChannel, number>);

    const byType = logs.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {} as Record<NotificationType, number>);

    return {
      total,
      sent,
      failed,
      pending,
      successRate: total > 0 ? (sent / total) * 100 : 0,
      byChannel,
      byType
    };
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(channel: NotificationChannel, notification: NotificationData, user: any): Promise<boolean> {
    switch (channel) {
      case 'email':
        return this.sendEmailNotification(notification, user);
      case 'sms':
        return this.sendSmsNotification(notification, user);
      case 'push':
        return this.sendPushNotification(notification, user);
      case 'webhook':
        return this.sendWebhookNotification(notification, user);
      case 'in_app':
        return this.sendInAppNotification(notification, user);
      default:
        return false;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: NotificationData, user: any): Promise<boolean> {
    if (!this.config.email.enabled) return false;

    try {
      // Use template if available
      if (this.config.email.templates[notification.type]) {
        switch (notification.type) {
          case 'welcome':
            return await EmailService.sendWelcomeEmail(user.email, user.name);
          case 'email_verification':
            return await EmailService.sendEmailVerification(user.email, user.name, notification.data?.token);
          case 'password_reset':
            return await EmailService.sendPasswordReset(user.email, user.name, notification.data?.token);
          case 'password_changed':
            return await EmailService.sendPasswordChanged(user.email, user.name);
          case 'subscription_updated':
            return await EmailService.sendSubscriptionUpdate(user.email, user.name, notification.data?.plan, notification.data?.limits);
          case 'usage_alert':
            return await EmailService.sendUsageAlert(user.email, user.name, notification.data?.type, notification.data?.current, notification.data?.limit);
          case 'webhook_failed':
            return await EmailService.sendWebhookFailure(user.email, user.name, notification.data?.webhookUrl, notification.data?.error);
          case 'session_disconnected':
            return await EmailService.sendSessionDisconnected(user.email, user.name, notification.data?.sessionName);
          case 'monthly_report':
            return await EmailService.sendMonthlyReport(user.email, user.name, notification.data);
          default:
            return await EmailService.sendCustomEmail(user.email, notification.title, notification.message);
        }
      } else {
        return await EmailService.sendCustomEmail(user.email, notification.title, notification.message);
      }
    } catch (error) {
      logger.error('Email notification failed:', error);
      return false;
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(notification: NotificationData, user: any): Promise<boolean> {
    if (!this.config.sms.enabled || !user.phone) return false;

    try {
      // Implementation depends on SMS provider
      switch (this.config.sms.provider) {
        case 'twilio':
          return await this.sendTwilioSms(user.phone, notification.message);
        case 'aws-sns':
          return await this.sendAwsSns(user.phone, notification.message);
        default:
          logger.warn('SMS provider not implemented');
          return false;
      }
    } catch (error) {
      logger.error('SMS notification failed:', error);
      return false;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: NotificationData, user: any): Promise<boolean> {
    if (!this.config.push.enabled || !user.pushTokens?.length) return false;

    try {
      // Implementation depends on push provider
      switch (this.config.push.provider) {
        case 'firebase':
          return await this.sendFirebasePush(user.pushTokens, notification.title, notification.message, notification.data);
        case 'onesignal':
          return await this.sendOneSignalPush(user.pushTokens, notification.title, notification.message, notification.data);
        default:
          logger.warn('Push provider not implemented');
          return false;
      }
    } catch (error) {
      logger.error('Push notification failed:', error);
      return false;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: NotificationData, user: any): Promise<boolean> {
    if (!this.config.webhook.enabled || !this.config.webhook.url) return false;

    try {
      const payload = {
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(this.config.webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': this.config.webhook.secret
        },
        timeout: 10000
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error('Webhook notification failed:', error);
      return false;
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(notification: NotificationData, user: any): Promise<boolean> {
    try {
      // Store in-app notification (would typically be in database)
      // For now, just log it
      logger.info(`In-app notification for user ${notification.userId}:`, {
        title: notification.title,
        message: notification.message,
        data: notification.data
      });
      
      return true;
    } catch (error) {
      logger.error('In-app notification failed:', error);
      return false;
    }
  }

  /**
   * Send Twilio SMS
   */
  private async sendTwilioSms(phone: string, message: string): Promise<boolean> {
    try {
      // Twilio implementation would go here
      logger.info(`Twilio SMS sent to ${phone}: ${message}`);
      return true;
    } catch (error) {
      logger.error('Twilio SMS failed:', error);
      return false;
    }
  }

  /**
   * Send AWS SNS SMS
   */
  private async sendAwsSns(phone: string, message: string): Promise<boolean> {
    try {
      // AWS SNS implementation would go here
      logger.info(`AWS SNS SMS sent to ${phone}: ${message}`);
      return true;
    } catch (error) {
      logger.error('AWS SNS SMS failed:', error);
      return false;
    }
  }

  /**
   * Send Firebase push notification
   */
  private async sendFirebasePush(tokens: string[], title: string, message: string, data?: any): Promise<boolean> {
    try {
      // Firebase implementation would go here
      logger.info(`Firebase push sent to ${tokens.length} devices: ${title}`);
      return true;
    } catch (error) {
      logger.error('Firebase push failed:', error);
      return false;
    }
  }

  /**
   * Send OneSignal push notification
   */
  private async sendOneSignalPush(tokens: string[], title: string, message: string, data?: any): Promise<boolean> {
    try {
      // OneSignal implementation would go here
      logger.info(`OneSignal push sent to ${tokens.length} devices: ${title}`);
      return true;
    } catch (error) {
      logger.error('OneSignal push failed:', error);
      return false;
    }
  }

  /**
   * Check if should send to channel
   */
  private shouldSendToChannel(channel: NotificationChannel, type: NotificationType, preferences: NotificationPreferences): boolean {
    switch (channel) {
      case 'email':
        return preferences.email.enabled && preferences.email.types[type];
      case 'sms':
        return preferences.sms.enabled && preferences.sms.types[type];
      case 'push':
        return preferences.push.enabled && preferences.push.types[type];
      case 'webhook':
        return preferences.webhook.enabled && preferences.webhook.types[type];
      case 'in_app':
        return preferences.inApp.enabled && preferences.inApp.types[type];
      default:
        return false;
    }
  }

  /**
   * Get default channels for notification type
   */
  private getDefaultChannels(type: NotificationType): NotificationChannel[] {
    const channelMap: Record<NotificationType, NotificationChannel[]> = {
      welcome: ['email', 'in_app'],
      email_verification: ['email'],
      password_reset: ['email', 'sms'],
      password_changed: ['email', 'sms', 'push'],
      subscription_updated: ['email', 'push', 'in_app'],
      usage_alert: ['email', 'push', 'in_app'],
      webhook_failed: ['email', 'push'],
      session_disconnected: ['email', 'push', 'in_app'],
      session_connected: ['push', 'in_app'],
      message_failed: ['push', 'in_app'],
      api_limit_reached: ['email', 'push', 'in_app'],
      payment_failed: ['email', 'sms', 'push'],
      payment_success: ['email', 'push'],
      monthly_report: ['email'],
      security_alert: ['email', 'sms', 'push'],
      maintenance: ['email', 'push', 'in_app'],
      custom: ['email', 'push', 'in_app']
    };

    return channelMap[type] || ['email', 'in_app'];
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;
      
      this.processing = true;
      
      try {
        const now = new Date();
        const dueNotifications = this.queue.filter(n => 
          n.scheduledAt && n.scheduledAt <= now
        );

        for (const notification of dueNotifications) {
          await this.sendNotification(notification);
          this.queue = this.queue.filter(n => n !== notification);
        }

        // Remove expired notifications
        this.queue = this.queue.filter(n => 
          !n.expiresAt || n.expiresAt > now
        );
      } catch (error) {
        logger.error('Queue processor error:', error);
      } finally {
        this.processing = false;
      }
    }, 60000); // Process every minute
  }

  /**
   * Log notification
   */
  private logNotification(log: NotificationLog): void {
    this.logs.push(log);
    
    // Keep only last 10000 logs
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-10000);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

export default new NotificationService();
export { NotificationService, NotificationData, BulkNotificationData, NotificationType, NotificationChannel, NotificationPreferences };