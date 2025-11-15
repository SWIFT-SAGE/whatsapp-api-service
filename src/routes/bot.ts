import express from 'express';
import BotController from '../controllers/BotController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all bots
router.get('/', BotController.getBots);

// Get bot by session
router.get('/session/:sessionId', BotController.getBotBySession);

// Create or update bot
router.post('/', BotController.saveBot);

// Delete bot
router.delete('/:botId', BotController.deleteBot);

// Toggle bot status
router.patch('/:botId/toggle', BotController.toggleBotStatus);

// Test bot
router.post('/test', BotController.testBot);

export default router;

