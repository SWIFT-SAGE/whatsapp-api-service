import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import WhatsAppService from '../services/whatsappService';
import RateLimitService from '../services/rateLimitService';
import WhatsappSession from '../models/WhatsappSession';
import MessageLog from '../models/MessageLog';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';

export class WhatsAppController {
  /**
   * Create a new WhatsApp session
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user!._id.toString();
      const { name, webhookUrl, settings } = req.body;

      // Check if user already has maximum sessions (based on plan)
      const existingSessions = await WhatsappSession.countDocuments({ userId });
      const maxSessions = req.user!.subscription.plan === 'premium' ? 10 : 
                         req.user!.subscription.plan === 'basic' ? 3 : 1;

      if (existingSessions >= maxSessions) {
        res.status(403).json({
          error: 'Maximum sessions reached for your plan',
          currentSessions: existingSessions,
          maxSessions
        });
        return;
      }

      // Generate unique session ID
      const sessionId = generateId('session');

      // Create session in database
      const session = new WhatsappSession({
        userId,
        sessionId,
        settings: {
          autoReply: settings?.autoReply || false,
          autoReplyMessage: settings?.autoReplyMessage,
          allowGroups: settings?.allowGroups !== false,
          allowUnknown: settings?.allowUnknown !== false
        },
        webhookUrl
      });

      await session.save();

      // Update user's sessions array
      req.user!.whatsappSessions.push(session._id);
      await req.user!.save();

      // Initialize WhatsApp client
      const result = await WhatsAppService.createClient(sessionId, userId);

      res.status(201).json({
        success: true,
        sessionId,
        message: result.message,
        session: {
          id: session._id,
          sessionId: session.sessionId,
          name,
          isConnected: session.isConnected,
          settings: session.settings,
          createdAt: session.createdAt
        }
      });
    } catch (error) {
      logger.error('Error creating WhatsApp session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  /**
   * Get user's WhatsApp sessions
   */
  async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;

      const sessions = await WhatsappSession.find({ userId })
        .select('-qrCode') // Don't include QR code in list
        .sort({ createdAt: -1 });

      // Get session statuses
      const sessionsWithStatus = await Promise.all(sessions.map(async (session) => {
        const status = await WhatsAppService.getSessionStatus(session.sessionId);
        return {
          id: session._id,
          sessionId: session.sessionId,
          phoneNumber: session.phoneNumber,
          isConnected: status.connected,
          lastActivity: session.lastActivity,
          settings: session.settings,
          webhookUrl: session.webhookUrl,
          createdAt: session.createdAt,
          info: status.info
        };
      }));

