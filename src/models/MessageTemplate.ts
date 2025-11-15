import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageTemplate extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category: 'marketing' | 'transactional' | 'notification' | 'custom';
  type: 'text' | 'media' | 'buttons' | 'list' | 'interactive';
  content: {
    // Text & Media
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'document' | 'audio';
    caption?: string;
    
    // Buttons (whatsapp-web.js Buttons class)
    buttonTitle?: string; // Title shown above buttons
    buttonFooter?: string; // Footer text
    buttons?: Array<{
      id: string;
      body: string; // Button text
    }>;
    
    // List (whatsapp-web.js List class)
    listBody?: string; // Main text for list
    listButtonText?: string; // Text on the button to open list
    listTitle?: string; // Title at top of list
    listFooter?: string; // Footer text
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
      enum: ['text', 'media', 'buttons', 'list', 'interactive'],
      required: true,
      default: 'text'
    },
  content: {
    type: {
      // Text & Media
      text: String,
      mediaUrl: String,
      mediaType: {
        type: String,
        enum: ['image', 'video', 'document', 'audio']
      },
      caption: String,
      
      // Buttons
      buttonTitle: String,
      buttonFooter: String,
      buttons: [{
        id: String,
        body: String
      }],
      
      // List
      listBody: String,
      listButtonText: String,
      listTitle: String,
      listFooter: String,
      listSections: [{
        title: String,
        rows: [{
          id: String,
          title: String,
          description: String
        }]
      }]
    },
    default: {}
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
