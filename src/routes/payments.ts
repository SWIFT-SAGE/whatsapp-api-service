import express from 'express';
import { body, param, query } from 'express-validator';
import razorpayController from '../controllers/razorpayController';
import { authenticateToken } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiter';

const router = express.Router();

// Validation schemas
const createPaymentValidation = [
  body('plan')
    .isIn(['basic', 'pro', 'enterprise'])
    .withMessage('Plan must be one of: basic, pro, enterprise'),
  body('billingCycle')
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be either monthly or yearly'),
  body('type')
    .optional()
    .isIn(['one_time', 'subscription', 'upgrade', 'renewal'])
    .withMessage('Type must be one of: one_time, subscription, upgrade, renewal'),
  body('promoCode')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Promo code must be between 3 and 50 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Promo code must contain only uppercase letters and numbers')
];

const paymentIdValidation = [
  param('paymentId')
    .isMongoId()
    .withMessage('Invalid payment ID format')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

const cancelSubscriptionValidation = [
  body('reason')
    .optional()
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be between 3 and 500 characters')
];

// Public routes (no authentication required)

/**
 * @route   GET /api/payments/plans
 * @desc    Get available payment plans
 * @access  Public
 */
router.get('/plans', razorpayController.getPaymentPlans);

/**
 * @route   GET /api/payments/paypal/success
 * @desc    Handle successful PayPal payment return
 * @access  Public (PayPal callback)
 */
router.get('/paypal/success', razorpayController.verifyPayment);

/**
 * @route   GET /api/payments/paypal/cancel
 * @desc    Handle cancelled PayPal payment return
 * @access  Public (PayPal callback)
 */
router.get('/paypal/cancel', razorpayController.handleWebhook);

/**
 * @route   POST /api/payments/paypal/webhook
 * @desc    Handle PayPal webhook events
 * @access  Public (PayPal webhook)
 */
router.post('/paypal/webhook', razorpayController.handleWebhook);

// Protected routes (authentication required)

/**
 * @route   POST /api/payments/create
 * @desc    Create a new PayPal payment
 * @access  Private
 */
router.post(
  '/create',
  authenticateToken,
  authRateLimit, // Strict rate limiting for payment creation
  createPaymentValidation,
  razorpayController.createPayment
);

/**
 * @route   GET /api/payments/history
 * @desc    Get user's payment history
 * @access  Private
 */
router.get(
  '/history',
  authenticateToken,
  paginationValidation,
  razorpayController.getPaymentHistory
);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Get payment details by ID
 * @access  Private
 */
router.get(
  '/:paymentId',
  authenticateToken,
  paymentIdValidation,
  razorpayController.getPaymentDetails
);

/**
 * @route   POST /api/payments/subscription/cancel
 * @desc    Cancel user's subscription
 * @access  Private
 */
router.post(
  '/subscription/cancel',
  authenticateToken,
  authRateLimit,
  cancelSubscriptionValidation,
  razorpayController.cancelSubscription
);

/**
 * @route   POST /api/payments/subscription/reactivate
 * @desc    Reactivate user's subscription
 * @access  Private
 */
router.post(
  '/subscription/reactivate',
  authenticateToken,
  authRateLimit,
  razorpayController.reactivateSubscription
);

// Admin routes (additional admin middleware would be needed)

/**
 * @route   GET /api/payments/admin/stats
 * @desc    Get payment statistics (admin only)
 * @access  Private (Admin)
 * @note    Add admin middleware when implemented
 */
router.get(
  '/admin/stats',
  authenticateToken,
  // TODO: Add admin middleware here
  dateRangeValidation,
  razorpayController.getPaymentStats
);

export default router;
