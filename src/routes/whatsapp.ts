import express from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import WhatsAppController from '../controllers/whatsappController';
import { authenticateToken, requireVerification } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and documents
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Validation rules
const createSessionValidation = [
  body('name').isLength({ min: 1 }).withMessage('Session name is required'),
  body('webhookUrl').optional().isURL().withMessage('Webhook URL must be valid'),
  body('settings.autoReplyMessage').optional().isLength({ max: 500 }).withMessage('Auto reply message too long')
];

const sendMessageValidation = [
  param('sessionId').notEmpty().withMessage('Session ID is required'),
  body('to').notEmpty().withMessage('Recipient is required'),
  body('message').isLength({ min: 1, max: 4096 }).withMessage('Message must be 1-4096 characters')
];

const sendMediaValidation = [
  param('sessionId').notEmpty().withMessage('Session ID is required'),
  body('to').notEmpty().withMessage('Recipient is required'),
  body('caption').optional().isLength({ max: 1024 }).withMessage('Caption too long')
];

const getMessagesValidation = [
  param('sessionId').notEmpty().withMessage('Session ID is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('contact').optional().notEmpty().withMessage('Contact cannot be empty if provided')
];

const updateSessionValidation = [
  param('sessionId').notEmpty().withMessage('Session ID is required'),
  body('webhookUrl').optional().isURL().withMessage('Webhook URL must be valid'),
  body('settings.autoReplyMessage').optional().isLength({ max: 500 }).withMessage('Auto reply message too long')
];

// Apply authentication middleware to all routes
router.use(authenticateToken);
// Temporarily disable verification requirement for testing
// router.use(requireVerification);

// Session management routes
router.post('/sessions', createSessionValidation, WhatsAppController.createSession);
router.get('/sessions', WhatsAppController.getSessions);
router.get('/sessions/:sessionId', WhatsAppController.getSession);
router.get('/sessions/:sessionId/qr', WhatsAppController.getQRCode);
router.put('/sessions/:sessionId', updateSessionValidation, WhatsAppController.updateSession);
router.delete('/sessions/:sessionId', WhatsAppController.deleteSession);

// Message routes
router.post('/sessions/:sessionId/messages', sendMessageValidation, WhatsAppController.sendMessage);
router.post('/sessions/:sessionId/media', upload.single('media'), sendMediaValidation, WhatsAppController.sendMedia);
router.get('/sessions/:sessionId/messages', getMessagesValidation, WhatsAppController.getMessages);

export default router;
