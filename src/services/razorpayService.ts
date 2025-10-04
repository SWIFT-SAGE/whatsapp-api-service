import Razorpay from 'razorpay';
import { logger } from '../utils/logger';
import Payment, { IPayment } from '../models/Payment';
import User, { IUser } from '../models/User';
import mongoose from 'mongoose';
import crypto from 'crypto';

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  environment: 'test' | 'live';
}

interface PaymentPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  messageLimit: number;
}

interface CreatePaymentOptions {
  userId: mongoose.Types.ObjectId;
  plan: 'basic' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  type: 'one_time' | 'subscription' | 'upgrade' | 'renewal';
  promoCode?: string;
}

interface WebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: any;
    };
    order?: {
      entity: any;
    };
    subscription?: {
      entity: any;
    };
  };
  created_at: number;
}

export class RazorpayService {
  private razorpay!: Razorpay;
  private config: RazorpayConfig;
  
  // Predefined payment plans
  private readonly PAYMENT_PLANS: Record<string, PaymentPlan> = {
    'basic_monthly': {
      id: 'basic_monthly',
      name: 'Basic Plan - Monthly',
      price: 2900, // Amount in paise ($29.00)
      currency: 'USD',
      interval: 'month',
      messageLimit: 10000
    },
    'basic_yearly': {
      id: 'basic_yearly',
      name: 'Basic Plan - Yearly',
      price: 34800, // Amount in cents ($348.00 - 12 months)
      currency: 'USD',
      interval: 'year',
      messageLimit: 10000
    },
    'pro_monthly': {
      id: 'pro_monthly',
      name: 'Pro Plan - Monthly',
      price: 9900, // Amount in cents ($99.00)
      currency: 'USD',
      interval: 'month',
      messageLimit: 100000
    },
    'pro_yearly': {
      id: 'pro_yearly',
      name: 'Pro Plan - Yearly',
      price: 118800, // Amount in cents ($1188.00 - 12 months)
      currency: 'USD',
      interval: 'year',
      messageLimit: 100000
    },
    'enterprise_monthly': {
      id: 'enterprise_monthly',
      name: 'Enterprise Plan - Monthly',
      price: 29900, // Amount in cents ($299.00)
      currency: 'USD',
      interval: 'month',
      messageLimit: -1 // Unlimited
    },
    'enterprise_yearly': {
      id: 'enterprise_yearly',
      name: 'Enterprise Plan - Yearly',
      price: 358800, // Amount in cents ($3588.00 - 12 months)
      currency: 'USD',
      interval: 'year',
      messageLimit: -1 // Unlimited
    }
  };

  constructor() {
    this.config = {
      keyId: process.env.RAZORPAY_KEY_ID || '',
      keySecret: process.env.RAZORPAY_KEY_SECRET || '',
      environment: (process.env.RAZORPAY_ENVIRONMENT as 'test' | 'live') || 'test'
    };

    if (!this.config.keyId || !this.config.keySecret) {
      logger.warn('Razorpay credentials not configured. Payment functionality will be disabled.');
      return;
    }

    this.razorpay = new Razorpay({
      key_id: this.config.keyId,
      key_secret: this.config.keySecret
    });

    logger.info('Razorpay service initialized', { 
      environment: this.config.environment,
      keyId: this.config.keyId.substring(0, 8) + '...'
    });
  }

  /**
   * Check if Razorpay is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.keyId && this.config.keySecret && this.razorpay);
  }

  /**
   * Get payment plan details
   */
  getPaymentPlan(plan: 'basic' | 'pro' | 'enterprise', billingCycle: 'monthly' | 'yearly'): PaymentPlan | null {
    const planKey = `${plan}_${billingCycle}`;
    return this.PAYMENT_PLANS[planKey] || null;
  }

  /**
   * Get all available payment plans
   */
  getAllPaymentPlans(): PaymentPlan[] {
    return Object.values(this.PAYMENT_PLANS);
  }

  /**
   * Calculate discount based on promo code
   */
  private calculateDiscount(amount: number, promoCode?: string): number {
    if (!promoCode) return 0;
    
    const promoCodes: Record<string, number> = {
      'SAVE10': 10,
      'SAVE20': 20,
      'WELCOME25': 25,
      'YEARLY50': 50 // For yearly subscriptions
    };

    const discountPercent = promoCodes[promoCode.toUpperCase()] || 0;
    return Math.round((amount * discountPercent / 100));
  }

