import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  key: string;
  keyHash: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  usageCount: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  allowedIPs?: string[];
  allowedDomains?: string[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  generateKey(): string;
  validateKey(key: string): boolean;
  incrementUsage(): Promise<void>;
  updateLastUsed(): Promise<void>;
}

const apiKeySchema = new Schema<IApiKey>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'API key name is required'],
    trim: true,
    maxlength: [100, 'API key name cannot exceed 100 characters']
  },
  key: {
    type: String,
    required: true,
    unique: true,
    select: false
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  permissions: [{
    type: String,
    enum: [
      'messages:send',
      'messages:read',
      'sessions:create',
      'sessions:read',
      'sessions:update',
      'sessions:delete',
      'webhooks:manage',
      'analytics:read'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsedAt: {
    type: Date,
    index: true
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  rateLimit: {
    requestsPerMinute: {
      type: Number,
      default: 60,
      min: 1
    },
    requestsPerHour: {
      type: Number,
      default: 1000,
      min: 1
    },
    requestsPerDay: {
      type: Number,
      default: 10000,
      min: 1
    }
  },
  allowedIPs: [{
    type: String,
    validate: {
      validator: function(ip: string) {
        // Basic IP validation (IPv4 and IPv6)
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
      },
      message: 'Invalid IP address format'
    }
  }],
  allowedDomains: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ keyHash: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
apiKeySchema.index({ lastUsedAt: 1 });

// Pre-save middleware to generate key and hash
apiKeySchema.pre('save', async function(next) {
  if (this.isNew && !this.key) {
    this.key = this.generateKey();
    this.keyHash = crypto.createHash('sha256').update(this.key).digest('hex');
  }
  next();
});

// Instance methods
apiKeySchema.methods.generateKey = function(): string {
  const prefix = 'wapi_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return prefix + randomBytes;
};

apiKeySchema.methods.validateKey = function(key: string): boolean {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return this.keyHash === hash;
};

apiKeySchema.methods.incrementUsage = async function(): Promise<void> {
  await this.updateOne({
    $inc: { usageCount: 1 },
    $set: { lastUsedAt: new Date() }
  });
};

apiKeySchema.methods.updateLastUsed = async function(): Promise<void> {
  await this.updateOne({
    $set: { lastUsedAt: new Date() }
  });
};

// Static methods
apiKeySchema.statics.findByKeyHash = function(keyHash: string) {
  return this.findOne({ keyHash, isActive: true });
};

apiKeySchema.statics.findActiveByUser = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId, isActive: true }).sort({ createdAt: -1 });
};

const ApiKey: Model<IApiKey> = mongoose.model<IApiKey>('ApiKey', apiKeySchema);

export default ApiKey;