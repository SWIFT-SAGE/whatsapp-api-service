import { Request, Response } from 'express';
import razorpayService from '../services/razorpayService';
import { logger } from '../utils/logger';

export class RazorpayTestController {
    /**
     * Test Razorpay configuration and credentials
     */
    async testConfiguration(req: Request, res: Response): Promise<void> {
        try {
            // Check if configured
            const isConfigured = razorpayService.isConfigured();

            if (!isConfigured) {
                res.status(503).json({
                    success: false,
                    message: 'Razorpay is not configured',
                    details: {
                        hasKeyId: !!process.env.RAZORPAY_KEY_ID,
                        hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
                        environment: process.env.RAZORPAY_ENVIRONMENT
                    }
                });
                return;
            }

            // Try to get payment plans (this doesn't require API call)
            const plans = razorpayService.getAllPaymentPlans();

            res.status(200).json({
                success: true,
                message: 'Razorpay is configured correctly',
                data: {
                    isConfigured: true,
                    environment: process.env.RAZORPAY_ENVIRONMENT,
                    keyIdPrefix: process.env.RAZORPAY_KEY_ID?.substring(0, 12) + '...',
                    availablePlans: plans.length,
                    plans: plans.map(p => ({
                        id: p.id,
                        name: p.name,
                        price: p.price / 100, // Convert paise to rupees
                        currency: p.currency
                    }))
                }
            });

        } catch (error: any) {
            logger.error('Razorpay test failed', {
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                message: 'Razorpay test failed',
                error: error.message
            });
        }
    }

    /**
     * Test creating a minimal Razorpay order
     */
    async testOrderCreation(req: Request, res: Response): Promise<void> {
        try {
            if (!razorpayService.isConfigured()) {
                res.status(503).json({
                    success: false,
                    message: 'Razorpay is not configured'
                });
                return;
            }

            // Access the private razorpay instance via a test method
            // We'll create a minimal order directly
            const Razorpay = require('razorpay');
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET
            });

            const testOrderOptions = {
                amount: 100, // ₹1.00 in paise
                currency: 'INR',
                receipt: `test_receipt_${Date.now()}`,
                notes: {
                    test: 'true',
                    purpose: 'API credential verification'
                }
            };

            logger.info('Testing Razorpay order creation with options:', testOrderOptions);

            const order = await razorpay.orders.create(testOrderOptions);

            logger.info('Test order created successfully', { orderId: order.id });

            res.status(200).json({
                success: true,
                message: 'Razorpay credentials are valid and working',
                data: {
                    orderId: order.id,
                    amount: order.amount,
                    currency: order.currency,
                    status: order.status
                }
            });

        } catch (error: any) {
            logger.error('Razorpay test order creation failed', {
                error: error.message,
                errorDescription: error.description,
                errorField: error.field,
                errorReason: error.reason,
                errorSource: error.source,
                errorStep: error.step,
                statusCode: error.statusCode,
                fullError: JSON.stringify(error, null, 2)
            });

            res.status(500).json({
                success: false,
                message: 'Razorpay test order creation failed',
                error: {
                    message: error.message,
                    description: error.description,
                    field: error.field,
                    reason: error.reason,
                    source: error.source,
                    step: error.step,
                    statusCode: error.statusCode
                }
            });
        }
    }
}

export default new RazorpayTestController();
