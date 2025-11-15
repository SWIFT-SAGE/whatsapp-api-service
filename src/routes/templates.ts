import { Router } from 'express';
import TemplateController from '../controllers/TemplateController';
import { authenticateToken } from '../middleware/auth';
import { body, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import rateLimit from 'express-rate-limit';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Create rate limiter helper
const rateLimiter = (options: { windowMs: number; max: number }) => 
  rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
  });

// Validation rules
const createTemplateValidation = [
  body('name').trim().notEmpty().withMessage('Template name is required'),
  body('type').isIn(['text', 'media', 'button', 'list', 'interactive']).withMessage('Invalid template type'),
  body('category').optional().isIn(['marketing', 'transactional', 'notification', 'custom']),
  body('content').isObject().withMessage('Content must be an object'),
  body('content.text').optional().isString(),
  body('content.mediaUrl').optional().isURL(),
  body('variables').optional().isArray(),
];

const updateTemplateValidation = [
  body('name').optional().trim().notEmpty(),
  body('type').optional().isIn(['text', 'media', 'button', 'list', 'interactive']),
  body('category').optional().isIn(['marketing', 'transactional', 'notification', 'custom']),
  body('content').optional().isObject(),
  body('variables').optional().isArray(),
];

const sendTemplateValidation = [
  body('sessionId').trim().notEmpty().withMessage('Session ID is required'),
  body('to').custom((value) => {
    if (typeof value === 'string' && value.trim()) return true;
    if (Array.isArray(value) && value.length > 0) return true;
    throw new Error('Recipient(s) required');
  }),
  body('variables').optional().isObject(),
  body('delay').optional().isInt({ min: 1000, max: 10000 }),
];

const previewTemplateValidation = [
  body('variables').optional().isObject(),
];

// Get built-in templates (no rate limiting)
router.get('/built-in', TemplateController.getBuiltInTemplates);

// Create template
router.post(
  '/',
  rateLimiter({ windowMs: 60000, max: 30 }), // 30 requests per minute
  createTemplateValidation,
  handleValidationErrors,
  TemplateController.createTemplate
);

// Get all templates
router.get(
  '/',
  rateLimiter({ windowMs: 60000, max: 100 }),
  TemplateController.getTemplates
);

// Preview template
router.post(
  '/preview',
  rateLimiter({ windowMs: 60000, max: 50 }),
  previewTemplateValidation,
  handleValidationErrors,
  TemplateController.previewTemplate
);

// Send template message
router.post(
  '/send',
  rateLimiter({ windowMs: 60000, max: 20 }), // 20 sends per minute
  sendTemplateValidation,
  handleValidationErrors,
  TemplateController.sendTemplate
);

// Get template by ID
router.get(
  '/:id',
  rateLimiter({ windowMs: 60000, max: 100 }),
  TemplateController.getTemplateById
);

// Update template
router.put(
  '/:id',
  rateLimiter({ windowMs: 60000, max: 30 }),
  updateTemplateValidation,
  handleValidationErrors,
  TemplateController.updateTemplate
);

// Delete template
router.delete(
  '/:id',
  rateLimiter({ windowMs: 60000, max: 30 }),
  TemplateController.deleteTemplate
);

export default router;
