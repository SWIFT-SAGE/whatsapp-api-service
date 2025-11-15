import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { IUser } from '../models/User';
import MessageLog from '../models/MessageLog';
import WhatsappSession from '../models/WhatsappSession';
import WhatsAppService from '../services/whatsappService';
import RateLimitService from '../services/rateLimitService';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';
import { ApiResponse } from '../types/common';

export class MessageController {
  /**
   * Send text message
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
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
      const { to, message, type = 'text' } = req.body;
      const userId = (req.user as IUser)._id;

      // Check if user can send messages
      if (!(req.user as IUser).canSendMessage()) {
        res.status(403).json({
          success: false,
          message: 'Message limit exceeded for your plan'
        } as ApiResponse);
        return;
      }

      // Check rate limits
      const rateLimitResult = await RateLimitService.checkApiRateLimit(userId.toString());
      if (!rateLimitResult.allowed) {
        res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          data: {
            resetTime: rateLimitResult.resetTime
          }
        } as ApiResponse);
        return;
      }

      // Verify session exists and belongs to user
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      if (!session.isConnected) {
        res.status(400).json({
          success: false,
          message: 'Session is not connected'
        } as ApiResponse);
        return;
      }

      // Generate message ID
      const messageId = generateId('msg');

      // Create message log
      const messageLog = new MessageLog({
        userId,
        sessionId: session._id,
        messageId,
        direction: 'outbound',
        type,
        from: session.phoneNumber || 'unknown',
        to,
        content: message,
        status: 'pending'
      });

      await messageLog.save();

      try {
        // Send message via WhatsApp service
        const result = await WhatsAppService.sendMessage(sessionId, to, message, type);
        
        // Update message status
        messageLog.status = 'sent';
        messageLog.messageId = result.messageId || messageId;
        await messageLog.save();

        // Increment user message count
        await (req.user as IUser).incrementMessageCount();

        logger.info(`Message sent: ${messageId} from session: ${sessionId}`);

        res.json({
          success: true,
          message: 'Message sent successfully',
          data: {
            messageId: messageLog.messageId,
            status: 'sent',
            to,
            timestamp: messageLog.createdAt
          }
        } as ApiResponse);

      } catch (sendError) {
        // Update message status to failed
        messageLog.status = 'failed';
        messageLog.errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
        await messageLog.save();

        logger.error(`Failed to send message: ${messageId}`, sendError);

        res.status(500).json({
          success: false,
          message: 'Failed to send message',
          data: {
            messageId: messageLog.messageId,
            error: messageLog.errorMessage
          }
        } as ApiResponse);
      }

    } catch (error) {
      logger.error('Error in sendMessage:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }

  /**
   * Send media message
   */
  async sendMedia(req: Request, res: Response): Promise<void> {
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
      const { to, caption } = req.body;
      const userId = (req.user as IUser)._id;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Media file is required'
        } as ApiResponse);
        return;
      }

      // Check if user can send messages
      if (!(req.user as IUser).canSendMessage()) {
        res.status(403).json({
          success: false,
          message: 'Message limit exceeded for your plan'
        } as ApiResponse);
        return;
      }

      // Verify session
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session || !session.isConnected) {
        res.status(400).json({
          success: false,
          message: 'Session not found or not connected'
        } as ApiResponse);
        return;
      }

      const messageId = generateId('msg');
      const mediaType = file.mimetype.startsWith('image/') ? 'image' :
                       file.mimetype.startsWith('video/') ? 'video' :
                       file.mimetype.startsWith('audio/') ? 'audio' : 'document';

      // Create message log
      const messageLog = new MessageLog({
        userId,
        sessionId: session._id,
        messageId,
        direction: 'outbound',
        type: mediaType,
        from: session.phoneNumber || 'unknown',
        to,
        content: caption,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'pending'
      });

      await messageLog.save();

      try {
        // Send media via WhatsApp service
        // Save file temporarily first
        const fs = await import('fs');
        const path = await import('path');
        const crypto = await import('crypto');
        
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const uniqueFilename = `${crypto.randomBytes(16).toString('hex')}_${file.originalname}`;
        const tempFilePath = path.join(tempDir, uniqueFilename);
        
        fs.writeFileSync(tempFilePath, file.buffer);
        
        try {
          const result = await WhatsAppService.sendMedia(sessionId, to, tempFilePath, caption);
        
          messageLog.status = 'sent';
          messageLog.messageId = result.messageId || messageId;
          if ('mediaUrl' in result) {
              messageLog.mediaUrl = typeof result.mediaUrl === 'string' ? result.mediaUrl : undefined;
          }
          await messageLog.save();

          await (req.user as IUser).incrementMessageCount();

          res.json({
            success: true,
            message: 'Media sent successfully',
            data: {
              messageId: messageLog.messageId,
              status: 'sent',
              type: mediaType,
              to,
              timestamp: messageLog.createdAt
            }
          } as ApiResponse);
        } catch (sendError) {
          messageLog.status = 'failed';
          messageLog.errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
          await messageLog.save();

          res.status(500).json({
            success: false,
            message: 'Failed to send media',
            data: {
              messageId: messageLog.messageId,
              error: messageLog.errorMessage
            }
          } as ApiResponse);
        } finally {
          // Clean up temporary file
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (cleanupError) {
            logger.error('Failed to clean up temp file:', cleanupError);
          }
        }
      } catch (error) {
        logger.error('Error preparing media:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to prepare media'
        } as ApiResponse);
      }

    } catch (error) {
      logger.error('Error in sendMedia:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }

  /**
   * Get message history
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = (req.user as IUser)._id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const direction = req.query.direction as string;
      const type = req.query.type as string;
      const status = req.query.status as string;
      const skip = (page - 1) * limit;

      // Verify session belongs to user
      const session = await WhatsappSession.findOne({ sessionId, userId });
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      // Build query filters
      const query: any = {
        userId,
        sessionId: session._id
      };

      if (direction) query.direction = direction;
      if (type) query.type = type;
      if (status) query.status = status;

      const messages = await MessageLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v');

      const total = await MessageLog.countDocuments(query);

      res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          messages,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve messages'
      } as ApiResponse);
    }
  }

  /**
   * Get message by ID
   */
  async getMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req.user as IUser)._id;

      const message = await MessageLog.findOne({ messageId, userId })
        .populate('sessionId', 'sessionId phoneNumber');

      if (!message) {
        res.status(404).json({
          success: false,
          message: 'Message not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Message retrieved successfully',
        data: message
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve message'
      } as ApiResponse);
    }
  }
}

export default new MessageController();
