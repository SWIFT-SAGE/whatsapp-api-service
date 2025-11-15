import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageTemplate extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category: 'marketing' | 'transactional' | 'notification' | 'custom';
  type: 'text' | 'media' | 'button' | 'list' | 'interactive';
  content: {
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'document' | 'audio';
    caption?: string;
    footer?: string;
    buttons?: Array<{
      id: string;
      text: string;
    }>;
    listTitle?: string;
    listButtonText?: string;
    listSections?: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
  variables: string[]; // e.g., ['name', 'orderId', 'amount']
  formatting: {
    useBold: boolean;
    useItalic: boolean;
    useEmojis: boolean;
  };
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const MessageTemplateSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      enum: ['marketing', 'transactional', 'notification', 'custom'],
      default: 'custom'
    },
    type: {
      type: String,
      enum: ['text', 'media', 'button', 'list', 'interactive'],
      required: true,
      default: 'text'
    },
    content: {
      text: String,
      mediaUrl: String,
      mediaType: {
        type: String,
        enum: ['image', 'video', 'document', 'audio']
      },
      caption: String,
      footer: String,
      buttons: [{
        id: String,
        text: String
      }],
      listTitle: String,
      listButtonText: String,
      listSections: [{
        title: String,
        rows: [{
          id: String,
          title: String,
          description: String
        }]
      }]
    },
    variables: {
      type: [String],
      default: []
    },
    formatting: {
      useBold: {
        type: Boolean,
        default: false
      },
      useItalic: {
        type: Boolean,
        default: false
      },
      useEmojis: {
        type: Boolean,
        default: true
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    usageCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound index for user + name uniqueness
MessageTemplateSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model<IMessageTemplate>('MessageTemplate', MessageTemplateSchema);
