import { Client, LocalAuth, MessageMedia, Contact, GroupChat, Message } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import WhatsappSession, { IWhatsappSession } from '../models/WhatsappSession';
import MessageLog from '../models/MessageLog';
import User from '../models/User';
// Socket.io instance will be injected from main app

interface WhatsAppClientManager {
  [sessionId: string]: Client;
}

class WhatsAppService {
  private clients: WhatsAppClientManager = {};
  private initialized: boolean = false;

  constructor() {
    // Don't initialize sessions in constructor to avoid database connection issues
  }

  /**
   * Initialize existing sessions - call this after database connection is established
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('WhatsApp service already initialized');
      return;
    }

    try {
      // Wait a bit to ensure database connection is fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if mongoose connection is ready
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        logger.warn('Database connection not ready, skipping WhatsApp session initialization');
        this.initialized = true;
        return;
      }

      const sessions = await WhatsappSession.find({ isConnected: true });
      for (const session of sessions) {
        await this.createClient(session.sessionId, session.userId.toString());
      }
      this.initialized = true;
      logger.info(`Initialized ${sessions.length} existing WhatsApp sessions`);
    } catch (error) {
      logger.error('Error initializing existing sessions:', error);
      // Don't throw error to prevent server startup failure
      logger.warn('Continuing server startup without existing session initialization');
      this.initialized = true;
    }
  }

  /**
   * Initialize existing sessions on server start (deprecated - use initialize() instead)
   */
  private async initializeExistingSessions(): Promise<void> {
    return this.initialize();
  }

  /**
   * Create a new WhatsApp client
   */
  async createClient(sessionId: string, userId: string): Promise<{ qr?: string; success: boolean; message: string }> {
    try {
      // Check if client already exists
      if (this.clients[sessionId]) {
        return { success: false, message: 'Session already exists' };
      }

      const sessionPath = path.join(process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions', sessionId);

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: sessionId,
          dataPath: sessionPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        }
      });

      // Store client reference
      this.clients[sessionId] = client;

      // Set up event handlers
      await this.setupEventHandlers(client, sessionId, userId);

      // Initialize client
      await client.initialize();

