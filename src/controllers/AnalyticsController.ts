import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import MessageLog from '../models/MessageLog';
import WhatsappSession from '../models/WhatsappSession';
import User, { IUser } from '../models/User';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/common';

export class AnalyticsController {
  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;
      const { period = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get basic counts
      const [totalSessions, activeSessions, totalMessages, sentMessages, receivedMessages] = await Promise.all([
        WhatsappSession.countDocuments({ userId }),
        WhatsappSession.countDocuments({ userId, isConnected: true }),
        MessageLog.countDocuments({ userId, createdAt: { $gte: startDate } }),
        MessageLog.countDocuments({ userId, direction: 'outbound', createdAt: { $gte: startDate } }),
        MessageLog.countDocuments({ userId, direction: 'inbound', createdAt: { $gte: startDate } })
      ]);

      // Get message status breakdown
      const messageStatusStats = await MessageLog.aggregate([
        {
          $match: {
            userId,
            direction: 'outbound',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get message type breakdown
      const messageTypeStats = await MessageLog.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get user subscription info
      const user = await User.findById(userId).select('subscription');

      const stats = {
        overview: {
          totalSessions,
          activeSessions,
          totalMessages,
          sentMessages,
          receivedMessages,
          messageLimit: user?.subscription.messageLimit || 0,
          messageCount: user?.subscription.messageCount || 0,
          plan: user?.subscription.plan || 'free'
        },
        messageStatus: messageStatusStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        messageTypes: messageTypeStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        period
      };

      res.json({
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: stats
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard statistics'
      } as ApiResponse);
    }
  }

  /**
   * Get message analytics with time series data
   */
  async getMessageAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;
      const { period = '7d', groupBy = 'day' } = req.query;

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      let dateFormat: string;
      
      switch (period) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          dateFormat = groupBy === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFormat = '%Y-%m-%d';
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFormat = '%Y-%m-%d';
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFormat = '%Y-%m-%d';
      }

      // Get time series data
      const timeSeriesData = await MessageLog.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
              direction: '$direction'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            sent: {
              $sum: {
                $cond: [{ $eq: ['$_id.direction', 'outbound'] }, '$count', 0]
              }
            },
            received: {
              $sum: {
                $cond: [{ $eq: ['$_id.direction', 'inbound'] }, '$count', 0]
              }
            }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      res.json({
        success: true,
        message: 'Message analytics retrieved successfully',
        data: {
          timeSeries: timeSeriesData,
          period,
          groupBy
        }
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting message analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve message analytics'
      } as ApiResponse);
    }
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;
      const { period = '30d' } = req.query;

      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get session statistics
      const sessions = await WhatsappSession.find({ userId })
        .select('sessionId isConnected phoneNumber lastActivity createdAt settings')
        .sort({ createdAt: -1 });

      // Get message counts per session
      const sessionMessageCounts = await MessageLog.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$sessionId',
            totalMessages: { $sum: 1 },
            sentMessages: {
              $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
            },
            receivedMessages: {
              $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
            }
          }
        }
      ]);

      // Combine session data with message counts
      const sessionAnalytics = sessions.map(session => {
        const messageCounts = sessionMessageCounts.find(
          count => count._id.toString() === session._id.toString()
        ) || { totalMessages: 0, sentMessages: 0, receivedMessages: 0 };

        return {
          sessionId: session.sessionId,
          isConnected: session.isConnected,
          phoneNumber: session.phoneNumber,
          lastActivity: session.lastActivity,
          createdAt: session.createdAt,
          settings: session.settings,
          messageStats: {
            total: messageCounts.totalMessages,
            sent: messageCounts.sentMessages,
            received: messageCounts.receivedMessages
          }
        };
      });

      res.json({
        success: true,
        message: 'Session analytics retrieved successfully',
        data: {
          sessions: sessionAnalytics,
          summary: {
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => s.isConnected).length,
            inactiveSessions: sessions.filter(s => !s.isConnected).length
          },
          period
        }
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting session analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve session analytics'
      } as ApiResponse);
    }
  }

  /**
   * Get top contacts by message volume
   */
  async getTopContacts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;
      const { period = '30d', limit = 10 } = req.query;

      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const topContacts = await MessageLog.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              contact: {
                $cond: [
                  { $eq: ['$direction', 'outbound'] },
                  '$to',
                  '$from'
                ]
              }
            },
            totalMessages: { $sum: 1 },
            sentMessages: {
              $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
            },
            receivedMessages: {
              $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
            },
            lastMessageDate: { $max: '$createdAt' }
          }
        },
        {
          $sort: { totalMessages: -1 }
        },
        {
          $limit: parseInt(limit as string) || 10
        },
        {
          $project: {
            contact: '$_id.contact',
            totalMessages: 1,
            sentMessages: 1,
            receivedMessages: 1,
            lastMessageDate: 1,
            _id: 0
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Top contacts retrieved successfully',
        data: {
          contacts: topContacts,
          period,
          limit: parseInt(limit as string) || 10
        }
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting top contacts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve top contacts'
      } as ApiResponse);
    }
  }
}

export default new AnalyticsController();
