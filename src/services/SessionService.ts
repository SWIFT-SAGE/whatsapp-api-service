import { Types } from 'mongoose';
import WhatsappSession, { IWhatsappSession } from '../models/WhatsappSession';
import User from '../models/User';
import MessageLog from '../models/MessageLog';
import whatsappService from './whatsappService';
import { AppError, ValidationError, NotFoundError, AuthenticationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface CreateSessionData {
  name: string;
  description?: string;
  settings?: {
    autoReply?: boolean;
    autoReplyMessage?: string;
    webhookUrl?: string;
    allowedContacts?: string[];
    blockedContacts?: string[];
    businessHours?: {
      enabled: boolean;
      timezone: string;
      schedule: Array<{
        day: string;
        startTime: string;
        endTime: string;
        isActive: boolean;
      }>;
    };
  };
}

export interface UpdateSessionData {
  name?: string;
  description?: string;
  settings?: Partial<IWhatsappSession['settings']>;
}

export interface SessionStats {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  lastActivity?: Date;
  uptime: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

class SessionService {
  /**
   * Create a new WhatsApp session
   */
  async createSession(userId: string, sessionData: CreateSessionData): Promise<IWhatsappSession> {
    try {
      // Verify user exists and has permission
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (!user.active) {
        throw new AuthenticationError('Account is not active');
      }

      // Check subscription limits
      const existingSessions = await WhatsappSession.countDocuments({ userId });
      const maxSessions = this.getMaxSessionsForPlan(user.subscription.plan);
      
      if (existingSessions >= maxSessions) {
        throw new ValidationError(`Maximum sessions limit (${maxSessions}) reached for ${user.subscription.plan} plan`);
      }

      // Generate unique session ID
      const sessionId = this.generateSessionId();

      // Create session document
      const session = new WhatsappSession({
        userId,
        sessionId,
        name: sessionData.name,
        description: sessionData.description,
        settings: {
          autoReply: sessionData.settings?.autoReply || false,
          autoReplyMessage: sessionData.settings?.autoReplyMessage || '',
          webhookUrl: sessionData.settings?.webhookUrl || '',
          allowedContacts: sessionData.settings?.allowedContacts || [],
          blockedContacts: sessionData.settings?.blockedContacts || [],
          businessHours: sessionData.settings?.businessHours || {
            enabled: false,
            timezone: 'UTC',
            schedule: []
          }
        }
      });

      await session.save();

      // Initialize WhatsApp client
      const clientResult = await whatsappService.createClient(sessionId, userId);
      if (!clientResult.success) {
        // Rollback session creation if client initialization fails
        await WhatsappSession.findByIdAndDelete(session._id);
        throw new AppError(`Failed to initialize WhatsApp client: ${clientResult.message}`);
      }

      logger.info(`New WhatsApp session created: ${sessionId} for user: ${userId}`);
      return session;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating session:', error);
      throw new AppError('Failed to create WhatsApp session');
    }
  }

  /**
   * Get session by ID with user verification
   */
  async getSession(sessionId: string, userId: string): Promise<IWhatsappSession> {
    try {
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        throw new NotFoundError('Session not found');
      }
      return session;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting session:', error);
      throw new AppError('Failed to retrieve session');
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, page = 1, limit = 10): Promise<{ sessions: IWhatsappSession[]; total: number; pages: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const [sessions, total] = await Promise.all([
        WhatsappSession.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        WhatsappSession.countDocuments({ userId })
      ]);

      const pages = Math.ceil(total / limit);

      return { sessions, total, pages };
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      throw new AppError('Failed to retrieve user sessions');
    }
  }

  /**
   * Update session settings
   */
  async updateSession(sessionId: string, userId: string, updateData: UpdateSessionData): Promise<IWhatsappSession> {
    try {
      const session = await WhatsappSession.findOneAndUpdate(
        { sessionId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!session) {
        throw new NotFoundError('Session not found');
      }

      logger.info(`Session updated: ${sessionId}`);
      return session;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating session:', error);
      throw new AppError('Failed to update session');
    }
  }

  /**
   * Delete session and cleanup
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        throw new NotFoundError('Session not found');
      }

      // Destroy WhatsApp client
      await whatsappService.destroySession(sessionId);

      // Delete session from database
      await WhatsappSession.findByIdAndDelete(session._id);

      // Optionally delete associated message logs (based on retention policy)
      // await MessageLog.deleteMany({ sessionId: session._id });

      logger.info(`Session deleted: ${sessionId}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting session:', error);
      throw new AppError('Failed to delete session');
    }
  }

  /**
   * Get session status and connection info
   */
  async getSessionStatus(sessionId: string, userId: string): Promise<{ session: IWhatsappSession; status: any }> {
    try {
      const session = await this.getSession(sessionId, userId);
      const status = await whatsappService.getSessionStatus(sessionId);

      return { session, status };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting session status:', error);
      throw new AppError('Failed to get session status');
    }
  }

  /**
   * Get session QR code for connection
   */
  async getSessionQR(sessionId: string, userId: string): Promise<{ qrCode?: string; isConnected: boolean }> {
    try {
      const session = await this.getSession(sessionId, userId);
      
      return {
        qrCode: session.qrCode,
        isConnected: session.isConnected
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting session QR:', error);
      throw new AppError('Failed to get session QR code');
    }
  }

  /**
   * Restart session connection
   */
  async restartSession(sessionId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = await this.getSession(sessionId, userId);

      // Destroy existing client
      await whatsappService.destroySession(sessionId);

      // Create new client
      const result = await whatsappService.createClient(sessionId, userId);
      
      if (result.success) {
        // Update session status
        await WhatsappSession.findByIdAndUpdate(session._id, {
          isConnected: false,
          qrCode: undefined
        });
      }

      logger.info(`Session restarted: ${sessionId}`);
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error restarting session:', error);
      throw new AppError('Failed to restart session');
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: string, userId: string, days = 30): Promise<SessionStats> {
    try {
      const session = await this.getSession(sessionId, userId);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get message statistics
      const [totalMessages, sentMessages, receivedMessages, lastMessage] = await Promise.all([
        MessageLog.countDocuments({ sessionId: session._id, createdAt: { $gte: startDate } }),
        MessageLog.countDocuments({ sessionId: session._id, direction: 'outbound', createdAt: { $gte: startDate } }),
        MessageLog.countDocuments({ sessionId: session._id, direction: 'inbound', createdAt: { $gte: startDate } }),
        MessageLog.findOne({ sessionId: session._id }).sort({ createdAt: -1 })
      ]);

      // Calculate uptime (simplified)
      const uptime = session.isConnected ? Date.now() - session.createdAt.getTime() : 0;

      // Get connection status
      const status = await whatsappService.getSessionStatus(sessionId);
      const connectionStatus = status.connected ? 'connected' : 
                              session.qrCode ? 'connecting' : 'disconnected';

      return {
        totalMessages,
        sentMessages,
        receivedMessages,
        lastActivity: lastMessage?.createdAt,
        uptime,
        connectionStatus
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting session stats:', error);
      throw new AppError('Failed to get session statistics');
    }
  }

  /**
   * Update session connection status
   */
  async updateConnectionStatus(sessionId: string, isConnected: boolean, phoneNumber?: string): Promise<void> {
    try {
      const updateData: any = { isConnected };
      
      if (isConnected && phoneNumber) {
        updateData.phoneNumber = phoneNumber;
        updateData.qrCode = undefined;
      }

      await WhatsappSession.findOneAndUpdate(
        { sessionId },
        { $set: updateData }
      );

      logger.info(`Session connection status updated: ${sessionId} - ${isConnected ? 'connected' : 'disconnected'}`);
    } catch (error) {
      logger.error('Error updating connection status:', error);
    }
  }

  /**
   * Update session QR code
   */
  async updateQRCode(sessionId: string, qrCode: string): Promise<void> {
    try {
      await WhatsappSession.findOneAndUpdate(
        { sessionId },
        { $set: { qrCode, isConnected: false } }
      );

      logger.info(`QR code updated for session: ${sessionId}`);
    } catch (error) {
      logger.error('Error updating QR code:', error);
    }
  }

  /**
   * Get sessions by connection status
   */
  async getSessionsByStatus(userId: string, isConnected: boolean): Promise<IWhatsappSession[]> {
    try {
      return await WhatsappSession.find({ userId, isConnected });
    } catch (error) {
      logger.error('Error getting sessions by status:', error);
      throw new AppError('Failed to get sessions by status');
    }
  }

  /**
   * Bulk update session settings
   */
  async bulkUpdateSessions(userId: string, sessionIds: string[], updateData: Partial<UpdateSessionData>): Promise<number> {
    try {
      const result = await WhatsappSession.updateMany(
        { userId, sessionId: { $in: sessionIds } },
        { $set: updateData }
      );

      logger.info(`Bulk updated ${result.modifiedCount} sessions for user: ${userId}`);
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error bulk updating sessions:', error);
      throw new AppError('Failed to bulk update sessions');
    }
  }

  /**
   * Check if user can create more sessions
   */
  async canCreateSession(userId: string): Promise<{ canCreate: boolean; currentCount: number; maxAllowed: number }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const currentCount = await WhatsappSession.countDocuments({ userId });
      const maxAllowed = this.getMaxSessionsForPlan(user.subscription.plan);

      return {
        canCreate: currentCount < maxAllowed,
        currentCount,
        maxAllowed
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error checking session creation permission:', error);
      throw new AppError('Failed to check session creation permission');
    }
  }

  /**
   * Get active sessions count
   */
  async getActiveSessionsCount(): Promise<number> {
    try {
      return await WhatsappSession.countDocuments({ isConnected: true });
    } catch (error) {
      logger.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  /**
   * Cleanup disconnected sessions (maintenance task)
   */
  async cleanupDisconnectedSessions(olderThanDays = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find sessions that have been disconnected for too long
      const sessionsToCleanup = await WhatsappSession.find({
        isConnected: false,
        updatedAt: { $lt: cutoffDate }
      });

      let cleanedCount = 0;
      for (const session of sessionsToCleanup) {
        try {
          // Destroy any remaining client references
          await whatsappService.destroySession(session.sessionId);
          cleanedCount++;
        } catch (error) {
          logger.error(`Error cleaning up session ${session.sessionId}:`, error);
        }
      }

      logger.info(`Cleaned up ${cleanedCount} disconnected sessions`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error during session cleanup:', error);
      return 0;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get maximum sessions allowed for subscription plan
   */
  private getMaxSessionsForPlan(plan: string): number {
    switch (plan) {
      case 'free':
        return 1;
      case 'basic':
        return 5;
      case 'premium':
        return 50;
      default:
        return 1;
    }
  }
}

export default new SessionService();