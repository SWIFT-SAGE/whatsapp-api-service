import { Request, Response } from 'express';
import BotService from '../services/BotService';
import { IUser } from '../models/User';
import { logger } from '../utils/logger';

export class BotController {
  /**
   * Get all bots for user
   */
  async getBots(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const bots = await BotService.getUserBots(userId);

      res.json({
        success: true,
        data: bots
      });
    } catch (error) {
      logger.error('Error getting bots:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve bots'
      });
    }
  }

  /**
   * Get bot by session
   */
  async getBotBySession(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { sessionId } = req.params;

      const bot = await BotService.getBotBySession(userId, sessionId);

      if (!bot) {
        res.status(404).json({
          success: false,
          error: 'Bot not found'
        });
        return;
      }

      res.json({
        success: true,
        data: bot
      });
    } catch (error) {
      logger.error('Error getting bot:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve bot'
      });
    }
  }

  /**
   * Create or update bot
   */
  async saveBot(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { sessionId, name, description, flows, defaultFlow, settings, isActive } = req.body;

      if (!sessionId || !name) {
        res.status(400).json({
          success: false,
          error: 'Session ID and bot name are required'
        });
        return;
      }

      const botData = {
        name,
        description,
        flows: flows || [],
        defaultFlow,
        settings: settings || {
          enableInGroups: false,
          enableForUnknown: true,
          fallbackMessage: 'Sorry, I didn\'t understand that. Type "help" for available commands.'
        },
        isActive: isActive !== undefined ? isActive : true
      };

      const bot = await BotService.saveBot(userId, sessionId, botData);

      res.json({
        success: true,
        message: 'Bot saved successfully',
        data: bot
      });
    } catch (error) {
      logger.error('Error saving bot:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save bot'
      });
    }
  }

  /**
   * Delete bot
   */
  async deleteBot(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { botId } = req.params;

      const success = await BotService.deleteBot(userId, botId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Bot not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Bot deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting bot:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete bot'
      });
    }
  }

  /**
   * Toggle bot status
   */
  async toggleBotStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { botId } = req.params;
      const { isActive } = req.body;

      if (isActive === undefined) {
        res.status(400).json({
          success: false,
          error: 'isActive field is required'
        });
        return;
      }

      const success = await BotService.toggleBotStatus(userId, botId, isActive);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Bot not found'
        });
        return;
      }

      res.json({
        success: true,
        message: `Bot ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      logger.error('Error toggling bot status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle bot status'
      });
    }
  }

  /**
   * Test bot with a message
   */
  async testBot(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { sessionId, message, chatId } = req.body;

      if (!sessionId || !message) {
        res.status(400).json({
          success: false,
          error: 'Session ID and message are required'
        });
        return;
      }

      const processed = await BotService.processMessage({
        userId,
        sessionId,
        chatId: chatId || 'test@c.us',
        messageBody: message,
        isGroup: false,
        contactName: 'Test User'
      });

      res.json({
        success: true,
        processed,
        message: processed ? 'Bot processed the message' : 'Bot did not process the message'
      });
    } catch (error) {
      logger.error('Error testing bot:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test bot'
      });
    }
  }
}

export default new BotController();

