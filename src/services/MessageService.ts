import { Types } from 'mongoose';
import { MessageMedia } from 'whatsapp-web.js';
import MessageLog, { IMessageLog } from '../models/MessageLog';
import WhatsappSession from '../models/WhatsappSession';
import User from '../models/User';
import Webhook from '../models/Webhook';
import whatsappService from './whatsappService';
import rateLimitService from './rateLimitService';
import { AppError, ValidationError, NotFoundError, AuthenticationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export interface SendMessageData {
  to: string;
  message: string;
  type?: 'text' | 'media';
  mediaUrl?: string;
  mediaCaption?: string;
  quotedMessageId?: string;
  scheduledAt?: Date;
}

export interface MessageFilter {
  direction?: 'inbound' | 'outbound';
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  startDate?: Date;
  endDate?: Date;
  isGroup?: boolean;
}

export interface MessageStats {
  total: number;
  sent: number;
  received: number;
  failed: number;
  pending: number;
  byType: Record<string, number>;
  byHour: Record<string, number>;
}

export interface BulkMessageData {
  contacts: string[];
  message: string;
  mediaUrl?: string;
  mediaCaption?: string;
  delayBetweenMessages?: number; // in milliseconds
}

class MessageService {
  /**
   * Send a text message
   */
  async sendMessage(sessionId: string, userId: string, messageData: SendMessageData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Verify session ownership
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      if (!session.isConnected) {
        throw new ValidationError('Session is not connected');
      }

      // Check rate limits
      const rateLimitResult = await rateLimitService.canSendMessage(userId);
      if (!rateLimitResult.allowed) {
        throw new ValidationError(`Rate limit exceeded. Reset time: ${rateLimitResult.resetTime}`);
      }

      // Validate recipient
      if (!this.isValidWhatsAppNumber(messageData.to)) {
        throw new ValidationError('Invalid WhatsApp number format');
      }

      // Check if contact is blocked
      if ((session.settings as any)?.blockedNumbers?.includes?.(messageData.to)) {
        throw new ValidationError('Cannot send message to blocked contact');
      }

      // Check business hours if enabled
      if (!this.isWithinBusinessHours((session.settings as any)?.businessHours)) {
        throw new ValidationError('Message sending is outside business hours');
      }

      let result;
      if (messageData.type === 'media' && messageData.mediaUrl) {
        // Send media message
        const media = await this.prepareMediaMessage(messageData.mediaUrl);
        result = await whatsappService.sendMedia(sessionId, messageData.to, media, messageData.mediaCaption);
      } else {
        // Send text message
        const options = messageData.quotedMessageId ? { quotedMessageId: messageData.quotedMessageId } : undefined;
        result = await whatsappService.sendMessage(sessionId, messageData.to, messageData.message, options);
      }

      if (result.success) {
        // Log the message
        await this.logOutboundMessage({
          userId,
          sessionId: session._id,
          messageId: result.messageId!,
          to: messageData.to,
          content: messageData.message,
          type: messageData.type || 'text',
          mediaUrl: messageData.mediaUrl,
          status: 'sent'
        });

        // Trigger webhooks
        await this.triggerWebhooks(userId, session._id, 'message.sent', {
          messageId: result.messageId,
          to: messageData.to,
          content: messageData.message,
          type: messageData.type || 'text'
        });

        logger.info(`Message sent successfully: ${result.messageId}`);
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error sending message:', error);
      throw new AppError('Failed to send message');
    }
  }

  /**
   * Send bulk messages
   */
  async sendBulkMessages(sessionId: string, userId: string, bulkData: BulkMessageData): Promise<{ success: number; failed: number; results: any[] }> {
    try {
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      if (!session.isConnected) {
        throw new ValidationError('Session is not connected');
      }

      // Check if user can send bulk messages
      const user = await User.findById(userId);
      if (!user || user.subscription.plan === 'free') {
        throw new ValidationError('Bulk messaging requires a paid subscription');
      }

      const results = [];
      let successCount = 0;
      let failedCount = 0;
      const delay = bulkData.delayBetweenMessages || 1000; // Default 1 second delay

      for (const contact of bulkData.contacts) {
        try {
          // Check rate limits for each message
          const rateLimitResult = await rateLimitService.canSendMessage(userId);
          if (!rateLimitResult.allowed) {
            results.push({ contact, success: false, error: 'Rate limit exceeded' });
            failedCount++;
            continue;
          }

          const messageData: SendMessageData = {
            to: contact,
            message: bulkData.message,
            type: bulkData.mediaUrl ? 'media' : 'text',
            mediaUrl: bulkData.mediaUrl,
            mediaCaption: bulkData.mediaCaption
          };

          const result = await this.sendMessage(sessionId, userId, messageData);
          
          if (result.success) {
            successCount++;
            results.push({ contact, success: true, messageId: result.messageId });
          } else {
            failedCount++;
            results.push({ contact, success: false, error: result.error });
          }

          // Add delay between messages to avoid spam detection
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          failedCount++;
          results.push({ contact, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      logger.info(`Bulk message completed: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount, results };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error sending bulk messages:', error);
      throw new AppError('Failed to send bulk messages');
    }
  }

  /**
   * Get messages with filtering and pagination
   */
  async getMessages(
    sessionId: string,
    userId: string,
    filter: MessageFilter = {},
    page = 1,
    limit = 50
  ): Promise<{ messages: IMessageLog[]; total: number; pages: number }> {
    try {
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      const query: any = { sessionId: session._id };

      // Apply filters
      if (filter.direction) query.direction = filter.direction;
      if (filter.type) query.type = filter.type;
      if (filter.status) query.status = filter.status;
      if (filter.from) query.from = new RegExp(filter.from, 'i');
      if (filter.to) query.to = new RegExp(filter.to, 'i');
      if (filter.isGroup !== undefined) query['metadata.isGroup'] = filter.isGroup;
      
      if (filter.startDate || filter.endDate) {
        query.createdAt = {};
        if (filter.startDate) query.createdAt.$gte = filter.startDate;
        if (filter.endDate) query.createdAt.$lte = filter.endDate;
      }

      const skip = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        MessageLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        MessageLog.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return { messages, total, pages };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting messages:', error);
      throw new AppError('Failed to retrieve messages');
    }
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string, userId: string): Promise<IMessageLog> {
    try {
      const message = await MessageLog.findOne({ messageId }).populate('sessionId');
      if (!message) {
        throw new NotFoundError('Message not found');
      }

      // Verify user owns the session
      const session = await WhatsappSession.findOne({ _id: message.sessionId, userId });
      if (!session) {
        throw new NotFoundError('Message not found');
      }

      return message;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting message by ID:', error);
      throw new AppError('Failed to retrieve message');
    }
  }

  /**
   * Update message status
   */
  async updateMessageStatus(messageId: string, status: string, userId: string): Promise<IMessageLog> {
    try {
      const message = await this.getMessageById(messageId, userId);
      
      message.status = status as 'sent' | 'pending' | 'delivered' | 'read' | 'failed';
      message.updatedAt = new Date();
      await message.save();

      logger.info(`Message status updated: ${messageId} -> ${status}`);
      return message;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating message status:', error);
      throw new AppError('Failed to update message status');
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStats(
    sessionId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<MessageStats> {
    try {
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      const matchQuery: any = { sessionId: session._id };
      
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = startDate;
        if (endDate) matchQuery.createdAt.$lte = endDate;
      }

      const stats = await MessageLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0]
              }
            },
            received: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0]
              }
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
              }
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
              }
            }
          }
        }
      ]);

      // Get message types distribution
      const typeStats = await MessageLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get hourly distribution
      const hourlyStats = await MessageLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 }
          }
        }
      ]);

      const result = stats[0] || { total: 0, sent: 0, received: 0, failed: 0, pending: 0 };
      
      const byType: Record<string, number> = {};
      typeStats.forEach(stat => {
        byType[stat._id] = stat.count;
      });

      const byHour: Record<string, number> = {};
      hourlyStats.forEach(stat => {
        byHour[stat._id.toString()] = stat.count;
      });

      return {
        ...result,
        byType,
        byHour
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting message stats:', error);
      throw new AppError('Failed to get message statistics');
    }
  }

  /**
   * Search messages by content
   */
  async searchMessages(
    sessionId: string,
    userId: string,
    searchTerm: string,
    page = 1,
    limit = 20
  ): Promise<{ messages: IMessageLog[]; total: number; pages: number }> {
    try {
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      const query = {
        sessionId: session._id,
        content: new RegExp(searchTerm, 'i')
      };

      const skip = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        MessageLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        MessageLog.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return { messages, total, pages };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error searching messages:', error);
      throw new AppError('Failed to search messages');
    }
  }

  /**
   * Delete messages (soft delete)
   */
  async deleteMessages(messageIds: string[], userId: string): Promise<number> {
    try {
      // Verify user owns all messages
      const messages = await MessageLog.find({ messageId: { $in: messageIds } }).populate('sessionId');
      
      for (const message of messages) {
        const session = await WhatsappSession.findOne({ _id: message.sessionId, userId });
        if (!session) {
          throw new ValidationError('Cannot delete messages from sessions you do not own');
        }
      }

      // Soft delete (mark as deleted)
      const result = await MessageLog.updateMany(
        { messageId: { $in: messageIds } },
        { 
          $set: { 
            isDeleted: true,
            deletedAt: new Date()
          }
        }
      );

      logger.info(`Deleted ${result.modifiedCount} messages`);
      return result.modifiedCount;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting messages:', error);
      throw new AppError('Failed to delete messages');
    }
  }

  /**
   * Export messages to CSV
   */
  async exportMessages(
    sessionId: string,
    userId: string,
    filter: MessageFilter = {},
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    try {
      const { messages } = await this.getMessages(sessionId, userId, filter, 1, 10000); // Large limit for export

      if (format === 'json') {
        return JSON.stringify(messages, null, 2);
      }

      // CSV format
      const headers = ['Date', 'Direction', 'From', 'To', 'Type', 'Content', 'Status'];
      const csvRows = [headers.join(',')];

      messages.forEach(message => {
        const row = [
          message.createdAt.toISOString(),
          message.direction,
          message.from,
          message.to,
          message.type,
          `"${message.content?.replace(/"/g, '""') || ''}"`, // Escape quotes if content exists, otherwise empty string
          message.status
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error exporting messages:', error);
      throw new AppError('Failed to export messages');
    }
  }

  /**
   * Log outbound message
   */
  private async logOutboundMessage(data: {
    userId: string;
    sessionId: Types.ObjectId;
    messageId: string;
    to: string;
    content: string;
    type: string;
    mediaUrl?: string;
    status: string;
  }): Promise<void> {
    try {
      const messageLog = new MessageLog({
        userId: data.userId,
        sessionId: data.sessionId,
        messageId: data.messageId,
        direction: 'outbound',
        type: data.type,
        from: '', // Will be filled by WhatsApp service
        to: data.to,
        content: data.content,
        status: data.status,
        metadata: {
          isGroup: data.to.includes('@g.us'),
          mediaUrl: data.mediaUrl
        }
      });

      await messageLog.save();
    } catch (error) {
      logger.error('Error logging outbound message:', error);
    }
  }

  /**
   * Trigger webhooks for message events
   */
  private async triggerWebhooks(userId: string, sessionId: Types.ObjectId, event: string, data: any): Promise<void> {
    try {
      const webhooks = await Webhook.find({
        userId,
        sessionId,
        event,
        isActive: true
      });
      
      for (const webhook of webhooks) {
        try {
          const payload = {
            event,
            timestamp: new Date().toISOString(),
            sessionId: sessionId.toString(),
            data
          };

          const signature = this.generateWebhookSignature(JSON.stringify(payload), webhook.secret || '');

          await axios.post(webhook.url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              ...Object.fromEntries(webhook.headers || new Map())
            },
            timeout: webhook.timeout || 5000
          });

          await webhook.incrementSuccess();
        } catch (error) {
          await webhook.incrementFailure(error instanceof Error ? error.message : 'Unknown error');
          logger.error(`Webhook delivery failed for ${webhook.url}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error triggering webhooks:', error);
    }
  }

  /**
   * Generate webhook signature
   */
  private generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Prepare media message from URL
   */
  private async prepareMediaMessage(mediaUrl: string): Promise<MessageMedia> {
    try {
      const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      const mimeType = response.headers['content-type'] || 'application/octet-stream';
      const filename = path.basename(mediaUrl) || 'media';

      return new MessageMedia(mimeType, buffer.toString('base64'), filename);
    } catch (error) {
      logger.error('Error preparing media message:', error);
      throw new ValidationError('Failed to process media URL');
    }
  }

  /**
   * Validate WhatsApp number format
   */
  private isValidWhatsAppNumber(number: string): boolean {
    // Basic validation for WhatsApp number format
    const phoneRegex = /^\d{10,15}@c\.us$|^\d{10,15}-\d{10}@g\.us$/;
    return phoneRegex.test(number);
  }

  /**
   * Check if current time is within business hours
   */
  private isWithinBusinessHours(businessHours: any): boolean {
    if (!businessHours.enabled) return true;

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    const todaySchedule = businessHours.schedule.find(
      (schedule: any) => schedule.day.toLowerCase() === currentDay && schedule.isActive
    );

    if (!todaySchedule) return false;

    return currentTime >= todaySchedule.startTime && currentTime <= todaySchedule.endTime;
  }
}

export default new MessageService();