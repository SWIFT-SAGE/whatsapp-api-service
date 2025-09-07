import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import WhatsappSession from '../models/WhatsappSession';
import MessageLog from '../models/MessageLog';
import { logger } from '../utils/logger';
import { sendWebhook } from '../utils/helpers';
import { ApiResponse } from '../types/common';

export class WebhookController {
  /**
   * Handle incoming WhatsApp messages (webhook from WhatsApp service)
   */
  async handleIncomingMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, messageData } = req.body;

      // Verify session exists
      const session = await WhatsappSession.findOne({ sessionId });
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      // Create message log for incoming message
      const messageLog = new MessageLog({
        userId: session.userId,
        sessionId: session._id,
        messageId: messageData.id,
        direction: 'inbound',
        type: messageData.type || 'text',
        from: messageData.from,
        to: messageData.to || session.phoneNumber,
        content: messageData.body || messageData.caption,
        mediaUrl: messageData.mediaUrl,
        fileName: messageData.fileName,
        fileSize: messageData.fileSize,
        mimeType: messageData.mimeType,
        status: 'delivered',
        metadata: {
          isGroup: messageData.isGroup,
          groupName: messageData.groupName,
          isForwarded: messageData.isForwarded,
          quotedMessageId: messageData.quotedMessageId
        }
      });

      await messageLog.save();

      // Update session last activity
      session.lastActivity = new Date();
      await session.save();

      // Send webhook to user's endpoint if configured
      if (session.webhookUrl) {
        const webhookPayload = {
          event: 'message.received',
          sessionId,
          timestamp: new Date().toISOString(),
          data: {
            messageId: messageData.id,
            from: messageData.from,
            to: messageData.to,
            type: messageData.type,
            content: messageData.body || messageData.caption,
            mediaUrl: messageData.mediaUrl,
            isGroup: messageData.isGroup,
            groupName: messageData.groupName
          }
        };

        try {
          await sendWebhook(session.webhookUrl, webhookPayload);
          messageLog.webhookDelivered = true;
          await messageLog.save();
        } catch (webhookError) {
          logger.error(`Failed to send webhook for session ${sessionId}:`, webhookError);
        }
      }

      // Handle auto-reply if enabled
      if (session.settings.autoReply && session.settings.autoReplyMessage) {
        // Only auto-reply to direct messages, not groups (unless allowed)
        if (!messageData.isGroup || session.settings.allowGroups) {
          // Import WhatsAppService here to avoid circular dependency
          const WhatsAppService = require('../services/whatsappService').default;
          
          try {
            await WhatsAppService.sendMessage(
              sessionId,
              messageData.from,
              session.settings.autoReplyMessage,
              'text'
            );
            
            logger.info(`Auto-reply sent for session ${sessionId} to ${messageData.from}`);
          } catch (autoReplyError) {
            logger.error(`Failed to send auto-reply for session ${sessionId}:`, autoReplyError);
          }
        }
      }

      logger.info(`Incoming message processed for session ${sessionId}`);

      res.json({
        success: true,
        message: 'Message processed successfully'
      } as ApiResponse);

    } catch (error) {
      logger.error('Error handling incoming message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process incoming message'
      } as ApiResponse);
    }
  }

  /**
   * Handle message status updates (delivered, read, etc.)
   */
  async handleMessageStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, messageId, status, timestamp } = req.body;

      // Find and update message log
      const messageLog = await MessageLog.findOne({ messageId });
      if (!messageLog) {
        res.status(404).json({
          success: false,
          message: 'Message not found'
        } as ApiResponse);
        return;
      }

      // Update message status
      messageLog.status = status;
      await messageLog.save();

      // Get session for webhook
      const session = await WhatsappSession.findOne({ sessionId });
      if (session && session.webhookUrl) {
        const webhookPayload = {
          event: `message.${status}`,
          sessionId,
          timestamp: timestamp || new Date().toISOString(),
          data: {
            messageId,
            status,
            to: messageLog.to
          }
        };

        try {
          await sendWebhook(session.webhookUrl, webhookPayload);
        } catch (webhookError) {
          logger.error(`Failed to send status webhook for session ${sessionId}:`, webhookError);
        }
      }

      logger.info(`Message status updated: ${messageId} -> ${status}`);

      res.json({
        success: true,
        message: 'Status updated successfully'
      } as ApiResponse);

    } catch (error) {
      logger.error('Error handling message status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update message status'
      } as ApiResponse);
    }
  }

  /**
   * Handle session connection status changes
   */
  async handleSessionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, status, phoneNumber, deviceInfo } = req.body;

      const session = await WhatsappSession.findOne({ sessionId });
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        } as ApiResponse);
        return;
      }

      // Update session status
      session.isConnected = status === 'connected';
      session.lastActivity = new Date();
      
      if (phoneNumber) session.phoneNumber = phoneNumber;
      if (deviceInfo) session.deviceInfo = deviceInfo;
      
      // Clear QR code when connected
      if (status === 'connected') {
        session.qrCode = undefined;
      }

      await session.save();

      // Send webhook notification
      if (session.webhookUrl) {
        const webhookPayload = {
          event: `session.${status}`,
          sessionId,
          timestamp: new Date().toISOString(),
          data: {
            status,
            phoneNumber,
            deviceInfo
          }
        };

        try {
          await sendWebhook(session.webhookUrl, webhookPayload);
        } catch (webhookError) {
          logger.error(`Failed to send session webhook for ${sessionId}:`, webhookError);
        }
      }

      logger.info(`Session status updated: ${sessionId} -> ${status}`);

      res.json({
        success: true,
        message: 'Session status updated successfully'
      } as ApiResponse);

    } catch (error) {
      logger.error('Error handling session status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session status'
      } as ApiResponse);
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(req: Request, res: Response): Promise<void> {
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

      const { webhookUrl } = req.body;
      const userId = req.user!._id;

      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from WhatsApp API Service',
          userId: userId.toString()
        }
      };

      try {
        const response = await sendWebhook(webhookUrl, testPayload);
        
        res.json({
          success: true,
          message: 'Webhook test successful',
          data: {
            url: webhookUrl,
            status: response.status,
            responseTime: response.responseTime
          }
        } as ApiResponse);

      } catch (webhookError) {
        res.status(400).json({
          success: false,
          message: 'Webhook test failed',
          data: {
            url: webhookUrl,
            error: webhookError instanceof Error ? webhookError.message : 'Unknown error'
          }
        } as ApiResponse);
      }

    } catch (error) {
      logger.error('Error testing webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ApiResponse);
    }
  }
}

export default new WebhookController();