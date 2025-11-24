import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessageLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  messageId?: string;
  direction: 'inbound' | 'outbound';
  source?: 'api' | 'whatsapp'; // Track if message was sent via API or WhatsApp app
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker' | 'gif' | 'chat' | 'interactive' | 'ptt' | 'buttons' | 'list' | 'e2e_notification' | 'notification' | 'unknown';
  from: string;
  to: string;
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  metadata?: {
    isGroup?: boolean;
    groupName?: string;
    groupId?: string;
    isForwarded?: boolean;
    quotedMessageId?: string;
    quotedContent?: string;
    mentions?: string[];
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    contact?: {
      name: string;
      phone: string;
      email?: string;
    };
  };
  webhookDelivered: boolean;
  webhookAttempts: number;
  lastWebhookAttempt?: Date;
  processingTime?: number;
  cost?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  updateStatus(status: string, timestamp?: Date): Promise<void>;
  incrementRetry(): Promise<void>;
  markWebhookDelivered(): Promise<void>;
}

const messageLogSchema = new Schema<IMessageLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'WhatsappSession',
    required: true
  },
  messageId: String,
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  source: {
    type: String,
    enum: ['api', 'whatsapp'],
    index: true // Index for efficient querying
  },
  type: {
    type: String,
    enum: ['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'gif', 'chat', 'interactive', 'ptt', 'buttons', 'list', 'e2e_notification', 'notification', 'unknown'],
    required: true,
    index: true
  },
  from: {
    type: String,
    required: true,
    index: true
  },
  to: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    maxlength: [4096, 'Message content cannot exceed 4096 characters']
  },
  mediaUrl: String,
  fileName: String,
  fileSize: {
    type: Number,
    min: 0
  },
  mimeType: String,
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending',
    index: true
  },
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastRetryAt: Date,
  deliveredAt: Date,
  readAt: Date,
  metadata: {
    isGroup: Boolean,
    groupName: String,
    groupId: String,
    isForwarded: Boolean,
    quotedMessageId: String,
    quotedContent: String,
    mentions: [String],
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      },
      address: String
    },
    contact: {
      name: String,
      phone: String,
      email: {
        type: String,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
      }
    }
  },
  webhookDelivered: {
    type: Boolean,
    default: false,
    index: true
  },
  webhookAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lastWebhookAttempt: Date,
  processingTime: {
    type: Number,
    min: 0
  },
  cost: {
    type: Number,
    min: 0,
    default: 0
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true
});

// Indexes
messageLogSchema.index({ userId: 1, createdAt: -1 });
messageLogSchema.index({ sessionId: 1, createdAt: -1 });
messageLogSchema.index({ messageId: 1 });
messageLogSchema.index({ direction: 1, createdAt: -1 });
messageLogSchema.index({ status: 1, createdAt: -1 });
messageLogSchema.index({ from: 1, to: 1 });
messageLogSchema.index({ type: 1, createdAt: -1 });
messageLogSchema.index({ webhookDelivered: 1, createdAt: -1 });
messageLogSchema.index({ tags: 1 });
messageLogSchema.index({ userId: 1, direction: 1, createdAt: -1 });
messageLogSchema.index({ 'metadata.isGroup': 1, createdAt: -1 });

// Instance methods
messageLogSchema.methods.updateStatus = async function (status: string, timestamp?: Date): Promise<void> {
  const updateData: any = { status };

  if (timestamp) {
    if (status === 'delivered') {
      updateData.deliveredAt = timestamp;
    } else if (status === 'read') {
      updateData.readAt = timestamp;
    }
  }

  await this.updateOne(updateData);
};

messageLogSchema.methods.incrementRetry = async function (): Promise<void> {
  await this.updateOne({
    $inc: { retryCount: 1 },
    $set: { lastRetryAt: new Date() }
  });
};

messageLogSchema.methods.markWebhookDelivered = async function (): Promise<void> {
  await this.updateOne({
    $set: {
      webhookDelivered: true,
      lastWebhookAttempt: new Date()
    },
    $inc: { webhookAttempts: 1 }
  });
};

const MessageLog: Model<IMessageLog> = mongoose.model<IMessageLog>('MessageLog', messageLogSchema);

export default MessageLog;
