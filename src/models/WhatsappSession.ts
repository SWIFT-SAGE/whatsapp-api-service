import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWhatsappSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  phoneNumber?: string;
  isConnected: boolean;
  status: 'pending' | 'connected' | 'disconnected' | 'error' | 'expired';
  qrCode?: string;
  qrCodeExpiry?: Date;
  lastActivity: Date;
  connectionAttempts: number;
  lastConnectionAttempt?: Date;
  deviceInfo?: {
    name: string;
    version: string;
    battery?: number;
    platform?: string;
    manufacturer?: string;
  };
  webhookUrl?: string;
  webhookSecret?: string;
  settings: {
    autoReply: boolean;
    autoReplyMessage?: string;
    allowGroups: boolean;
    allowUnknown: boolean;
    rateLimitPerMinute: number;
    maxDailyMessages: number;
  };
  statistics: {
    messagesSent: number;
    messagesReceived: number;
    lastMessageAt?: Date;
    totalUptime: number;
  };
  errorLog?: {
    lastError?: string;
    errorCount: number;
    lastErrorAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  updateActivity(): Promise<void>;
  incrementMessageCount(type: 'sent' | 'received'): Promise<void>;
  logError(error: string): Promise<void>;
  isExpired(): boolean;
}

const whatsappSessionSchema = new Schema<IWhatsappSession>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    match: [/^\d{10,15}$/, 'Please provide a valid phone number'],
    index: true
  },
  isConnected: {
    type: Boolean,
    default: false,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'connected', 'disconnected', 'error', 'expired'],
    default: 'pending',
    index: true
  },
  qrCode: {
    type: String,
    select: false
  },
  qrCodeExpiry: Date,
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  connectionAttempts: {
    type: Number,
    default: 0
  },
  lastConnectionAttempt: Date,
  deviceInfo: {
    name: String,
    version: String,
    battery: {
      type: Number,
      min: 0,
      max: 100
    },
    platform: String,
    manufacturer: String
  },
  webhookUrl: {
    type: String,
    validate: {
      validator: function(v: string) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Webhook URL must be a valid HTTP/HTTPS URL'
    }
  },
  webhookSecret: {
    type: String,
    select: false
  },
  settings: {
    autoReply: {
      type: Boolean,
      default: false
    },
    autoReplyMessage: {
      type: String,
      maxlength: [500, 'Auto reply message cannot exceed 500 characters']
    },
    allowGroups: {
      type: Boolean,
      default: true
    },
    allowUnknown: {
      type: Boolean,
      default: true
    },
    rateLimitPerMinute: {
      type: Number,
      default: 60,
      min: 1,
      max: 1000
    },
    maxDailyMessages: {
      type: Number,
      default: 1000,
      min: 1
    }
  },
  statistics: {
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
    lastMessageAt: Date,
    totalUptime: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  errorLog: {
    lastError: String,
    errorCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastErrorAt: Date
  }
}, {
  timestamps: true
});

// Indexes
whatsappSessionSchema.index({ userId: 1 });
whatsappSessionSchema.index({ sessionId: 1 });
whatsappSessionSchema.index({ status: 1 });
whatsappSessionSchema.index({ lastActivity: 1 });
whatsappSessionSchema.index({ userId: 1, status: 1 });
whatsappSessionSchema.index({ qrCodeExpiry: 1 }, { expireAfterSeconds: 0 });

// Update lastActivity on save
whatsappSessionSchema.pre('save', function(next) {
  if (!this.isModified('lastActivity')) {
    this.lastActivity = new Date();
  }
  next();
});

// Instance methods
whatsappSessionSchema.methods.updateActivity = async function(): Promise<void> {
  this.lastActivity = new Date();
  await this.save();
};

whatsappSessionSchema.methods.incrementMessageCount = async function(type: 'sent' | 'received'): Promise<void> {
  const field = type === 'sent' ? 'statistics.messagesSent' : 'statistics.messagesReceived';
  await this.updateOne({
    $inc: { [field]: 1 },
    $set: { 
      'statistics.lastMessageAt': new Date(),
      lastActivity: new Date()
    }
  });
};

whatsappSessionSchema.methods.logError = async function(error: string): Promise<void> {
  await this.updateOne({
    $set: {
      'errorLog.lastError': error,
      'errorLog.lastErrorAt': new Date(),
      status: 'error'
    },
    $inc: { 'errorLog.errorCount': 1 }
  });
};

whatsappSessionSchema.methods.isExpired = function(): boolean {
  if (!this.qrCodeExpiry) return false;
  return this.qrCodeExpiry < new Date();
};

const WhatsappSession: Model<IWhatsappSession> = mongoose.model<IWhatsappSession>('WhatsappSession', whatsappSessionSchema);

export default WhatsappSession;
