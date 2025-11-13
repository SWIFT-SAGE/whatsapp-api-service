import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import razorpayService from '../services/razorpayService';
import Payment from '../models/Payment';
import User, { IUser } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class RazorpayController {
  /**
   * Get available payment plans
   */
  async getPaymentPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = razorpayService.getAllPaymentPlans();
      
      res.status(200).json({
        success: true,
        data: {
          plans,
          currency: 'INR'
        }
      });
    } catch (error: any) {
      logger.error('Failed to get payment plans', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment plans',
        error: error.message
      });
    }
  }

  /**
   * Create a Razorpay payment order
   */
  async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      if (!razorpayService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'Payment service is not configured. Please contact support.'
        });
        return;
      }

      const { plan, billingCycle, type = 'subscription', promoCode } = req.body;
      const userId = (req.user as IUser)._id;

      // Validate plan exists
      const paymentPlan = razorpayService.getPaymentPlan(plan, billingCycle);
      if (!paymentPlan) {
        res.status(400).json({
          success: false,
          message: `Invalid payment plan: ${plan}_${billingCycle}`
        });
        return;
      }

      // Check if user exists and get current subscription
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Prevent downgrading (optional business logic)
      const planHierarchy = { 'free': 0, 'basic': 1, 'pro': 2 };
      const currentPlanLevel = planHierarchy[user.subscription.plan as keyof typeof planHierarchy] || 0;
      const newPlanLevel = planHierarchy[plan as keyof typeof planHierarchy] || 0;
      
      if (currentPlanLevel > newPlanLevel) {
        res.status(400).json({
          success: false,
          message: `Cannot downgrade from ${user.subscription.plan} to ${plan} plan. Please contact support.`
        });
        return;
      }

      const paymentOptions = {
        userId,
        plan: plan as 'basic' | 'pro',
        billingCycle: billingCycle as 'monthly' | 'yearly',
        type: type as 'one_time' | 'subscription' | 'upgrade' | 'renewal',
        promoCode
      };

      const result = await razorpayService.createOrder(paymentOptions);

      logger.info('Razorpay payment created', {
        userId,
        plan,
        billingCycle,
        type,
        orderId: result.orderId
      });

      res.status(201).json({
        success: true,
        message: 'Payment order created successfully',
        data: {
          paymentId: result.payment._id,
          orderId: result.orderId,
          amount: result.payment.amount,
          currency: result.payment.currency,
          plan: paymentPlan,
          razorpayKeyId: process.env.RAZORPAY_KEY_ID // Frontend needs this for checkout
        }
      });

    } catch (error: any) {
      logger.error('Failed to create Razorpay payment', {
        userId: (req.user as IUser)?._id,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create payment order',
        error: error.message
      });
    }
  }

  /**
   * Verify and capture payment
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({
          success: false,
          message: 'Missing required payment verification parameters'
        });
        return;
      }

      if (!razorpayService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'Payment service is not configured'
        });
        return;
      }

      const result = await razorpayService.capturePayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (result.success && result.payment) {
        logger.info('Payment verified and captured successfully', {
          orderId: razorpay_order_id,
          paymentId: result.payment._id,
          userId: result.payment.userId
        });

        res.status(200).json({
          success: true,
          message: 'Payment completed successfully',
          data: {
            paymentId: result.payment._id,
            plan: result.payment.plan,
            amount: result.payment.amount,
            status: result.payment.status
          }
        });
      } else {
        logger.error('Payment verification failed', {
          orderId: razorpay_order_id,
          paymentId: result.payment?._id
        });

        res.status(400).json({
          success: false,
          message: 'Payment verification failed'
        });
      }

    } catch (error: any) {
      logger.error('Failed to verify payment', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
        error: error.message
      });
    }
  }

  /**
   * Handle Razorpay webhook events
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookEvent = req.body;

      // Verify webhook signature (implement based on Razorpay documentation)
      // This is a simplified version - in production, verify the webhook signature
      
      await razorpayService.handleWebhook(webhookEvent);

      logger.info('Razorpay webhook processed successfully', {
        event: webhookEvent.event,
        entity: webhookEvent.entity
      });

      res.status(200).json({ success: true });

    } catch (error: any) {
      logger.error('Failed to process Razorpay webhook', {
        event: req.body?.event,
        entity: req.body?.entity,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        message: 'Webhook processing failed'
      });
    }
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;
      const limit = parseInt(req.query.limit as string) || 10;
      const page = parseInt(req.query.page as string) || 1;
      const skip = (page - 1) * limit;

      const payments = await Payment.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-razorpayResponse'); // Exclude sensitive Razorpay response data

      const totalPayments = await Payment.countDocuments({ userId });
      const totalPages = Math.ceil(totalPayments / limit);

      res.status(200).json({
        success: true,
        data: {
          payments,
          pagination: {
            currentPage: page,
            totalPages,
            totalPayments,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      });

    } catch (error: any) {
      logger.error('Failed to get payment history', {
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment history',
        error: error.message
      });
    }
  }

  /**
   * Get payment details by ID
   */
  async getPaymentDetails(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const userId = (req.user as IUser)._id;

      if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
        return;
      }

      const payment = await Payment.findOne({
        _id: paymentId,
        userId
      }).select('-razorpayResponse');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { payment }
      });

    } catch (error: any) {
      logger.error('Failed to get payment details', {
        paymentId: req.params.paymentId,
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment details',
        error: error.message
      });
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;
      const { reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      if (!user.subscription.razorpaySubscriptionId) {
        res.status(400).json({
          success: false,
          message: 'No active subscription found'
        });
        return;
      }

      // Mark subscription for cancellation at period end
      user.subscription.cancelAtPeriodEnd = true;
      await user.save();

      logger.info('Subscription marked for cancellation', {
        userId,
        subscriptionId: user.subscription.razorpaySubscriptionId,
        reason
      });

      res.status(200).json({
        success: true,
        message: 'Subscription will be cancelled at the end of the current billing period',
        data: {
          cancelAtPeriodEnd: true,
          nextBillingDate: user.subscription.nextBillingDate
        }
      });

    } catch (error: any) {
      logger.error('Failed to cancel subscription', {
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to cancel subscription',
        error: error.message
      });
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      if (!user.subscription.cancelAtPeriodEnd) {
        res.status(400).json({
          success: false,
          message: 'Subscription is not scheduled for cancellation'
        });
        return;
      }

      // Remove cancellation flag
      user.subscription.cancelAtPeriodEnd = false;
      await user.save();

      logger.info('Subscription reactivated', {
        userId,
        subscriptionId: user.subscription.razorpaySubscriptionId
      });

      res.status(200).json({
        success: true,
        message: 'Subscription reactivated successfully',
        data: {
          cancelAtPeriodEnd: false,
          nextBillingDate: user.subscription.nextBillingDate
        }
      });

    } catch (error: any) {
      logger.error('Failed to reactivate subscription', {
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to reactivate subscription',
        error: error.message
      });
    }
  }

  /**
   * Get payment statistics (admin only)
   */
  async getPaymentStats(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const stats = await razorpayService.getPaymentStats(start, end);

      res.status(200).json({
        success: true,
        data: { stats }
      });

    } catch (error: any) {
      logger.error('Failed to get payment statistics', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment statistics',
        error: error.message
      });
    }
  }
}

export default new RazorpayController();
