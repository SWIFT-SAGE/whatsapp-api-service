import express from 'express';
import { body, query } from 'express-validator';
import AnalyticsController from '../controllers/AnalyticsController';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';

const router = express.Router();

// Analytics routes are public for dashboard access
// Authentication removed to prevent JWT malformed errors

// Validation rules
const periodValidation = [
  query('period')
    .optional()
    .isIn(['24h', '7d', '30d', '90d'])
    .withMessage('Period must be one of: 24h, 7d, 30d, 90d')
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

const limitValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Routes

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard statistics
 * @access Private
 */
router.get('/dashboard', 
  periodValidation,
  handleValidationErrors,
  AnalyticsController.getDashboardStats
);

/**
 * @route GET /api/analytics/messages
 * @desc Get message analytics
 * @access Private
 */
router.get('/messages',
  [...dateRangeValidation, ...limitValidation],
  handleValidationErrors,
  AnalyticsController.getMessageAnalytics
);

/**
 * @route GET /api/analytics/contacts
 * @desc Get top contacts analytics
 * @access Private
 */
router.get('/contacts',
  [...periodValidation, ...limitValidation],
  handleValidationErrors,
  AnalyticsController.getTopContacts
);

/**
 * @route GET /api/analytics/sessions
 * @desc Get session analytics
 * @access Private
 */
router.get('/sessions',
  [...dateRangeValidation, ...limitValidation],
  handleValidationErrors,
  AnalyticsController.getSessionAnalytics
);

// Note: getCostAnalytics and exportAnalytics methods are not implemented in AnalyticsController
// These routes can be added when the corresponding controller methods are implemented

export default router;