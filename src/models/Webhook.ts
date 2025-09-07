import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWebhookLog {
  timestamp: Date;
  event: string;
  success: boolean;
  responseTime?: number;
  httpStatus?: number;
  error?: string;
  payload?: any;
}

export interface IWebhook extends Document<any, any, any> {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  url: string;
  secret?: string;
  events: string[];
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  headers?: Map<string, string>;
  timeout: number;
  lastTriggeredAt?: Date;
  successCount: number;
  failureCount: number;
  lastError?: string;
  lastErrorAt?: Date;
  logs?: IWebhookLog[];
  createdAt: Date;
  updatedAt: Date;
  incrementSuccess(): Promise<void>;
  incrementFailure(error: string): Promise<void>;
  updateLastTriggered(): Promise<void>;
}

const webhookSchema = new Schema<IWebhook>({
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
  url: {
    type: String,
    required: [true, 'Webhook URL is required'],
    validate: {
      validator: function(url: string) {
        return /^https?:\/\/.+/.test(url);
      },
      message: 'Webhook URL must be a valid HTTP/HTTPS URL'
    }
  },
  secret: {
    type: String,
    select: false,
    minlength: [8, 'Webhook secret must be at least 8 characters']
  },
  events: [{
    type: String,
    enum: [
      'message.received',
      'message.sent',
      'message.delivered',
      'message.read',
      'message.failed',
      'session.connected',
      'session.disconnected',
      'session.qr_updated',
      'session.error',
      'user.updated',
      'subscription.updated'
    ],
    required: true
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  retryPolicy: {
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    },
    retryDelay: {
      type: Number,
      default: 1000, // 1 second
      min: 100
    },
    backoffMultiplier: {
      type: Number,
      default: 2,
      min: 1,
      max: 10
    }
  },
  headers: {
    type: Map,
    of: String,
    default: new Map()
  },
  timeout: {
    type: Number,
    default: 30000, // 30 seconds
    min: 1000,
    max: 120000
  },
  lastTriggeredAt: {
    type: Date,
    index: true
  },
  successCount: {
    type: Number,
    default: 0,
    min: 0
  },
  failureCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastError: String,
  lastErrorAt: Date,
  logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    event: String,
    success: Boolean,
    responseTime: Number,
    httpStatus: Number,
    error: String,
    payload: Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Indexes
webhookSchema.index({ userId: 1, isActive: 1 });
webhookSchema.index({ sessionId: 1, isActive: 1 });
webhookSchema.index({ events: 1, isActive: 1 });
webhookSchema.index({ lastTriggeredAt: 1 });
webhookSchema.index({ userId: 1, events: 1, isActive: 1 });

// Instance methods
webhookSchema.methods.incrementSuccess = async function(): Promise<void> {
  await this.updateOne({
    $inc: { successCount: 1 },
    $set: { lastTriggeredAt: new Date() },
    $unset: { lastError: 1, lastErrorAt: 1 }
  });
};

webhookSchema.methods.incrementFailure = async function(error: string): Promise<void> {
  await this.updateOne({
    $inc: { failureCount: 1 },
    $set: {
      lastError: error,
      lastErrorAt: new Date(),
      lastTriggeredAt: new Date()
    }
  });
};

webhookSchema.methods.updateLastTriggered = async function(): Promise<void> {
  await this.updateOne({
    $set: { lastTriggeredAt: new Date() }
  });
};

// Static methods
webhookSchema.statics.findActiveByEvent = function(event: string, userId?: mongoose.Types.ObjectId) {
  const query: any = {
    events: event,
    isActive: true
  };
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.find(query);
};

webhookSchema.statics.findByUserAndSession = function(userId: mongoose.Types.ObjectId, sessionId?: mongoose.Types.ObjectId) {
  const query: any = {
    userId,
    isActive: true
  };
  
  if (sessionId) {
    query.$or = [
      { sessionId },
      { sessionId: { $exists: false } }
    ];
  }
  
  return this.find(query);
};

const Webhook: Model<IWebhook> = mongoose.model<IWebhook>('Webhook', webhookSchema);

export default Webhook;