  /**
   * Create a Razorpay order for payment
   */
  async createOrder(options: CreatePaymentOptions): Promise<{ orderId: string; payment: IPayment }> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay service is not configured');
    }

    try {
      const paymentPlan = this.getPaymentPlan(options.plan, options.billingCycle);
      if (!paymentPlan) {
        throw new Error(`Invalid payment plan: ${options.plan}_${options.billingCycle}`);
      }

      const discount = this.calculateDiscount(paymentPlan.price, options.promoCode);
      const finalAmount = Math.max(0, paymentPlan.price - discount);

      // Create payment record first
      const payment = new Payment({
        userId: options.userId,
        razorpayOrderId: '', // Will be set after Razorpay order creation
        amount: finalAmount / 100, // Convert paise to rupees for storage
        currency: paymentPlan.currency,
        status: 'pending',
        type: options.type,
        plan: options.plan,
        billingCycle: options.billingCycle,
        description: `${paymentPlan.name} - ${options.type}`,
        metadata: {
          promoCode: options.promoCode,
          discount: discount / 100 // Convert paise to rupees
        }
      });

      // Create Razorpay order
      const orderOptions = {
        amount: finalAmount, // Amount in paise
        currency: paymentPlan.currency,
        receipt: `receipt_${Date.now()}_${payment._id.toString().substring(0, 8)}`,
        notes: {
          userId: options.userId.toString(),
          paymentId: payment._id.toString(),
          plan: options.plan,
          billingCycle: options.billingCycle,
          type: options.type
        }
      };

      const razorpayOrder = await this.razorpay.orders.create(orderOptions);

      // Update payment with Razorpay order ID
      payment.razorpayOrderId = razorpayOrder.id;
      await payment.save();

      logger.info('Razorpay order created successfully', {
        orderId: razorpayOrder.id,
        amount: finalAmount,
        plan: options.plan,
        userId: options.userId
      });

      return {
        orderId: razorpayOrder.id,
        payment
      };

    } catch (error: any) {
      logger.error('Failed to create Razorpay order', {
        error: error.message,
        options,
        stack: error.stack
      });
      throw new Error(`Razorpay order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.isConfigured()) {
      throw new Error('Razorpay service is not configured');
    }

    try {
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', this.config.keySecret)
        .update(body.toString())
        .digest('hex');

      return expectedSignature === signature;
    } catch (error: any) {
      logger.error('Failed to verify payment signature', {
        orderId,
        paymentId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Capture payment after verification
   */
  async capturePayment(orderId: string, paymentId: string, signature: string): Promise<{ success: boolean; payment: IPayment | null; razorpayResponse?: any }> {
    try {
      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) {
        throw new Error(`Payment not found for order ID: ${orderId}`);
      }

      // Verify signature
      if (!this.verifyPaymentSignature(orderId, paymentId, signature)) {
        await payment.markAsFailed('Invalid payment signature');
        return {
          success: false,
          payment
        };
      }

      // Fetch payment details from Razorpay
      const razorpayPayment = await this.razorpay.payments.fetch(paymentId);

      if (razorpayPayment.status === 'captured') {
        // Mark payment as completed
        await payment.markAsCompleted(razorpayPayment);

        // Update user subscription
        await this.updateUserSubscription(payment);

        logger.info('Razorpay payment captured successfully', {
          orderId,
          paymentId,
          amount: payment.amount,
          plan: payment.plan
        });

        return {
          success: true,
          payment,
          razorpayResponse: razorpayPayment
        };
      } else {
        await payment.markAsFailed(`Payment capture failed with status: ${razorpayPayment.status}`);
        
        return {
          success: false,
          payment
        };
      }

    } catch (error: any) {
      logger.error('Failed to capture Razorpay payment', {
        orderId,
        paymentId,
        error: error.message,
        stack: error.stack
      });

      // Try to find and mark payment as failed
      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment) {
        await payment.markAsFailed(error.message);
      }

      return {
        success: false,
        payment
      };
    }
  }

  /**
   * Update user subscription after successful payment
   */
  private async updateUserSubscription(payment: IPayment): Promise<void> {
    try {
      const user = await User.findById(payment.userId);
      if (!user) {
        logger.error('User not found for payment', { paymentId: payment._id, userId: payment.userId });
        return;
      }

      const paymentPlan = this.getPaymentPlan(payment.plan, payment.billingCycle);
      if (!paymentPlan) {
        logger.error('Payment plan not found', { plan: payment.plan, billingCycle: payment.billingCycle });
        return;
      }

      // Calculate next billing date
      const nextBillingDate = new Date();
      if (payment.billingCycle === 'monthly') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      } else {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      }

      // Update user subscription
      user.subscription.plan = payment.plan;
      user.subscription.messageLimit = paymentPlan.messageLimit;
      user.subscription.isActive = true;
      user.subscription.billingCycle = payment.billingCycle;
      user.subscription.nextBillingDate = nextBillingDate;
      user.subscription.cancelAtPeriodEnd = false;
      user.subscription.razorpayCustomerId = payment.razorpayPaymentId;

      await user.save();

      logger.info('User subscription updated successfully', {
        userId: user._id,
        plan: payment.plan,
        nextBillingDate
      });

    } catch (error: any) {
      logger.error('Failed to update user subscription', {
        paymentId: payment._id,
        userId: payment.userId,
        error: error.message
      });
    }
  }

  /**
   * Handle Razorpay webhook events
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    try {
      logger.info('Processing Razorpay webhook', {
        event: event.event,
        entity: event.entity
      });

      switch (event.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(event);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(event);
          break;
        case 'subscription.activated':
          await this.handleSubscriptionActivated(event);
          break;
        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(event);
          break;
        case 'subscription.charged':
          await this.handleSubscriptionCharged(event);
          break;
        default:
          logger.info('Unhandled webhook event', { event: event.event });
      }

    } catch (error: any) {
      logger.error('Failed to process Razorpay webhook', {
        event: event.event,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private async handlePaymentCaptured(event: WebhookEvent): Promise<void> {
    const paymentData = event.payload.payment.entity;
    const orderId = paymentData.order_id;
    
    if (orderId) {
      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.status === 'pending') {
        await payment.markAsCompleted(paymentData);
        await this.updateUserSubscription(payment);
      }
    }
  }

  private async handlePaymentFailed(event: WebhookEvent): Promise<void> {
    const paymentData = event.payload.payment.entity;
    const orderId = paymentData.order_id;
    
    if (orderId) {
      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.status === 'pending') {
        await payment.markAsFailed(`Payment failed: ${paymentData.error_description || 'Unknown error'}`);
      }
    }
  }

  private async handleSubscriptionActivated(event: WebhookEvent): Promise<void> {
    const subscriptionData = event.payload.subscription?.entity;
    if (subscriptionData) {
      const payment = await Payment.findOne({ razorpaySubscriptionId: subscriptionData.id });
      if (payment) {
        await payment.markAsCompleted(subscriptionData);
        await this.updateUserSubscription(payment);
      }
    }
  }

  private async handleSubscriptionCancelled(event: WebhookEvent): Promise<void> {
    const subscriptionData = event.payload.subscription?.entity;
    if (subscriptionData) {
      const user = await User.findOne({ 'subscription.razorpaySubscriptionId': subscriptionData.id });
      if (user) {
        user.subscription.cancelAtPeriodEnd = true;
        await user.save();
        
        logger.info('Subscription marked for cancellation', {
          userId: user._id,
          subscriptionId: subscriptionData.id
        });
      }
    }
  }

  private async handleSubscriptionCharged(event: WebhookEvent): Promise<void> {
    const subscriptionData = event.payload.subscription?.entity;
    if (subscriptionData) {
      // Handle recurring subscription charges
      logger.info('Subscription charged successfully', {
        subscriptionId: subscriptionData.id,
        amount: subscriptionData.current_start
      });
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const matchStage: any = { status: 'completed' };
      
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
      }

      return await Payment.aggregate([
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
    } catch (error: any) {
      logger.error('Failed to get payment statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user payment history
   */
  async getUserPayments(userId: mongoose.Types.ObjectId, limit = 10): Promise<IPayment[]> {
    try {
      return await Payment.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'email name');
    } catch (error: any) {
      logger.error('Failed to get user payments', { userId, error: error.message });
      throw error;
    }
  }
}

export default new RazorpayService();
