import { Types } from 'mongoose';
import Analytics, { IAnalytics } from '../models/Analytics';
import WhatsappSession from '../models/WhatsappSession';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface MetricUpdate {
  messagesSent?: number;
  messagesReceived?: number;
  apiCalls?: number;
  webhookCalls?: number;
  sessionUptime?: number;
  uniqueContacts?: number;
  groupMessages?: number;
  mediaMessages?: number;
}

interface BreakdownUpdate {
  messageTypes?: Record<string, number>;
  hourlyDistribution?: Record<string, number>;
  contactActivity?: Record<string, number>;
  errorTypes?: Record<string, number>;
}

interface CostUpdate {
  messageCost?: number;
  apiCost?: number;
  storageCost?: number;
}

interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  sessionId?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

interface UsageReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalMessages: number;
    messagesSent: number;
    messagesReceived: number;
    apiCalls: number;
    webhookCalls: number;
    uniqueContacts: number;
    activeSessions: number;
  };
  costs: {
    total: number;
    messages: number;
    api: number;
    storage: number;
  };
  trends: {
    messagesGrowth: number;
    apiCallsGrowth: number;
    costsGrowth: number;
  };
  topContacts: Array<{
    contact: string;
    messageCount: number;
  }>;
  messageTypeDistribution: Record<string, number>;
  hourlyActivity: Record<string, number>;
}

interface DashboardStats {
  today: {
    messages: number;
    apiCalls: number;
    costs: number;
  };
  thisWeek: {
    messages: number;
    apiCalls: number;
    costs: number;
  };
  thisMonth: {
    messages: number;
    apiCalls: number;
    costs: number;
  };
  recentActivity: Array<{
    date: Date;
    messages: number;
    apiCalls: number;
  }>;
}