      res.json({
        success: true,
        sessions: sessionsWithStatus
      });
    } catch (error) {
      logger.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  /**
   * Get specific session details including QR code if available
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const status = await WhatsAppService.getSessionStatus(sessionId);

      res.json({
        success: true,
        session: {
          id: session._id,
          sessionId: session.sessionId,
          phoneNumber: session.phoneNumber,
          isConnected: status.connected,
          qrCode: session.qrCode,
          lastActivity: session.lastActivity,
          settings: session.settings,
          webhookUrl: session.webhookUrl,
          deviceInfo: session.deviceInfo,
          createdAt: session.createdAt,
          info: status.info
        }
      });
    } catch (error) {
      logger.error('Error fetching session:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { sessionId } = req.params;
      const { to, message, quotedMessageId } = req.body;
      const userId = req.user!._id.toString();

      // Verify session ownership
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (!session.isConnected) {
        res.status(400).json({ error: 'Session not connected' });
        return;
      }

      // Check rate limit
      const rateLimitResult = await RateLimitService.canSendMessage(userId);
      if (!rateLimitResult.allowed) {
        res.status(429).json({
          error: 'Message limit exceeded',
          remainingPoints: rateLimitResult.remainingPoints,
          resetTime: rateLimitResult.resetTime
        });
        return;
      }

      // Send message via WhatsApp
      const result = await WhatsAppService.sendMessage(sessionId, to, message, { quotedMessageId });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Log message
      const messageLog = new MessageLog({
        userId,
        sessionId: session._id,
        messageId: result.messageId,
        direction: 'outbound',
        type: 'text',
        from: session.phoneNumber || '',
        to,
        content: message,
        status: 'sent'
      });
      await messageLog.save();

      // Increment user message count
      await req.user!.incrementMessageCount();

      res.json({
        success: true,
        messageId: result.messageId,
        remainingMessages: rateLimitResult.remainingPoints ? rateLimitResult.remainingPoints - 1 : undefined
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  /**
   * Send media message
   */
  async sendMedia(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { sessionId } = req.params;
      const { to, caption } = req.body;
      const userId = req.user!._id.toString();

      if (!req.file) {
        res.status(400).json({ error: 'Media file is required' });
        return;
      }

      // Verify session ownership
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (!session.isConnected) {
        res.status(400).json({ error: 'Session not connected' });
        return;
      }

      // Check rate limit
      const rateLimitResult = await RateLimitService.canSendMessage(userId);
      if (!rateLimitResult.allowed) {
        res.status(429).json({
          error: 'Message limit exceeded',
          remainingPoints: rateLimitResult.remainingPoints,
          resetTime: rateLimitResult.resetTime
        });
        return;
      }

      // Create media object
      const media = {
        mimetype: req.file.mimetype,
        data: req.file.buffer.toString('base64'),
        filename: req.file.originalname
      };

      // Send media via WhatsApp
      const result = await WhatsAppService.sendMedia(sessionId, to, media as any, caption);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Log message
      const messageLog = new MessageLog({
        userId,
        sessionId: session._id,
        messageId: result.messageId,
        direction: 'outbound',
        type: req.file.mimetype.startsWith('image/') ? 'image' : 
              req.file.mimetype.startsWith('video/') ? 'video' : 
              req.file.mimetype.startsWith('audio/') ? 'audio' : 'document',
        from: session.phoneNumber || '',
        to,
        content: caption,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: 'sent'
      });
      await messageLog.save();

      // Increment user message count
      await req.user!.incrementMessageCount();

      res.json({
        success: true,
        messageId: result.messageId,
        remainingMessages: rateLimitResult.remainingPoints ? rateLimitResult.remainingPoints - 1 : undefined
      });
    } catch (error) {
      logger.error('Error sending media:', error);
      res.status(500).json({ error: 'Failed to send media' });
    }
  }

  /**
   * Get message history
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { page = 1, limit = 50, contact } = req.query;
      const userId = req.user!._id;

      // Verify session ownership
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Build query
      const query: any = { sessionId: session._id };
      if (contact) {
        query.$or = [
          { from: contact },
          { to: contact }
        ];
      }

      // Get messages with pagination
      const messages = await MessageLog.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit) * Number(page))
        .skip((Number(page) - 1) * Number(limit))
        .lean();

      const totalMessages = await MessageLog.countDocuments(query);

      res.json({
        success: true,
        messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalMessages,
          pages: Math.ceil(totalMessages / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  /**
   * Update session settings
   */
  async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { settings, webhookUrl } = req.body;
      const userId = req.user!._id;

      const session = await WhatsappSession.findOneAndUpdate(
        { sessionId, userId },
        {
          $set: {
            settings: {
              autoReply: settings?.autoReply,
              autoReplyMessage: settings?.autoReplyMessage,
              allowGroups: settings?.allowGroups,
              allowUnknown: settings?.allowUnknown
            },
            webhookUrl
          }
        },
        { new: true }
      );

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          settings: session.settings,
          webhookUrl: session.webhookUrl,
          updatedAt: session.updatedAt
        }
      });
    } catch (error) {
      logger.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
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
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (session.isConnected) {
        res.status(400).json({ error: 'Session is already connected' });
        return;
      }

      // Get or generate QR code
      let qrCode = session.qrCode;
      if (!qrCode) {
        try {
          // Start QR code generation in background
          WhatsAppService.initializeSession(sessionId, userId.toString()).then(async (generatedQR) => {
            // Update session with QR code when ready
            await WhatsappSession.findOneAndUpdate(
              { sessionId },
              { qrCode: generatedQR, lastQRGenerated: new Date() }
            );
            logger.info(`QR code generated and stored for session: ${sessionId}`);
          }).catch((error) => {
            logger.error(`Error generating QR code for session ${sessionId}:`, error);
          });

          // Return response indicating QR code generation is in progress
          res.json({
            success: true,
            qrCode: null,
            sessionId,
            message: 'QR code generation in progress'
          });
          return;
        } catch (error) {
          logger.error(`Error starting QR code generation for session ${sessionId}:`, error);
          res.status(500).json({ error: 'Failed to start QR code generation' });
          return;
        }
      }

      res.json({
        success: true,
        qrCode,
        sessionId
      });
    } catch (error) {
      logger.error('Error getting QR code:', error);
      res.status(500).json({ error: 'Failed to retrieve QR code' });
    }
  }

  /**
   * Delete session
   */
  async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      // Try to find session by sessionId first, then by _id
      let session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        // Try finding by _id if sessionId didn't work
        session = await WhatsappSession.findOne({ _id: sessionId, userId });
      }
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Destroy WhatsApp client
      await WhatsAppService.destroySession(session.sessionId);

      // Remove from database
      await WhatsappSession.findByIdAndDelete(session._id);

      // Remove from user's sessions array
      req.user!.whatsappSessions = req.user!.whatsappSessions.filter(
        s => !s.equals(session._id)
      );
      await req.user!.save();

      res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }
}

export default new WhatsAppController();
