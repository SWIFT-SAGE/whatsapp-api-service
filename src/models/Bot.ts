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
  purpose?: string; // Bot's purpose/role (e.g., "Customer Support", "Sales Assistant")
  isActive: boolean;
  flows: IBotFlow[];
  defaultFlow?: IBotFlow;
  aiConfig?: {
    enabled: boolean;
    mode: 'flows_only' | 'ai_only' | 'hybrid'; // flows_only: traditional flows, ai_only: pure AI, hybrid: flows + AI fallback
    provider: 'gemini' | 'openai' | 'custom';
    apiKey?: string; // User's own API key (optional, falls back to system key)
    model?: string; // e.g., 'gemini-1.5-flash', 'gpt-3.5-turbo'
    systemPrompt?: string; // Custom instructions for the AI (bot's personality/purpose)
    temperature?: number; // 0-1, controls randomness
    maxTokens?: number; // Max response length
  };
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
  purpose: {
    type: String,
    maxlength: [200, 'Purpose cannot exceed 200 characters'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  flows: [botFlowSchema],
  defaultFlow: botFlowSchema,
  aiConfig: {
    enabled: {
      type: Boolean,
      default: false
    },
    mode: {
      type: String,
      enum: ['flows_only', 'ai_only', 'hybrid'],
      default: 'flows_only'
    },
    provider: {
      type: String,
      enum: ['gemini', 'openai', 'custom'],
      default: 'gemini'
    },
    apiKey: String, // Optional user API key
    model: {
      type: String,
      default: 'gemini-1.5-flash'
    },
    systemPrompt: {
      type: String,
      maxlength: [1000, 'System prompt cannot exceed 1000 characters']
    },
    temperature: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.7
    },
    maxTokens: {
      type: Number,
      min: 50,
      max: 2000,
      default: 500
    }
  },
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
