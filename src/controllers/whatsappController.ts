import { Request, Response } from 'express';
import WhatsAppService from '../services/whatsappService';
import RateLimitService from '../services/rateLimitService';
import WhatsappSession from '../models/WhatsappSession';
import MessageLog from '../models/MessageLog';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';
import QRCodeService from '../services/QRCodeService';
import QRCodeManager from '../services/QRCodeManager';

export class WhatsAppController {
  /**
   * Create a new WhatsApp session
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const { name, webhook, webhookUrl, settings } = req.body;
      
      // Use webhook or webhookUrl (frontend sends webhook)
      const finalWebhookUrl = webhook || webhookUrl;

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
        webhookUrl: finalWebhookUrl
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
      const { settings, webhook, webhookUrl } = req.body;
      const userId = req.user!._id;
      
      // Use webhook or webhookUrl (frontend sends webhook)
      const finalWebhookUrl = webhook || webhookUrl;

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
            webhookUrl: finalWebhookUrl
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
   * Get session QR code using new QR Code Manager
   */
  async getQRCode(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      logger.info(`Getting QR code for session: ${sessionId}, user: ${userId}`);

      // Verify session exists and belongs to user
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        logger.warn(`Session not found: ${sessionId} for user: ${userId}`);
        res.status(404).json({ 
          success: false,
          error: 'Session not found' 
        });
        return;
      }

      // Check if session is already connected
      if (session.isConnected) {
        logger.info(`Session ${sessionId} is already connected`);
        res.status(400).json({ 
          success: false,
          error: 'Session is already connected' 
        });
        return;
      }

      // Check QR session status in manager first
      const qrSession = QRCodeManager.getSession(sessionId);
      logger.info(`QR session status for ${sessionId}: ${qrSession ? qrSession.status : 'not found'}`);
      
      if (qrSession) {
        switch (qrSession.status) {
          case 'ready':
            if (qrSession.qrDataURL) {
              logger.info(`Returning ready QR code for session: ${sessionId}`);
              res.json({
                success: true,
                qrCode: qrSession.qrDataURL,
                sessionId,
                status: 'ready',
                message: 'QR code is ready to scan',
                createdAt: qrSession.createdAt,
                lastUpdated: qrSession.lastUpdated
              });
              return;
            }
            break;
            
          case 'generating':
            logger.info(`QR code is being generated for session: ${sessionId}`);
            res.json({
              success: true,
              qrCode: null,
              sessionId,
              status: 'generating',
              message: 'QR code is being generated...',
              createdAt: qrSession.createdAt,
              lastUpdated: qrSession.lastUpdated
            });
            return;
            
          case 'initializing':
            logger.info(`Session is initializing: ${sessionId}`);
            res.json({
              success: true,
              qrCode: null,
              sessionId,
              status: 'initializing',
              message: 'WhatsApp session is initializing...',
              createdAt: qrSession.createdAt,
              lastUpdated: qrSession.lastUpdated
            });
            return;
            
          case 'expired':
            logger.info(`QR session expired for ${sessionId}, cleaning up`);
            QRCodeManager.removeSession(sessionId);
            break;
            
          case 'error':
            logger.error(`QR session error for ${sessionId}: ${qrSession.error}`);
            res.status(400).json({
              success: false,
              error: qrSession.error || 'QR code generation failed',
              sessionId,
              status: 'error',
              details: 'QR code generation encountered an error'
            });
            return;
            
          case 'connected':
            logger.info(`Session ${sessionId} is connected via QR manager`);
            res.status(400).json({ 
              success: false,
              error: 'Session is already connected' 
            });
            return;
        }
      }

      // Fallback: Check database for existing valid QR code
      if (session.qrCode && session.lastQRGenerated) {
        const qrAge = new Date().getTime() - session.lastQRGenerated.getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (qrAge < fiveMinutes) {
          logger.info(`Found valid QR code in database for session: ${sessionId}, age: ${Math.round(qrAge/1000)}s`);
          
          try {
            // Validate and generate data URL from stored QR text
            const validation = QRCodeService.validateQRText(session.qrCode);
            if (!validation.valid) {
              logger.warn(`Invalid QR code in database for session ${sessionId}: ${validation.error}`);
            } else {
              const qrResult = await QRCodeService.generateDataURL(session.qrCode);
              if (qrResult.success) {
                logger.info(`Successfully generated QR data URL from database for session: ${sessionId}`);
                res.json({
                  success: true,
                  qrCode: qrResult.dataURL,
                  sessionId,
                  status: 'ready',
                  message: 'QR code retrieved from database',
                  validation: validation,
                  qrAge: Math.round(qrAge/1000) + 's'
                });
                return;
              } else {
                logger.error(`Failed to generate QR data URL for session ${sessionId}: ${qrResult.error}`);
              }
            }
          } catch (qrError) {
            logger.error(`Error processing stored QR code for session ${sessionId}:`, qrError);
          }
        } else {
          logger.info(`QR code in database is expired for session ${sessionId}, age: ${Math.round(qrAge/1000)}s`);
        }
      }

      // Start fresh QR code generation
      logger.info(`Starting fresh QR code generation for session: ${sessionId}`);
      
