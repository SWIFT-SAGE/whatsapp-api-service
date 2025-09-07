// Export all models for easier imports
export { default as User, IUser } from './User';
export { default as WhatsappSession, IWhatsappSession } from './WhatsappSession';
export { default as MessageLog, IMessageLog } from './MessageLog';
export { default as ApiKey, IApiKey } from './ApiKey';
export { default as Webhook, IWebhook } from './Webhook';
export { default as Analytics, IAnalytics } from './Analytics';

// Re-export mongoose types for convenience
export { Types as MongooseTypes } from 'mongoose';

// Common model utilities
export const ModelNames = {
  USER: 'User',
  WHATSAPP_SESSION: 'WhatsappSession',
  MESSAGE_LOG: 'MessageLog',
  API_KEY: 'ApiKey',
  WEBHOOK: 'Webhook',
  ANALYTICS: 'Analytics'
} as const;

export type ModelName = typeof ModelNames[keyof typeof ModelNames];

// Common query helpers
export const QueryHelpers = {
  // Pagination helper
  paginate: (page: number = 1, limit: number = 10) => {
    const skip = (page - 1) * limit;
    return { skip, limit };
  },
  
  // Date range helper
  dateRange: (startDate?: Date, endDate?: Date) => {
    const query: any = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }
    return query;
  },
  
  // Sort helper
  sort: (field: string = 'createdAt', order: 'asc' | 'desc' = 'desc') => {
    return { [field]: order === 'desc' ? -1 : 1 };
  }
};

// Model validation helpers
export const ValidationHelpers = {
  isValidObjectId: (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  },
  
  isValidEmail: (email: string): boolean => {
    return /^\S+@\S+\.\S+$/.test(email);
  },
  
  isValidPhoneNumber: (phone: string): boolean => {
    return /^\+?[1-9]\d{1,14}$/.test(phone);
  },
  
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

// Common aggregation pipelines
export const AggregationPipelines = {
  // User statistics pipeline
  userStats: (userId: string) => [
    { $match: { userId: new (require('mongoose')).Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$userId',
        totalSessions: { $sum: 1 },
        activeSessions: {
          $sum: { $cond: [{ $eq: ['$isConnected', true] }, 1, 0] }
        },
        totalMessages: { $sum: '$statistics.messagesSent' },
        totalUptime: { $sum: '$statistics.totalUptime' }
      }
    }
  ],
  
  // Message analytics pipeline
  messageAnalytics: (userId: string, days: number = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return [
      {
        $match: {
          userId: new (require('mongoose')).Types.ObjectId(userId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
            direction: '$direction'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          messages: {
            $push: {
              type: '$_id.type',
              direction: '$_id.direction',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ];
  }
};

// Export types for better TypeScript support
export type PaginationOptions = {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
};

export type DateRangeFilter = {
  startDate?: Date;
  endDate?: Date;
};

export type BaseQuery = {
  userId?: string;
  isActive?: boolean;
} & DateRangeFilter;