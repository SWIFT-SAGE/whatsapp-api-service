import { Request, Response } from 'express';
import { IUser } from '../models/User';
import User from '../models/User';
import Payment from '../models/Payment';
import MessageLog from '../models/MessageLog';
import Bot from '../models/Bot';
import { logger } from '../utils/logger';
import PDFDocument from 'pdfkit';

export class BillingController {
  /**
   * Get current user's usage statistics
   */
  async getUsageStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;

      // Get user with subscription info
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      // Get message count for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const messageCount = await MessageLog.countDocuments({
        userId,
        createdAt: { $gte: startOfMonth }
      });

      // Get bot message count
      const botMessageCount = user.subscription.botMessageCount || 0;

      // Get active chatbots count
      const chatbotCount = await Bot.countDocuments({
        userId,
        isActive: true
      });

      // Calculate usage percentages
      const messageLimit = user.subscription.messageLimit;
      const botMessageLimit = user.subscription.botMessageLimit;
      const chatbotLimit = user.subscription.chatbotLimit;

      const messageUsagePercent = messageLimit === -1 ? 0 : 
        Math.min((messageCount / messageLimit) * 100, 100);
      
      const botMessageUsagePercent = botMessageLimit === 0 ? 0 : 
        Math.min((botMessageCount / botMessageLimit) * 100, 100);

      res.json({
        success: true,
        data: {
          messageCount,
          messageLimit,
          messageUsagePercent: Math.round(messageUsagePercent),
          botMessageCount,
          botMessageLimit,
          botMessageUsagePercent: Math.round(botMessageUsagePercent),
          chatbotCount,
          chatbotLimit,
          period: {
            start: startOfMonth,
            end: new Date()
          }
        }
      });

    } catch (error: any) {
      logger.error('Failed to get usage stats', {
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve usage statistics'
      });
    }
  }

  /**
   * Generate and download invoice for a payment
   */
  async generateInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const userId = (req.user as IUser)._id;

      // Get payment details
      const payment = await Payment.findOne({
        _id: paymentId,
        userId
      }).populate('userId', 'email name profile');

      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'Payment not found'
        });
        return;
      }

      if (payment.status !== 'completed') {
        res.status(400).json({
          success: false,
          error: 'Invoice can only be generated for completed payments'
        });
        return;
      }

      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${payment._id}.pdf`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add company header
      doc
        .fontSize(20)
        .text('WhatsApp API Service', 50, 50)
        .fontSize(10)
        .text('Invoice', 50, 80)
        .moveDown();

      // Add invoice details
      doc
        .fontSize(10)
        .text(`Invoice #: ${payment._id}`, 50, 120)
        .text(`Date: ${new Date(payment.createdAt).toLocaleDateString()}`, 50, 135)
        .text(`Status: ${payment.status.toUpperCase()}`, 50, 150)
        .moveDown();

      // Add customer details
      const user = payment.userId as any;
      doc
        .fontSize(12)
        .text('Bill To:', 50, 180)
        .fontSize(10)
        .text(user.name || 'N/A', 50, 200)
        .text(user.email || 'N/A', 50, 215);

      if (user.profile?.company) {
        doc.text(user.profile.company, 50, 230);
      }

      // Add line
      doc
        .moveTo(50, 260)
        .lineTo(550, 260)
        .stroke();

      // Add table header
      doc
        .fontSize(10)
        .text('Description', 50, 280, { width: 250 })
        .text('Plan', 320, 280, { width: 100 })
        .text('Amount', 450, 280, { width: 100, align: 'right' });

      // Add line
      doc
        .moveTo(50, 300)
        .lineTo(550, 300)
        .stroke();

      // Add payment details
      const description = payment.description || 
        `${payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1)} Plan - ${payment.billingCycle}`;
      
      doc
        .fontSize(10)
        .text(description, 50, 320, { width: 250 })
        .text(payment.plan.toUpperCase(), 320, 320, { width: 100 })
        .text(`${payment.currency} ${payment.amount.toFixed(2)}`, 450, 320, { width: 100, align: 'right' });

      // Add line
      doc
        .moveTo(50, 350)
        .lineTo(550, 350)
        .stroke();

      // Add total
      doc
        .fontSize(12)
        .text('Total:', 350, 370)
        .text(`${payment.currency} ${payment.amount.toFixed(2)}`, 450, 370, { width: 100, align: 'right' });

      // Add payment method
      doc
        .fontSize(10)
        .text(`Payment Method: ${payment.razorpayPaymentId ? 'Razorpay' : 'N/A'}`, 50, 420);

      if (payment.razorpayPaymentId) {
        doc.text(`Transaction ID: ${payment.razorpayPaymentId}`, 50, 435);
      }

      // Add footer
      doc
        .fontSize(8)
        .text('Thank you for your business!', 50, 700, { align: 'center' })
        .text('For support, contact: support@whatsappapi.com', 50, 715, { align: 'center' });

      // Finalize PDF
      doc.end();

      logger.info('Invoice generated', {
        userId,
        paymentId: payment._id
      });

    } catch (error: any) {
      logger.error('Failed to generate invoice', {
        paymentId: req.params.paymentId,
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate invoice'
      });
    }
  }

  /**
   * Get billing summary
   */
  async getBillingSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;

      // Get user with subscription
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      // Get total spent
      const totalSpent = await Payment.aggregate([
        {
          $match: {
            userId: userId,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get latest payment
      const latestPayment = await Payment.findOne({
        userId,
        status: 'completed'
      }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: {
          subscription: user.subscription,
          totalSpent: totalSpent[0]?.total || 0,
          totalPayments: totalSpent[0]?.count || 0,
          latestPayment: latestPayment ? {
            id: latestPayment._id,
            amount: latestPayment.amount,
            currency: latestPayment.currency,
            date: latestPayment.createdAt,
            plan: latestPayment.plan
          } : null
        }
      });

    } catch (error: any) {
      logger.error('Failed to get billing summary', {
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve billing summary'
      });
    }
  }

  /**
   * Get upcoming invoice preview
   */
  async getUpcomingInvoice(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id;

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      if (user.subscription.plan === 'free') {
        res.json({
          success: true,
          data: {
            hasUpcoming: false,
            message: 'No upcoming invoice for free plan'
          }
        });
        return;
      }

      // Calculate next invoice amount based on plan
      const planPrices = {
        basic: {
          monthly: 29.99,
          yearly: 299.99
        },
        pro: {
          monthly: 99.99,
          yearly: 999.99
        }
      };

      const plan = user.subscription.plan as 'basic' | 'pro';
      const cycle = user.subscription.billingCycle;
      const amount = planPrices[plan]?.[cycle] || 0;

      res.json({
        success: true,
        data: {
          hasUpcoming: true,
          amount,
          currency: 'USD',
          plan: user.subscription.plan,
          billingCycle: cycle,
          nextBillingDate: user.subscription.nextBillingDate,
          willCancel: user.subscription.cancelAtPeriodEnd
        }
      });

    } catch (error: any) {
      logger.error('Failed to get upcoming invoice', {
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve upcoming invoice'
      });
    }
  }

  /**
   * Update payment method (placeholder for future implementation)
   */
  async updatePaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      // This would integrate with Razorpay to update payment method
      res.json({
        success: false,
        message: 'Payment method update not yet implemented'
      });

    } catch (error: any) {
      logger.error('Failed to update payment method', {
        userId: (req.user as IUser)?._id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update payment method'
      });
    }
  }
}

export default new BillingController();