class AnalyticsService {
  /**
   * Track message event
   */
  async trackMessage(
    userId: string,
    sessionId: Types.ObjectId,
    direction: 'sent' | 'received',
    messageType: string,
    contact?: string
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metrics: MetricUpdate = {
        messagesSent: direction === 'sent' ? 1 : 0,
        messagesReceived: direction === 'received' ? 1 : 0
      };

      if (messageType === 'image' || messageType === 'video' || messageType === 'audio' || messageType === 'document') {
        metrics.mediaMessages = 1;
      }

      const breakdowns: BreakdownUpdate = {
        messageTypes: { [messageType]: 1 },
        hourlyDistribution: { [new Date().getHours().toString()]: 1 }
      };

      if (contact) {
        breakdowns.contactActivity = { [contact]: 1 };
      }

      await this.updateAnalytics(userId, sessionId, today, metrics, breakdowns);

      logger.debug(`Message tracked: ${direction} - ${messageType}`);
    } catch (error) {
      logger.error('Error tracking message:', error);
    }
  }

  /**
   * Track API call
   */
  async trackApiCall(userId: string, endpoint: string, responseTime?: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metrics: MetricUpdate = {
        apiCalls: 1
      };

      const breakdowns: BreakdownUpdate = {
        hourlyDistribution: { [new Date().getHours().toString()]: 1 }
      };

      await this.updateAnalytics(userId, null, today, metrics, breakdowns);

      logger.debug(`API call tracked: ${endpoint}`);
    } catch (error) {
      logger.error('Error tracking API call:', error);
    }
  }

  /**
   * Track webhook call
   */
  async trackWebhookCall(userId: string, sessionId: Types.ObjectId, event: string, success: boolean): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metrics: MetricUpdate = {
        webhookCalls: 1
      };

      const breakdowns: BreakdownUpdate = {
        errorTypes: success ? {} : { [event]: 1 }
      };

      await this.updateAnalytics(userId, sessionId, today, metrics, breakdowns);

      logger.debug(`Webhook call tracked: ${event} - ${success ? 'success' : 'failed'}`);
    } catch (error) {
      logger.error('Error tracking webhook call:', error);
    }
  }

  /**
   * Track session uptime
   */
  async trackSessionUptime(userId: string, sessionId: Types.ObjectId, uptimeMinutes: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metrics: MetricUpdate = {
        sessionUptime: uptimeMinutes
      };

      await this.updateAnalytics(userId, sessionId, today, metrics);

      logger.debug(`Session uptime tracked: ${uptimeMinutes} minutes`);
    } catch (error) {
      logger.error('Error tracking session uptime:', error);
    }
  }

  /**
   * Track unique contact
   */
  async trackUniqueContact(userId: string, sessionId: Types.ObjectId, contact: string): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if contact was already tracked today
      const existing = await Analytics.findOne({
        userId,
        sessionId,
        date: today,
        'breakdowns.contactActivity': { $exists: true }
      });

      if (!existing || !existing.breakdown?.contactActivity?.get(contact)) {
        const metrics: MetricUpdate = {
          uniqueContacts: 1
        };

        const breakdowns: BreakdownUpdate = {
          contactActivity: { [contact]: 1 }
        };

        await this.updateAnalytics(userId, sessionId, today, metrics, breakdowns);
      }

      logger.debug(`Unique contact tracked: ${contact}`);
    } catch (error) {
      logger.error('Error tracking unique contact:', error);
    }
  }

  /**
   * Track costs
   */
  async trackCosts(userId: string, sessionId: Types.ObjectId | null, costs: CostUpdate): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.updateAnalytics(userId, sessionId, today, {}, {}, costs);

      logger.debug('Costs tracked:', costs);
    } catch (error) {
      logger.error('Error tracking costs:', error);
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string, filter: AnalyticsFilter = {}): Promise<IAnalytics[]> {
    try {
      const query: any = { userId };

      if (filter.sessionId) {
        const session = await WhatsappSession.findOne({ sessionId: filter.sessionId, userId });
        if (session) {
          query.sessionId = session._id;
        }
      }

      if (filter.startDate || filter.endDate) {
        query.date = {};
        if (filter.startDate) query.date.$gte = filter.startDate;
        if (filter.endDate) query.date.$lte = filter.endDate;
      }

      return await Analytics.find(query).sort({ date: -1 });
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      throw new AppError('Failed to retrieve analytics');
    }
  }

  /**
   * Generate usage report
   */
  async generateUsageReport(userId: string, startDate: Date, endDate: Date): Promise<UsageReport> {
    try {
      const analytics = await this.getUserAnalytics(userId, { startDate, endDate });

      // Aggregate metrics
      const metrics = analytics.reduce((acc, record) => {
        acc.totalMessages += record.metrics.messagesSent + record.metrics.messagesReceived;
        acc.messagesSent += record.metrics.messagesSent;
        acc.messagesReceived += record.metrics.messagesReceived;
        acc.apiCalls += record.metrics.apiCalls;
        acc.webhookCalls += record.metrics.webhookCalls;
        acc.uniqueContacts += record.metrics.uniqueContacts;
        return acc;
      }, {
        totalMessages: 0,
        messagesSent: 0,
        messagesReceived: 0,
        apiCalls: 0,
        webhookCalls: 0,
        uniqueContacts: 0,
        activeSessions: 0
      });

      // Aggregate costs
      const costs = analytics.reduce((acc, record) => {
        acc.total += record.costs.totalCost;
        acc.messages += record.costs.messageCost;
        acc.api += record.costs.apiCost;
        acc.storage += record.costs.storageCost;
        return acc;
      }, { total: 0, messages: 0, api: 0, storage: 0 });

      // Calculate trends (compare with previous period)
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const previousStartDate = new Date(startDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));
      const previousEndDate = new Date(startDate.getTime() - 1);
      
      const previousAnalytics = await this.getUserAnalytics(userId, {
        startDate: previousStartDate,
        endDate: previousEndDate
      });

      const previousMetrics = previousAnalytics.reduce((acc, record) => {
        acc.messages += record.metrics.messagesSent + record.metrics.messagesReceived;
        acc.apiCalls += record.metrics.apiCalls;
        acc.costs += record.costs.totalCost;
        return acc;
      }, { messages: 0, apiCalls: 0, costs: 0 });

      const trends = {
        messagesGrowth: previousMetrics.messages > 0 
          ? ((metrics.totalMessages - previousMetrics.messages) / previousMetrics.messages) * 100 
          : 0,
        apiCallsGrowth: previousMetrics.apiCalls > 0 
          ? ((metrics.apiCalls - previousMetrics.apiCalls) / previousMetrics.apiCalls) * 100 
          : 0,
        costsGrowth: previousMetrics.costs > 0 
          ? ((costs.total - previousMetrics.costs) / previousMetrics.costs) * 100 
          : 0
      };

      // Get top contacts
      const contactActivity: Record<string, number> = {};
      analytics.forEach(record => {
        Object.entries(record.breakdown?.contactActivity || {}).forEach(([contact, count]) => {
          contactActivity[contact] = (contactActivity[contact] || 0) + count;
        });
      });

      const topContacts = Object.entries(contactActivity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([contact, messageCount]) => ({ contact, messageCount }));

      // Get message type distribution
      const messageTypeDistribution: Record<string, number> = {};
      analytics.forEach(record => {
        Object.entries(record.breakdown?.messageTypes || {}).forEach(([type, count]) => {
          messageTypeDistribution[type] = (messageTypeDistribution[type] || 0) + count;
        });
      });

      // Get hourly activity
      const hourlyActivity: Record<string, number> = {};
      analytics.forEach(record => {
        Object.entries(record.breakdown?.hourlyDistribution || {}).forEach(([hour, count]) => {
          hourlyActivity[hour] = (hourlyActivity[hour] || 0) + count;
        });
      });

      // Get active sessions count
      const activeSessions = await WhatsappSession.countDocuments({ userId, isConnected: true });
      metrics.activeSessions = activeSessions;

      return {
        period: { start: startDate, end: endDate },
        metrics,
        costs,
        trends,
        topContacts,
        messageTypeDistribution,
        hourlyActivity
      };
    } catch (error) {
      logger.error('Error generating usage report:', error);
      throw new AppError('Failed to generate usage report');
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    try {
      const now = new Date();
      
      // Today
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      // This week
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      
      // This month
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [todayStats, weekStats, monthStats] = await Promise.all([
        this.getAggregatedStats(userId, today, todayEnd),
        this.getAggregatedStats(userId, weekStart, todayEnd),
        this.getAggregatedStats(userId, monthStart, todayEnd)
      ]);

      // Recent activity (last 7 days)
      const recentActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        
        const dayStats = await this.getAggregatedStats(userId, date, dateEnd);
        recentActivity.push({
          date,
          messages: dayStats.messages,
          apiCalls: dayStats.apiCalls
        });
      }

      return {
        today: todayStats,
        thisWeek: weekStats,
        thisMonth: monthStats,
        recentActivity
      };
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw new AppError('Failed to get dashboard statistics');
    }
  }

  /**
   * Get system-wide analytics (admin)
   */
  async getSystemAnalytics(startDate: Date, endDate: Date): Promise<any> {
    try {
      const analytics = await Analytics.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $addToSet: '$userId' },
            totalMessages: { $sum: { $add: ['$metrics.messagesSent', '$metrics.messagesReceived'] } },
            totalApiCalls: { $sum: '$metrics.apiCalls' },
            totalWebhookCalls: { $sum: '$metrics.webhookCalls' },
            totalCosts: { $sum: '$costs.totalCost' },
            avgSessionUptime: { $avg: '$metrics.sessionUptime' }
          }
        },
        {
          $project: {
            _id: 0,
            totalUsers: { $size: '$totalUsers' },
            totalMessages: 1,
            totalApiCalls: 1,
            totalWebhookCalls: 1,
            totalCosts: 1,
            avgSessionUptime: 1
          }
        }
      ]);

      return analytics[0] || {
        totalUsers: 0,
        totalMessages: 0,
        totalApiCalls: 0,
        totalWebhookCalls: 0,
        totalCosts: 0,
        avgSessionUptime: 0
      };
    } catch (error) {
      logger.error('Error getting system analytics:', error);
      throw new AppError('Failed to get system analytics');
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(userId: string, startDate: Date, endDate: Date, format: 'csv' | 'json' = 'csv'): Promise<string> {
    try {
      const analytics = await this.getUserAnalytics(userId, { startDate, endDate });

      if (format === 'json') {
        return JSON.stringify(analytics, null, 2);
      }

      // CSV format
      const headers = [
        'Date', 'Messages Sent', 'Messages Received', 'API Calls', 'Webhook Calls',
        'Session Uptime', 'Unique Contacts', 'Group Messages', 'Media Messages',
        'Message Cost', 'API Cost', 'Storage Cost', 'Total Cost'
      ];
      
      const csvRows = [headers.join(',')];

      analytics.forEach(record => {
        const row = [
          record.date.toISOString().split('T')[0],
          record.metrics.messagesSent,
          record.metrics.messagesReceived,
          record.metrics.apiCalls,
          record.metrics.webhookCalls,
          record.metrics.sessionUptime,
          record.metrics.uniqueContacts,
          record.metrics.groupMessages,
          record.metrics.mediaMessages,
          record.costs.messageCost.toFixed(4),
          record.costs.apiCost.toFixed(4),
          record.costs.storageCost.toFixed(4),
          record.costs.totalCost.toFixed(4)
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    } catch (error) {
      logger.error('Error exporting analytics:', error);
      throw new AppError('Failed to export analytics');
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldData(olderThanDays = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await Analytics.deleteMany({ date: { $lt: cutoffDate } });
      
      logger.info(`Cleaned up ${result.deletedCount} old analytics records`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old analytics data:', error);
      return 0;
    }
  }

  /**
   * Update or create analytics record
   */
  private async updateAnalytics(
    userId: string,
    sessionId: Types.ObjectId | null,
    date: Date,
    metrics: MetricUpdate = {},
    breakdowns: BreakdownUpdate = {},
    costs: CostUpdate = {}
  ): Promise<void> {
    try {
      const filter: any = { userId, date };
      if (sessionId) filter.sessionId = sessionId;

      const updateDoc: any = {
        $inc: {},
        $set: { updatedAt: new Date() }
      };

      // Update metrics
      Object.entries(metrics).forEach(([key, value]) => {
        updateDoc.$inc[`metrics.${key}`] = value;
      });

      // Update costs
      Object.entries(costs).forEach(([key, value]) => {
        updateDoc.$inc[`costs.${key}`] = value;
        updateDoc.$inc['costs.totalCost'] = value;
      });

      // Update breakdowns (merge objects)
      Object.entries(breakdowns).forEach(([category, data]) => {
        Object.entries(data).forEach(([key, value]) => {
          updateDoc.$inc[`breakdowns.${category}.${key}`] = value;
        });
      });

      await Analytics.findOneAndUpdate(
        filter,
        updateDoc,
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error('Error updating analytics:', error);
    }
  }

  /**
   * Get aggregated statistics for a date range
   */
  private async getAggregatedStats(userId: string, startDate: Date, endDate: Date): Promise<{ messages: number; apiCalls: number; costs: number }> {
    try {
      const result = await Analytics.aggregate([
        {
          $match: {
            userId: new Types.ObjectId(userId),
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            messages: { $sum: { $add: ['$metrics.messagesSent', '$metrics.messagesReceived'] } },
            apiCalls: { $sum: '$metrics.apiCalls' },
            costs: { $sum: '$costs.totalCost' }
          }
        }
      ]);

      return result[0] || { messages: 0, apiCalls: 0, costs: 0 };
    } catch (error) {
      logger.error('Error getting aggregated stats:', error);
      return { messages: 0, apiCalls: 0, costs: 0 };
    }
  }
}

export default new AnalyticsService();