      return { success: true, message: 'Client initialization started' };
    } catch (error) {
      logger.error(`Error creating WhatsApp client for session ${sessionId}:`, error);
      return { success: false, message: 'Failed to create client' };
    }
  }

  /**
   * Setup event handlers for WhatsApp client
   */
  private async setupEventHandlers(client: Client, sessionId: string, userId: string): Promise<void> {
    // QR Code generation
    client.on('qr', async (qr) => {
      try {
        const qrCode = await QRCode.toDataURL(qr);

        // Update session with QR code
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          { qrCode, isConnected: false }
        );

        // Emit QR code to user (will be implemented when socket.io is available)
        // io.to(userId).emit('qr-code', { sessionId, qrCode });

        logger.info(`QR code generated for session: ${sessionId}`);
      } catch (error) {
        logger.error(`Error generating QR code for session ${sessionId}:`, error);
      }
    });

    // Client ready
    client.on('ready', async () => {
      try {
        const info = client.info;

        // Update session status
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          {
            isConnected: true,
            phoneNumber: info.wid.user,
            qrCode: undefined,
            deviceInfo: {
              name: info.pushname || 'Unknown',
              version: info.phone.wa_version
            }
          }
        );

        // Emit connection status to user (will be implemented when socket.io is available)
        // io.to(userId).emit('whatsapp-connected', { sessionId, phoneNumber: info.wid.user });

        logger.info(`WhatsApp client ready for session: ${sessionId}`);
      } catch (error) {
        logger.error(`Error handling ready event for session ${sessionId}:`, error);
      }
    });

    // Client disconnected
    client.on('disconnected', async (reason) => {
      try {
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          { isConnected: false, qrCode: undefined }
        );

        // Emit disconnection to user (will be implemented when socket.io is available)
        // io.to(userId).emit('whatsapp-disconnected', { sessionId, reason });

        // Clean up client reference
        delete this.clients[sessionId];

        logger.info(`WhatsApp client disconnected for session ${sessionId}: ${reason}`);
      } catch (error) {
        logger.error(`Error handling disconnect for session ${sessionId}:`, error);
      }
    });

    // Message received
    client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message, sessionId, userId);
      } catch (error) {
        logger.error(`Error handling incoming message for session ${sessionId}:`, error);
      }
    });

    // Message sent
    client.on('message_create', async (message) => {
      if (message.fromMe) {
        try {
          await this.logMessage(message, sessionId, userId, 'outbound');
        } catch (error) {
          logger.error(`Error logging outbound message for session ${sessionId}:`, error);
        }
      }
    });

    // Authentication failure
    client.on('auth_failure', async (msg) => {
      logger.error(`Authentication failed for session ${sessionId}:`, msg);
      // io.to(userId).emit('auth-failure', { sessionId, message: msg });
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleIncomingMessage(message: Message, sessionId: string, userId: string): Promise<void> {
    try {
      // Log the message
      await this.logMessage(message, sessionId, userId, 'inbound');

      // Get session settings
      const session = await WhatsappSession.findOne({ sessionId });
      if (!session) return;

      // Emit message to user (will be implemented when socket.io is available)
      // io.to(userId).emit('message-received', {
      //   sessionId,
      //   from: message.from,
      //   body: message.body,
      //   type: message.type,
      //   timestamp: message.timestamp
      // });

      // Auto-reply if enabled
      if (session.settings.autoReply && session.settings.autoReplyMessage) {
        await this.sendMessage(sessionId, message.from, session.settings.autoReplyMessage);
      }

      // Bot processing (if bot is active)
      // This would integrate with the bot service
      // await this.processBotResponse(message, sessionId, userId);
    } catch (error) {
      logger.error('Error handling incoming message:', error);
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(sessionId: string, to: string, message: string, options?: { quotedMessageId?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.clients[sessionId];
      if (!client) {
        return { success: false, error: 'Session not found or not connected' };
      }

      const sentMessage = await client.sendMessage(to, message, options);

      return { 
        success: true, 
        messageId: sentMessage.id._serialized 
      };
    } catch (error) {
      logger.error(`Error sending message via session ${sessionId}:`, error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  /**
   * Send media message
   */
  async sendMedia(sessionId: string, to: string, media: MessageMedia, caption?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.clients[sessionId];
      if (!client) {
        return { success: false, error: 'Session not found or not connected' };
      }

      const sentMessage = await client.sendMessage(to, media, { caption });

      return { 
        success: true, 
        messageId: sentMessage.id._serialized 
      };
    } catch (error) {
      logger.error(`Error sending media via session ${sessionId}:`, error);
      return { success: false, error: 'Failed to send media' };
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<{ connected: boolean; info?: any }> {
    const client = this.clients[sessionId];
    if (!client) {
      return { connected: false };
    }

    try {
      const state = await client.getState();
      const info = client.info;

      return {
        connected: state === 'CONNECTED',
        info: info ? {
          phoneNumber: info.wid.user,
          name: info.pushname,
          platform: info.platform
        } : null
      };
    } catch (error) {
      return { connected: false };
    }
  }

  /**
   * Disconnect and destroy session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    try {
      const client = this.clients[sessionId];
      if (client) {
        await client.destroy();
        delete this.clients[sessionId];
      }

      // Update database
      await WhatsappSession.findOneAndUpdate(
        { sessionId },
        { isConnected: false, qrCode: undefined }
      );

      // Clean up session files
      const sessionPath = path.join(process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions', sessionId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      logger.info(`Session ${sessionId} destroyed successfully`);
      return true;
    } catch (error) {
      logger.error(`Error destroying session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Log message to database
   */
  private async logMessage(message: Message, sessionId: string, userId: string, direction: 'inbound' | 'outbound'): Promise<void> {
    try {
      const session = await WhatsappSession.findOne({ sessionId });
      if (!session) return;

      const messageLog = new MessageLog({
        userId,
        sessionId: session._id,
        messageId: message.id._serialized,
        direction,
        type: message.type,
        from: message.from,
        to: message.to || '',
        content: message.body,
        status: 'delivered',
        metadata: {
          isGroup: message.from.includes('@g.us'),
          isForwarded: message.isForwarded
        }
      });

      await messageLog.save();
    } catch (error) {
      logger.error('Error logging message:', error);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Object.keys(this.clients);
  }

  /**
   * Get client by session ID
   */
  getClient(sessionId: string): Client | undefined {
    return this.clients[sessionId];
  }

  /**
   * Initialize a new WhatsApp session and return QR code
   */
  async initializeSession(sessionId: string, userId: string): Promise<string> {
    try {
      const result = await this.createClient(sessionId, userId);
      if (!result.success) {
        throw new Error(result.message);
      }

      // Wait for QR code to be generated
      return new Promise((resolve, reject) => {
        const client = this.clients[sessionId];
        if (!client) {
          reject(new Error('Client not found after creation'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('QR code generation timeout'));
        }, 30000); // 30 second timeout

        client.once('qr', async (qr) => {
          clearTimeout(timeout);
          try {
            const qrCode = await QRCode.toDataURL(qr);
            resolve(qrCode);
          } catch (error) {
            reject(error);
          }
        });

        client.once('ready', () => {
          clearTimeout(timeout);
          reject(new Error('Client connected without QR code'));
        });
      });
    } catch (error) {
      logger.error(`Error initializing session ${sessionId}:`, error);
      throw error;
    }
  }
}

export default new WhatsAppService();
