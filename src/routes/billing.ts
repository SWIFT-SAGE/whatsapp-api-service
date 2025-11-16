import express from 'express';
import { param } from 'express-validator';
import BillingController from '../controllers/BillingController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/billing/usage
 * @desc    Get current usage statistics
 * @access  Private
 */
router.get('/usage', BillingController.getUsageStats);

/**
 * @route   GET /api/billing/summary
 * @desc    Get billing summary
 * @access  Private
 */
router.get('/summary', BillingController.getBillingSummary);

/**
 * @route   GET /api/billing/upcoming
 * @desc    Get upcoming invoice preview
 * @access  Private
 */
router.get('/upcoming', BillingController.getUpcomingInvoice);

/**
 * @route   GET /api/billing/invoice/:paymentId
 * @desc    Generate and download invoice PDF
 * @access  Private
 */
router.get(
  '/invoice/:paymentId',
  [
    param('paymentId')
      .isMongoId()
      .withMessage('Invalid payment ID format')
  ],
  BillingController.generateInvoice
);

/**
 * @route   POST /api/billing/payment-method
 * @desc    Update payment method
 * @access  Private
 */
router.post('/payment-method', BillingController.updatePaymentMethod);

export default router;

