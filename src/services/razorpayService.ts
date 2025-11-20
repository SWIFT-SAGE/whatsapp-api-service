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
  features: string[];
}

interface CreatePaymentOptions {
  userId: mongoose.Types.ObjectId;
  plan: 'basic' | 'pro' | 'premium';
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
  private razorpay: Razorpay | null = null;
  private config: RazorpayConfig;
  private isInitialized: boolean = false;

  // Predefined payment plans with Premium added
  private readonly PAYMENT_PLANS: Record<string, PaymentPlan> = {
    'basic_monthly': {
      id: 'basic_monthly',
      name: 'Basic Plan - Monthly',
      price: 210000, // ₹2,100.00 ($25 × ₹84)
      currency: 'INR',
      interval: 'month',
      messageLimit: 100000,
      features: ['100,000 API messages', '1 chatbot', 'Basic support']
    },
    'basic_yearly': {
      id: 'basic_yearly',
      name: 'Basic Plan - Yearly',
      price: 2268000, // ₹22,680.00 ($270 × ₹84 - 10% discount)
      currency: 'INR',
      interval: 'year',
      messageLimit: 100000,
      features: ['100,000 API messages', '1 chatbot', 'Basic support', '10% savings']
    },
    'pro_monthly': {
      id: 'pro_monthly',
      name: 'Pro Plan - Monthly',
      price: 336000, // ₹3,360.00 ($40 × ₹84)
      currency: 'INR',
      interval: 'month',
      messageLimit: -1,
      features: ['Unlimited API messages', '10,000 bot messages', '2 chatbots', 'Priority support']
    },
    'pro_yearly': {
      id: 'pro_yearly',
      name: 'Pro Plan - Yearly',
      price: 3628800, // ₹36,288.00 ($432 × ₹84 - 10% discount)
      currency: 'INR',
      interval: 'year',
      messageLimit: -1,
      features: ['Unlimited API messages', '10,000 bot messages', '2 chatbots', 'Priority support', '10% savings']
    },
    'premium_monthly': {
      id: 'premium_monthly',
      name: 'Premium Plan - Monthly',
      price: 500000, // ₹5,000.00
      currency: 'INR',
      interval: 'month',
      messageLimit: -1,
      features: ['Unlimited everything', 'Unlimited chatbots', 'Dedicated support', 'Custom integrations']
    },
    'premium_yearly': {
      id: 'premium_yearly',
      name: 'Premium Plan - Yearly',
      price: 5400000, // ₹54,000.00 (10% discount)
      currency: 'INR',
      interval: 'year',
      messageLimit: -1,
      features: ['Unlimited everything', 'Unlimited chatbots', 'Dedicated support', 'Custom integrations', '10% savings']
    }
  };

  constructor() {
    this.config = {
      keyId: process.env.RAZORPAY_KEY_ID?.trim() || '',
      keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
      environment: (process.env.RAZORPAY_ENVIRONMENT as 'test' | 'live') || 'test'
    };

    this.initialize();
  }

