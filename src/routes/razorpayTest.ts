import express from 'express';
import razorpayTestController from '../controllers/razorpayTestController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/test/razorpay/config
 * @desc    Test Razorpay configuration
 * @access  Private
 */
router.get('/config', authenticateToken, razorpayTestController.testConfiguration);

/**
 * @route   POST /api/test/razorpay/order
 * @desc    Test creating a Razorpay order
 * @access  Private
 */
router.post('/order', authenticateToken, razorpayTestController.testOrderCreation);

export default router;
