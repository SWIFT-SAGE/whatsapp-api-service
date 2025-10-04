import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import WhatsappSession from '../models/WhatsappSession';
import WhatsAppService from '../services/whatsappService';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';
import { ApiResponse } from '../types/common';
import * as QRCode from 'qrcode';
import QRCodeManager from '../services/QRCodeManager';

export class SessionController {
  /**
   * Create a new WhatsApp session
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id.toString();
      const { name, webhookUrl, settings } = req.body;

      // Check session limits based on user plan
      const existingSessions = await WhatsappSession.countDocuments({ userId });
      const getMaxSessions = (plan: string) => {
        switch (plan) {
          case 'enterprise': return -1; // Unlimited
          case 'pro': return 25;
          case 'basic': return 5;
          case 'free': 
          default: return 1;
        }
      };
      const maxSessions = getMaxSessions(req.user!.subscription.plan);

      if (existingSessions >= maxSessions) {
        res.status(403).json({
          success: false,
          message: 'Maximum sessions reached for your plan',
          data: {
            currentSessions: existingSessions,
            maxSessions
          }
        } as ApiResponse);
        return;
      }

      // Generate unique session ID
      const sessionId = generateId('session');

      // Create session in database
      const session = new WhatsappSession({
        userId,
        sessionId,
        webhookUrl,
        settings: {
          autoReply: settings?.autoReply || false,
          autoReplyMessage: settings?.autoReplyMessage,
          allowGroups: settings?.allowGroups !== false,
          allowUnknown: settings?.allowUnknown !== false
        }
      });

      await session.save();

      // Initialize WhatsApp client using new QR manager
      try {
        const whatsappService = WhatsAppService;
        const result = await whatsappService.initializeSession(sessionId, userId);

        if (!result.success) {
          throw new Error(result.message);
        }

        logger.info(`WhatsApp session created: ${sessionId} for user: ${req.user!.email}`);

        res.status(201).json({
          success: true,
          message: 'Session created successfully',
          data: {
            sessionId,
            qrCode: null, // QR code will be available via polling
            isConnected: false,
            settings: session.settings,
            status: 'initializing'
          }
        } as ApiResponse);
      } catch (qrError) {
        logger.error(`Error creating session ${sessionId}:`, qrError);
        // Clean up session if creation fails
        await WhatsappSession.findByIdAndDelete(session._id);
        throw new Error('Failed to create session');
      }

    } catch (error) {
      logger.error('Error creating WhatsApp session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create session'
      } as ApiResponse);
    }
  }

  /**
   * Get all user sessions
   */
  async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const sessions = await WhatsappSession.find({ userId })
        .select('-qrCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await WhatsappSession.countDocuments({ userId });

      res.json({
        success: true,
        message: 'Sessions retrieved successfully',
        data: {
          sessions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sessions'
      } as ApiResponse);
    }
  }

  /**
   * Get specific session details
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      const session = await WhatsappSession.findOne({ sessionId, userId });

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Session retrieved successfully',
        data: session
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve session'
      } as ApiResponse);
    }
  }

  /**
   * Update session settings
   */
  async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        } as ApiResponse);
        return;
      }

      const { sessionId } = req.params;
      const userId = req.user!._id;
      const { webhookUrl, settings } = req.body;

      const session = await WhatsappSession.findOne({ sessionId, userId });

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      // Update session
      if (webhookUrl !== undefined) session.webhookUrl = webhookUrl;
      if (settings) {
        session.settings = {
          ...session.settings,
          ...settings
        };
      }

      await session.save();

      logger.info(`Session updated: ${sessionId}`);

      res.json({
        success: true,
        message: 'Session updated successfully',
        data: session
      } as ApiResponse);

    } catch (error) {
      logger.error('Error updating session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session'
      } as ApiResponse);
    }
  }

  /**
   * Delete session
   */
  async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      const session = await WhatsappSession.findOne({ sessionId, userId });

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      // Disconnect WhatsApp client
      await WhatsAppService.destroySession(sessionId);

      // Delete session from database
      await WhatsappSession.findByIdAndDelete(session._id);

      logger.info(`Session deleted: ${sessionId}`);

      res.json({
        success: true,
        message: 'Session deleted successfully'
      } as ApiResponse);

    } catch (error) {
      logger.error('Error deleting session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete session'
      } as ApiResponse);
    }
  }

  /**
   * Get session QR code
   */
  async getQRCode(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      const session = await WhatsappSession.findOne({ sessionId, userId });

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      if (session.isConnected) {
        res.status(400).json({
          success: false,
          message: 'Session is already connected'
        } as ApiResponse);
        return;
      }

      // Check if QR session exists in manager
      const qrSession = QRCodeManager.getSession(sessionId);
      
      if (qrSession && qrSession.status === 'ready' && qrSession.qrDataURL) {
        res.json({
          success: true,
          message: 'QR code retrieved successfully',
          data: { 
            qrCode: qrSession.qrDataURL,
            status: qrSession.status
          }
        } as ApiResponse);
        return;
      }

      // Generate new QR code if needed
      if (!qrSession || qrSession.status === 'expired' || qrSession.status === 'error') {
        try {
          const whatsappService = WhatsAppService;
          const result = await whatsappService.initializeSession(sessionId, userId.toString());
          
          if (!result.success) {
            throw new Error(result.message);
          }
          
          res.json({
            success: true,
            message: 'QR code generation started',
            data: { 
              qrCode: null,
              status: 'initializing'
            }
          } as ApiResponse);
        } catch (error) {
          throw new Error('Failed to start QR code generation');
        }
      } else {
        // QR code is being generated
        res.json({
          success: true,
          message: 'QR code generation in progress',
          data: { 
            qrCode: null,
            status: qrSession.status
          }
        } as ApiResponse);
      }

    } catch (error) {
      logger.error('Error getting QR code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve QR code'
      } as ApiResponse);
    }
  }
}

export default new SessionController();