  /**
   * Initialize Razorpay instance with validation
   */
  private initialize(): void {
    // Validate credentials format
    if (!this.config.keyId || !this.config.keySecret) {
      logger.warn('Razorpay credentials not configured. Payment functionality will be disabled.', {
        keyIdPresent: !!this.config.keyId,
        keySecretPresent: !!this.config.keySecret
      });
      return;
    }

    // Validate key format
    const isTestMode = this.config.keyId.startsWith('rzp_test_');
    const isLiveMode = this.config.keyId.startsWith('rzp_live_');

    if (!isTestMode && !isLiveMode) {
      logger.error('Invalid Razorpay Key ID format. Must start with rzp_test_ or rzp_live_', {
        keyIdPrefix: this.config.keyId.substring(0, 8)
      });
      return;
    }

    // Check environment mismatch
    if (this.config.environment === 'test' && !isTestMode) {
      logger.error('Environment set to TEST but using LIVE key', {
        environment: this.config.environment,
        keyIdPrefix: this.config.keyId.substring(0, 12)
      });
      return;
    }

    if (this.config.environment === 'live' && !isLiveMode) {
      logger.error('Environment set to LIVE but using TEST key', {
        environment: this.config.environment,
        keyIdPrefix: this.config.keyId.substring(0, 12)
      });
      return;
    }

    try {
      this.razorpay = new Razorpay({
        key_id: this.config.keyId,
        key_secret: this.config.keySecret
      });

      this.isInitialized = true;

      logger.info('✅ Razorpay service initialized successfully', {
        environment: this.config.environment,
        keyIdPrefix: this.config.keyId.substring(0, 12),
        keyIdLength: this.config.keyId.length,
        keySecretLength: this.config.keySecret.length
      });
    } catch (error: any) {
      logger.error('Failed to initialize Razorpay service', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Check if Razorpay is properly configured and initialized
   */
  isConfigured(): boolean {
    return this.isInitialized && this.razorpay !== null;
  }

  /**
   * Get payment plan details
   */
  getPaymentPlan(plan: 'basic' | 'pro' | 'premium', billingCycle: 'monthly' | 'yearly'): PaymentPlan | null {
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
      'YEARLY50': 50,
      'PREMIUM15': 15
    };

    const discountPercent = promoCodes[promoCode.toUpperCase()] || 0;
    return Math.round((amount * discountPercent) / 100);
  }

  /**
   * Create a Razorpay order for payment
   */
  async createOrder(options: CreatePaymentOptions): Promise<{ orderId: string; payment: IPayment; amount: number; currency: string }> {
    if (!this.isConfigured()) {
      throw new Error('Razorpay service is not properly configured. Please check your API credentials.');
    }

    try {
      // Log configuration (debugging)
      logger.info('Creating Razorpay order', {
        plan: options.plan,
        billingCycle: options.billingCycle,
        environment: this.config.environment,
        keyIdPrefix: this.config.keyId.substring(0, 12)
      });

      // Get payment plan
      const paymentPlan = this.getPaymentPlan(options.plan, options.billingCycle);
      if (!paymentPlan) {
        throw new Error(`Invalid payment plan: ${options.plan}_${options.billingCycle}`);
      }

      // Calculate final amount
      const discount = this.calculateDiscount(paymentPlan.price, options.promoCode);
      const finalAmount = Math.max(0, paymentPlan.price - discount);

      // Create payment record
      const payment = new Payment({
        userId: options.userId,
        razorpayOrderId: '',
        amount: finalAmount / 100, // Convert paise to rupees
        currency: paymentPlan.currency,
        status: 'pending',
        type: options.type,
        plan: options.plan,
        billingCycle: options.billingCycle,
        description: `${paymentPlan.name} - ${options.type}`,
        metadata: {
          promoCode: options.promoCode,
          discount: discount / 100,
          originalAmount: paymentPlan.price / 100
        }
      });

      // Create Razorpay order
      const orderOptions = {
        amount: finalAmount, // Amount in paise
        currency: paymentPlan.currency,
        receipt: `rcpt_${Date.now()}_${payment._id.toString().substring(0, 8)}`,
        notes: {
          userId: options.userId.toString(),
          paymentId: payment._id.toString(),
          plan: options.plan,
          billingCycle: options.billingCycle,
          type: options.type
        }
      };

      logger.info('Creating Razorpay order with options', {
        amount: finalAmount,
        currency: paymentPlan.currency,
        receipt: orderOptions.receipt
      });

      const razorpayOrder = await this.razorpay!.orders.create(orderOptions);

      // Update payment with Razorpay order ID
      payment.razorpayOrderId = razorpayOrder.id;
      await payment.save();

      logger.info('✅ Razorpay order created successfully', {
        orderId: razorpayOrder.id,
        amount: finalAmount,
        plan: options.plan,
        userId: options.userId
      });

      return {
        orderId: razorpayOrder.id,
        payment,
        amount: finalAmount,
        currency: paymentPlan.currency
      };

    } catch (error: any) {
      // Enhanced error logging
      logger.error('❌ Failed to create Razorpay order', {
        errorMessage: error.message,
        errorDescription: error.description,
        errorCode: error.error?.code,
        errorStatusCode: error.statusCode,
        errorField: error.field,
        errorReason: error.reason,
        errorSource: error.source,
        errorStep: error.step,
        plan: options.plan,
        billingCycle: options.billingCycle,
        environment: this.config.environment,
        keyIdPrefix: this.config.keyId.substring(0, 12),
        fullError: JSON.stringify(error, null, 2),
        stack: error.stack
      });

      // Provide user-friendly error messages
      if (error.statusCode === 401 || error.error?.code === 'BAD_REQUEST_ERROR') {
        throw new Error('Razorpay authentication failed. Please verify your API keys are correct and match your environment (test/live).');
      }

      if (error.statusCode === 400) {
        throw new Error(`Invalid request to Razorpay: ${error.description || error.message}`);
      }

      throw new Error(`Razorpay order creation failed: ${error.message || error.description || 'Unknown error'}`);
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

      const isValid = expectedSignature === signature;

      logger.info('Payment signature verification', {
        orderId,
        paymentId,
        isValid
      });

      return isValid;
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
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error: any) {
      logger.error('Failed to verify webhook signature', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Capture payment after verification
   */
  async capturePayment(
    orderId: string,
    paymentId: string,
    signature: string
  ): Promise<{ success: boolean; payment: IPayment | null; razorpayResponse?: any }> {
    try {
      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) {
        throw new Error(`Payment not found for order ID: ${orderId}`);
      }

      // Verify signature
      if (!this.verifyPaymentSignature(orderId, paymentId, signature)) {
        await payment.markAsFailed('Invalid payment signature');
        logger.error('Payment signature verification failed', { orderId, paymentId });
        return {
          success: false,
          payment
        };
      }

      // Fetch payment details from Razorpay
      const razorpayPayment = await this.razorpay!.payments.fetch(paymentId);

      logger.info('Fetched payment from Razorpay', {
        paymentId,
        status: razorpayPayment.status,
        amount: razorpayPayment.amount
      });

      if (razorpayPayment.status === 'captured' || razorpayPayment.status === 'authorized') {
        // Mark payment as completed
        await payment.markAsCompleted(razorpayPayment);

        // Update user subscription
        await this.updateUserSubscription(payment);

        logger.info('✅ Payment captured successfully', {
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
        await payment.markAsFailed(`Payment not captured. Status: ${razorpayPayment.status}`);

        logger.error('Payment capture failed', {
          orderId,
          paymentId,
          status: razorpayPayment.status
        });

        return {
          success: false,
          payment
        };
      }

    } catch (error: any) {
      logger.error('Failed to capture payment', {
        orderId,
        paymentId,
        error: error.message,
        stack: error.stack
      });

      // Try to mark payment as failed
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
        logger.error('User not found for payment', {
          paymentId: payment._id,
          userId: payment.userId
        });
        return;
      }

      const paymentPlan = this.getPaymentPlan(payment.plan, payment.billingCycle);
      if (!paymentPlan) {
        logger.error('Payment plan not found', {
          plan: payment.plan,
          billingCycle: payment.billingCycle
        });
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

      logger.info('✅ User subscription updated successfully', {
        userId: user._id,
        plan: payment.plan,
        billingCycle: payment.billingCycle,
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
  async handleWebhook(event: WebhookEvent, signature: string, webhookSecret: string): Promise<void> {
    try {
      // Verify webhook signature
      const isValidSignature = this.verifyWebhookSignature(
        JSON.stringify(event),
        signature,
        webhookSecret
      );

      if (!isValidSignature) {
        logger.error('Invalid webhook signature received');
        throw new Error('Invalid webhook signature');
      }

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
      logger.error('Failed to process webhook', {
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
        logger.info('Webhook: Payment captured', { orderId });
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
        logger.info('Webhook: Payment failed', { orderId });
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
        logger.info('Webhook: Subscription activated', { subscriptionId: subscriptionData.id });
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
        logger.info('Webhook: Subscription cancelled', { subscriptionId: subscriptionData.id });
      }
    }
  }

  private async handleSubscriptionCharged(event: WebhookEvent): Promise<void> {
    const subscriptionData = event.payload.subscription?.entity;
    if (subscriptionData) {
      logger.info('Webhook: Subscription charged', { subscriptionId: subscriptionData.id });
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

  /**
   * Test Razorpay connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Razorpay is not configured properly'
      };
    }

    try {
      // Try to fetch a non-existent order to test authentication
      await this.razorpay!.orders.fetch('order_test_123');
    } catch (error: any) {
      // 400 or 404 means authentication works (order not found)
      if (error.statusCode === 400 || error.statusCode === 404) {
        return {
          success: true,
          message: 'Razorpay authentication successful',
          details: {
            environment: this.config.environment,
            keyIdPrefix: this.config.keyId.substring(0, 12)
          }
        };
      }

      // 401 means authentication failed
      if (error.statusCode === 401) {
        return {
          success: false,
          message: 'Razorpay authentication failed. Check your API keys.',
          details: {
            error: error.message,
            environment: this.config.environment,
            keyIdPrefix: this.config.keyId.substring(0, 12)
          }
        };
      }

      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        details: { error: error.message }
      };
    }

    return {
      success: true,
      message: 'Connection test completed'
    };
  }
}

export default new RazorpayService();
