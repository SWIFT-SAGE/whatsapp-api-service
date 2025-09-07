import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBotFlow {
  id: string;
  name: string;
  trigger: {
    type: 'keyword' | 'menu' | 'webhook';
    value: string;
    caseSensitive?: boolean;
  };
  responses: Array<{
    type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'menu';
    content?: string;
    mediaUrl?: string;
    fileName?: string;
    delay?: number; // in milliseconds
    menuOptions?: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with';
    value: string;
    nextFlowId?: string;
  }>;
  nextFlowId?: string;
  isActive: boolean;
}

export interface IBot extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  flows: IBotFlow[];
  defaultFlow?: IBotFlow;
  settings: {
    enableInGroups: boolean;
    enableForUnknown: boolean;
    workingHours?: {
      enabled: boolean;
      timezone: string;
      start: string; // HH:MM format
      end: string; // HH:MM format
      days: number[]; // 0-6 (Sunday-Saturday)
    };
    fallbackMessage?: string;
  };
  analytics: {
    totalConversations: number;
    totalMessages: number;
    lastUsed?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const botFlowSchema = new Schema<IBotFlow>({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  trigger: {
    type: {
      type: String,
      enum: ['keyword', 'menu', 'webhook'],
      required: true
    },
    value: {
      type: String,
      required: true
    },
    caseSensitive: {
      type: Boolean,
      default: false
    }
  },
  responses: [{
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'document', 'menu'],
      required: true
    },
    content: String,
    mediaUrl: String,
    fileName: String,
    delay: {
      type: Number,
      default: 0
    },
    menuOptions: [{
      id: String,
      title: String,
      description: String
    }]
  }],
  conditions: [{
    field: String,
    operator: {
      type: String,
      enum: ['equals', 'contains', 'starts_with', 'ends_with']
    },
    value: String,
    nextFlowId: String
  }],
  nextFlowId: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const botSchema = new Schema<IBot>({
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
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Bot name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  flows: [botFlowSchema],
  defaultFlow: botFlowSchema,
  settings: {
    enableInGroups: {
      type: Boolean,
      default: false
    },
    enableForUnknown: {
      type: Boolean,
      default: true
    },
    workingHours: {
      enabled: {
        type: Boolean,
        default: false
      },
      timezone: {
        type: String,
        default: 'UTC'
      },
      start: String,
      end: String,
      days: [{
        type: Number,
        min: 0,
        max: 6
      }]
    },
    fallbackMessage: {
      type: String,
      default: 'Sorry, I didn\'t understand that. Type "help" for available commands.'
    }
  },
  analytics: {
    totalConversations: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    lastUsed: Date
  }
}, {
  timestamps: true
});

// Indexes
botSchema.index({ userId: 1 });
botSchema.index({ sessionId: 1 });
botSchema.index({ isActive: 1 });

const Bot: Model<IBot> = mongoose.model<IBot>('Bot', botSchema);

export default Bot;
