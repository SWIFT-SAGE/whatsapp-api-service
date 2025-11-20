import { Router } from 'express';
import { body, param } from 'express-validator';
import ChatbotController from '../controllers/ChatbotController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All chatbot routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/chatbot/rules
 * @desc    Get all chatbot rules for the authenticated user
 * @access  Private
 */
router.get('/rules', ChatbotController.getRules);

/**
 * @route   GET /api/chatbot/rules/:id
 * @desc    Get a single chatbot rule by ID
 * @access  Private
 */
router.get('/rules/:id', [
    param('id').isMongoId().withMessage('Invalid rule ID')
], ChatbotController.getRule);

/**
 * @route   POST /api/chatbot/rules
 * @desc    Create a new chatbot rule
 * @access  Private
 */
router.post('/rules', [
    body('trigger')
        .trim()
        .notEmpty().withMessage('Trigger is required')
        .isLength({ max: 500 }).withMessage('Trigger cannot exceed 500 characters'),
    body('response')
        .trim()
        .notEmpty().withMessage('Response is required')
        .isLength({ max: 2000 }).withMessage('Response cannot exceed 2000 characters'),
    body('matchType')
        .optional()
        .isIn(['exact', 'contains', 'regex', 'startsWith']).withMessage('Invalid match type'),
    body('caseSensitive')
        .optional()
        .isBoolean().withMessage('caseSensitive must be a boolean'),
    body('priority')
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage('Priority must be between 0 and 100'),
    body('active')
        .optional()
        .isBoolean().withMessage('active must be a boolean')
], ChatbotController.createRule);

/**
 * @route   PUT /api/chatbot/rules/:id
 * @desc    Update a chatbot rule
 * @access  Private
 */
router.put('/rules/:id', [
    param('id').isMongoId().withMessage('Invalid rule ID'),
    body('trigger')
        .optional()
        .trim()
        .notEmpty().withMessage('Trigger cannot be empty')
        .isLength({ max: 500 }).withMessage('Trigger cannot exceed 500 characters'),
    body('response')
        .optional()
        .trim()
        .notEmpty().withMessage('Response cannot be empty')
        .isLength({ max: 2000 }).withMessage('Response cannot exceed 2000 characters'),
    body('matchType')
        .optional()
        .isIn(['exact', 'contains', 'regex', 'startsWith']).withMessage('Invalid match type'),
    body('caseSensitive')
        .optional()
        .isBoolean().withMessage('caseSensitive must be a boolean'),
    body('priority')
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage('Priority must be between 0 and 100'),
    body('active')
        .optional()
        .isBoolean().withMessage('active must be a boolean')
], ChatbotController.updateRule);

/**
 * @route   DELETE /api/chatbot/rules/:id
 * @desc    Delete a chatbot rule
 * @access  Private
 */
router.delete('/rules/:id', [
    param('id').isMongoId().withMessage('Invalid rule ID')
], ChatbotController.deleteRule);

/**
 * @route   POST /api/chatbot/rules/:id/toggle
 * @desc    Toggle a chatbot rule's active status
 * @access  Private
 */
router.post('/rules/:id/toggle', [
    param('id').isMongoId().withMessage('Invalid rule ID')
], ChatbotController.toggleRule);

/**
 * @route   POST /api/chatbot/test
 * @desc    Test a message against chatbot rules
 * @access  Private
 */
router.post('/test', [
    body('message')
        .trim()
        .notEmpty().withMessage('Message is required')
        .isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters')
], ChatbotController.testMessage);

export default router;
