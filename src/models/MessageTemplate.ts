import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageTemplate extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category: 'marketing' | 'transactional' | 'notification' | 'custom';
  type: 'text' | 'product' | 'order' | 'poll' | 'list' | 'interactive';
  content: {
    // Text
    text?: string;
    
    // Product (whatsapp-web.js Product class)
    productImage?: string;
    businessOwnerJid?: string;
    productId?: string;
    title?: string;
    productDescription?: string;
    currencyCode?: string;
    priceAmount1000?: number; // Price × 1000
    productUrl?: string;
    retailerId?: string;
    
    // Order (whatsapp-web.js Order class)
    orderId?: string;
    thumbnail?: string;
    itemCount?: number;
    orderStatus?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    surface?: 'catalog' | 'cart';
    orderMessage?: string;
    orderTitle?: string;
    sellerJid?: string;
    token?: string;
    totalAmount1000?: number;
    totalCurrencyCode?: string;
    orderItems?: Array<{
      productId: string;
      name: string;
      imageUrl: string;
      quantity: number;
      currency: string;
      priceAmount1000: number;
    }>;
    
    // Poll (whatsapp-web.js Poll class)
    pollName?: string;
    pollOptions?: string[];
    selectableOptionsCount?: number; // 1 = single choice, 0 = unlimited, N = max N choices
    
    // List (whatsapp-web.js List class)
    listBody?: string;
    listButtonText?: string;
    listTitle?: string;
    listFooter?: string;
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
      enum: ['text', 'product', 'order', 'poll', 'list', 'interactive'],
      required: true,
      default: 'text'
    },
  content: {
    type: {
      // Text
      text: String,
      
      // Product fields
      productImage: String,
      businessOwnerJid: String,
      productId: String,
      title: String,
      productDescription: String,
      currencyCode: String,
      priceAmount1000: Number,
      productUrl: String,
      retailerId: String,
      
      // Order fields
      orderId: String,
      thumbnail: String,
      itemCount: Number,
      orderStatus: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
      },
      surface: {
        type: String,
        enum: ['catalog', 'cart']
      },
      orderMessage: String,
      orderTitle: String,
      sellerJid: String,
      token: String,
      totalAmount1000: Number,
      totalCurrencyCode: String,
      orderItems: [{
        productId: String,
        name: String,
        imageUrl: String,
        quantity: Number,
        currency: String,
        priceAmount1000: Number
      }],
      
      // Poll fields
      pollName: String,
      pollOptions: [String],
      selectableOptionsCount: Number,
      
      // List fields
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