      try {
        // Clean up any existing QR session
        QRCodeManager.removeSession(sessionId);
        logger.info(`Cleaned up existing QR session for: ${sessionId}`);
        
        // Initialize new session
        const result = await WhatsAppService.initializeSession(sessionId, userId.toString());
        logger.info(`WhatsApp service initialization result for ${sessionId}:`, result);
        
        if (result.success) {
          res.json({
            success: true,
            qrCode: null,
            sessionId,
            status: 'initializing',
            message: result.message,
            timestamp: new Date().toISOString()
          });
        } else {
          logger.error(`WhatsApp service initialization failed for ${sessionId}: ${result.message}`);
          res.status(400).json({ 
            success: false,
            error: result.message,
            sessionId,
            details: 'WhatsApp service initialization failed'
          });
        }
      } catch (initError) {
        logger.error(`Error during QR initialization for session ${sessionId}:`, initError);
        res.status(500).json({ 
          success: false,
          error: 'Failed to start QR code generation',
          sessionId,
          details: initError instanceof Error ? initError.message : String(initError)
        });
      }
      
    } catch (error) {
      const sessionId = req.params.sessionId || 'unknown';
      logger.error(`Unexpected error in getQRCode for session ${sessionId}:`, error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to retrieve QR code',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get QR code status for polling
   */
  async getQRCodeStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      logger.info(`Getting QR status for session: ${sessionId}`);

      // Verify session ownership
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        logger.warn(`Session not found in database: ${sessionId}`);
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const qrSession = QRCodeManager.getSession(sessionId);
      
      if (!qrSession) {
        logger.warn(`QR session not found in manager: ${sessionId}`);
        res.json({
          success: true,
          status: 'not_found',
          message: 'QR session not found'
        });
        return;
      }

      logger.info(`QR session found - Status: ${qrSession.status}, Has QR: ${!!qrSession.qrDataURL}`);

      res.json({
        success: true,
        status: qrSession.status,
        qrCode: qrSession.qrDataURL || null,
        sessionId,
        message: WhatsAppController.getStatusMessage(qrSession.status),
        error: qrSession.error || null,
        createdAt: qrSession.createdAt,
        lastUpdated: qrSession.lastUpdated
      });
    } catch (error) {
      logger.error('Error getting QR code status:', error);
      res.status(500).json({ error: 'Failed to get QR code status' });
    }
  }

  private static getStatusMessage(status: string): string {
    switch (status) {
      case 'initializing': return 'Initializing WhatsApp session...';
      case 'generating': return 'Generating QR code...';
      case 'ready': return 'QR code is ready to scan';
      case 'expired': return 'QR code has expired';
      case 'connected': return 'Session is connected';
      case 'error': return 'An error occurred';
      default: return 'Unknown status';
    }
  }

  /**
   * Debug endpoint to test QR generation
   */
  async debugQRGeneration(req: Request, res: Response): Promise<void> {
    try {
      const testQRText = "1@test,test,test,test"; // Sample WhatsApp-like QR text
      const qrResult = await QRCodeService.generateDataURL(testQRText);
      
      res.json({
        success: true,
        qrResult,
        testText: testQRText,
        validation: QRCodeService.validateQRText(testQRText)
      });
    } catch (error) {
      logger.error('Debug QR generation error:', error);
      res.status(500).json({ error: 'Debug QR generation failed' });
    }
  }

  /**
   * Debug endpoint to force generate QR for a session (bypass WhatsApp client)
   */
  async debugForceQR(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user!._id;

      logger.info(`Force generating QR for session: ${sessionId}`);

      // Generate a test QR code directly
      const testQRText = `2@${sessionId},${Date.now()},test,test`;
      const qrResult = await QRCodeService.generateDataURL(testQRText);

      if (qrResult.success) {
        // Update QR manager directly
        await QRCodeManager.updateQRCode(sessionId, testQRText);
        
        res.json({
          success: true,
          qrCode: qrResult.dataURL,
          sessionId,
          status: 'ready',
          message: 'Test QR code generated successfully',
          testText: testQRText,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to generate test QR code',
          details: qrResult.error
        });
      }
    } catch (error) {
      logger.error('Debug force QR error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Debug force QR failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Debug endpoint to check all QR sessions status
   */
  async debugQRSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      
      // Get all sessions for this user
      const sessions = await WhatsappSession.find({ userId });
      
      const sessionStatuses = sessions.map(session => {
        const qrSession = QRCodeManager.getSession(session.sessionId);
        
        return {
          sessionId: session.sessionId,
          dbStatus: session.status,
          isConnected: session.isConnected,
          qrManagerStatus: qrSession ? qrSession.status : 'not_found',
          hasQRCode: qrSession ? !!qrSession.qrDataURL : false,
          qrCreatedAt: qrSession ? qrSession.createdAt : null,
          qrLastUpdated: qrSession ? qrSession.lastUpdated : null,
          lastQRGenerated: session.lastQRGenerated,
          createdAt: session.createdAt
        };
      });
      
      res.json({
        success: true,
        userId,
        totalSessions: sessions.length,
        sessions: sessionStatuses,
        qrManagerSessions: QRCodeManager.getAllSessions(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Debug QR sessions error:', error);
      res.status(500).json({ error: 'Debug QR sessions failed' });
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
