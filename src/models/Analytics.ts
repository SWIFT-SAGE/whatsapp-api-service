import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAnalytics extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  date: Date;
  metrics: {
    messagesSent: number;
    messagesReceived: number;
    messagesDelivered: number;
    messagesFailed: number;
    apiCalls: number;
    webhookCalls: number;
    webhookFailures: number;
    sessionUptime: number;
    uniqueContacts: number;
    groupMessages: number;
    mediaMessages: number;
  };
  breakdown: {
    messageTypes: Map<string, number>;
    hourlyDistribution: Map<string, number>;
    contactActivity: Map<string, number>;
    errorTypes: Map<string, number>;
  };
  costs: {
    messageCost: number;
    apiCost: number;
    storageCost: number;
    totalCost: number;
  };
  createdAt: Date;
  updatedAt: Date;
  incrementMetric(metric: string, value?: number): Promise<void>;
  addToBreakdown(category: string, key: string, value?: number): Promise<void>;
  updateCosts(costs: Partial<IAnalytics['costs']>): Promise<void>;
}

const analyticsSchema = new Schema<IAnalytics>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'WhatsappSession',
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  metrics: {
    messagesSent: {
      type: Number,
      default: 0,
      min: 0
    },
    messagesReceived: {
      type: Number,
      default: 0,
      min: 0
    },
    messagesDelivered: {
      type: Number,
      default: 0,
      min: 0
    },
    messagesFailed: {
      type: Number,
      default: 0,
      min: 0
    },
    apiCalls: {
      type: Number,
      default: 0,
      min: 0
    },
    webhookCalls: {
      type: Number,
      default: 0,
      min: 0
    },
    webhookFailures: {
      type: Number,
      default: 0,
      min: 0
    },
    sessionUptime: {
      type: Number,
      default: 0,
      min: 0
    },
    uniqueContacts: {
      type: Number,
      default: 0,
      min: 0
    },
    groupMessages: {
      type: Number,
      default: 0,
      min: 0
    },
    mediaMessages: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  breakdown: {
    messageTypes: {
      type: Map,
      of: Number,
      default: new Map()
    },
    hourlyDistribution: {
      type: Map,
      of: Number,
      default: new Map()
    },
    contactActivity: {
      type: Map,
      of: Number,
      default: new Map()
    },
    errorTypes: {
      type: Map,
      of: Number,
      default: new Map()
    }
  },
  costs: {
    messageCost: {
      type: Number,
      default: 0,
      min: 0
    },
    apiCost: {
      type: Number,
      default: 0,
      min: 0
    },
    storageCost: {
      type: Number,
      default: 0,
      min: 0
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
analyticsSchema.index({ userId: 1, date: 1 }, { unique: true });
analyticsSchema.index({ sessionId: 1, date: 1 });
analyticsSchema.index({ date: 1 });
analyticsSchema.index({ userId: 1, date: -1 });
analyticsSchema.index({ 'metrics.messagesSent': 1 });
analyticsSchema.index({ 'costs.totalCost': 1 });

// Pre-save middleware to calculate total cost
analyticsSchema.pre('save', function(next) {
  if (this.isModified('costs')) {
    this.costs.totalCost = 
      this.costs.messageCost + 
      this.costs.apiCost + 
      this.costs.storageCost;
  }
  next();
});

// Instance methods
analyticsSchema.methods.incrementMetric = async function(metric: string, value: number = 1): Promise<void> {
  const updatePath = `metrics.${metric}`;
  await this.updateOne({
    $inc: { [updatePath]: value }
  });
};

analyticsSchema.methods.addToBreakdown = async function(category: string, key: string, value: number = 1): Promise<void> {
  const updatePath = `breakdown.${category}.${key}`;
  await this.updateOne({
    $inc: { [updatePath]: value }
  });
};

analyticsSchema.methods.updateCosts = async function(costs: Partial<IAnalytics['costs']>): Promise<void> {
  const updateData: any = {};
  
  Object.keys(costs).forEach(key => {
    if (costs[key as keyof typeof costs] !== undefined) {
      updateData[`costs.${key}`] = costs[key as keyof typeof costs];
    }
  });
  
  // Recalculate total cost
  const AnalyticsModel = this.constructor as mongoose.Model<IAnalytics>;
  const current = await AnalyticsModel.findById(this._id);
  if (current) {
    updateData['costs.totalCost'] = 
      (costs.messageCost ?? current.costs.messageCost) +
      (costs.apiCost ?? current.costs.apiCost) +
      (costs.storageCost ?? current.costs.storageCost);
  }
  
  await this.updateOne({ $set: updateData });
};

// Static methods
analyticsSchema.statics.findByDateRange = function(
  userId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date,
  sessionId?: mongoose.Types.ObjectId
) {
  const query: any = {
    userId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (sessionId) {
    query.sessionId = sessionId;
  }
  
  return this.find(query).sort({ date: 1 });
};

analyticsSchema.statics.getAggregatedMetrics = function(
  userId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
    {
      $match: {
        userId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalMessagesSent: { $sum: '$metrics.messagesSent' },
        totalMessagesReceived: { $sum: '$metrics.messagesReceived' },
        totalMessagesDelivered: { $sum: '$metrics.messagesDelivered' },
        totalMessagesFailed: { $sum: '$metrics.messagesFailed' },
        totalApiCalls: { $sum: '$metrics.apiCalls' },
        totalWebhookCalls: { $sum: '$metrics.webhookCalls' },
        totalWebhookFailures: { $sum: '$metrics.webhookFailures' },
        totalSessionUptime: { $sum: '$metrics.sessionUptime' },
        totalUniqueContacts: { $sum: '$metrics.uniqueContacts' },
        totalGroupMessages: { $sum: '$metrics.groupMessages' },
        totalMediaMessages: { $sum: '$metrics.mediaMessages' },
        totalCost: { $sum: '$costs.totalCost' },
        avgDailyCost: { $avg: '$costs.totalCost' }
      }
    }
  ]);
};

analyticsSchema.statics.createOrUpdate = async function(
  userId: mongoose.Types.ObjectId,
  date: Date,
  sessionId?: mongoose.Types.ObjectId
) {
  const query: any = { userId, date };
  if (sessionId) query.sessionId = sessionId;
  
  return this.findOneAndUpdate(
    query,
    { $setOnInsert: query },
    { upsert: true, new: true }
  );
};

const Analytics: Model<IAnalytics> = mongoose.model<IAnalytics>('Analytics', analyticsSchema);

export default Analytics;