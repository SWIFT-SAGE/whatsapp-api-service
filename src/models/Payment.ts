import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySubscriptionId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  type: 'one_time' | 'subscription' | 'upgrade' | 'renewal';
  plan: 'basic' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  description?: string;
  razorpayResponse?: any;
  failureReason?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  metadata?: {
    previousPlan?: string;
    upgradeFrom?: string;
    promoCode?: string;
    discount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  processRefund(amount: number, reason: string): Promise<void>;
  markAsCompleted(paypalResponse: any): Promise<void>;
  markAsFailed(reason: string): Promise<void>;
}

const paymentSchema = new Schema<IPayment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true,
    index: true
  },
  razorpaySubscriptionId: {
    type: String,
    sparse: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be positive'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Amount must be a valid positive number'
    }
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'],
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['one_time', 'subscription', 'upgrade', 'renewal'],
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    required: true,
    index: true
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
    default: 'monthly'
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  razorpayResponse: {
    type: Schema.Types.Mixed,
    select: false // Don't include by default for security
  },
  failureReason: {
    type: String,
    maxlength: [1000, 'Failure reason cannot exceed 1000 characters']
  },
  refundAmount: {
    type: Number,
    min: [0, 'Refund amount must be positive'],
    validate: {
      validator: function(this: IPayment, value: number) {
        return !value || value <= this.amount;
      },
      message: 'Refund amount cannot exceed original payment amount'
    }
  },
  refundReason: {
    type: String,
    maxlength: [1000, 'Refund reason cannot exceed 1000 characters']
  },
  refundedAt: Date,
  metadata: {
    previousPlan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise']
    },
    upgradeFrom: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise']
    },
    promoCode: {
      type: String,
      uppercase: true,
      maxlength: [50, 'Promo code cannot exceed 50 characters']
    },
    discount: {
      type: Number,
      min: [0, 'Discount must be positive'],
      max: [100, 'Discount cannot exceed 100%']
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ type: 1, createdAt: -1 });
paymentSchema.index({ plan: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ razorpaySubscriptionId: 1 });
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ userId: 1, type: 1, status: 1 });

// Instance methods
paymentSchema.methods.processRefund = async function(amount: number, reason: string): Promise<void> {
  if (this.status !== 'completed') {
    throw new Error('Can only refund completed payments');
  }
  
  if (amount > this.amount) {
    throw new Error('Refund amount cannot exceed original payment amount');
  }

  const updateData: any = {
    status: 'refunded',
    refundAmount: amount,
    refundReason: reason,
    refundedAt: new Date()
  };

  await this.updateOne(updateData);
};

paymentSchema.methods.markAsCompleted = async function(razorpayResponse: any): Promise<void> {
  const updateData: any = {
    status: 'completed',
    razorpayResponse: razorpayResponse
  };

  // Extract Razorpay payment ID if available
  if (razorpayResponse?.id) {
    updateData.razorpayPaymentId = razorpayResponse.id;
  }

  await this.updateOne(updateData);
};

paymentSchema.methods.markAsFailed = async function(reason: string): Promise<void> {
  await this.updateOne({
    status: 'failed',
    failureReason: reason
  });
};

// Static methods
paymentSchema.statics.findByRazorpayOrderId = function(orderId: string) {
  return this.findOne({ razorpayOrderId: orderId });
};

paymentSchema.statics.findByRazorpaySubscriptionId = function(subscriptionId: string) {
  return this.findOne({ razorpaySubscriptionId: subscriptionId });
};

paymentSchema.statics.getUserPayments = function(userId: mongoose.Types.ObjectId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'email name');
};

paymentSchema.statics.getRevenueStats = function(startDate?: Date, endDate?: Date) {
  const matchStage: any = { status: 'completed' };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalPayments: { $sum: 1 },
        avgPayment: { $avg: '$amount' },
        planBreakdown: {
          $push: {
            plan: '$plan',
            amount: '$amount',
            type: '$type'
          }
        }
      }
    }
  ]);
};

const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
