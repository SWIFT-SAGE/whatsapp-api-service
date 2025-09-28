import { Client, Message, MessageMedia, RemoteAuth } from 'whatsapp-web.js';
import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose';
import WhatsappSession from '../models/WhatsappSession';
import MessageLog from '../models/MessageLog';
import { logger } from '../utils/logger';
// Socket.io instance will be injected from main app

interface WhatsAppClientManager {
  [sessionId: string]: Client;
}

class WhatsAppService {
  private clients: WhatsAppClientManager = {};
  private initialized: boolean = false;
  private mongoStore: any = null;

  constructor() {
    // Don't initialize sessions in constructor to avoid database connection issues
    this.initializeMongoStore();
  }

  /**
   * Initialize MongoDB store for WhatsApp sessions
   */
  private initializeMongoStore(): void {
    try {
      this.mongoStore = new MongoStore({ mongoose: mongoose });
      logger.info('MongoDB store initialized for WhatsApp sessions');
    } catch (error) {
      logger.error('Error initializing MongoDB store:', error);
    }
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
        // If client exists but is not ready, wait for QR code
        const client = this.clients[sessionId];
        if (client.info && client.info.wid) {
          return { success: true, message: 'Session already connected' };
        } else {
          // Client exists but not connected, return existing QR if available
          return { success: true, message: 'Session exists, waiting for connection' };
        }
      }

      const client = new Client({
        authStrategy: new RemoteAuth({
          store: this.mongoStore,
          clientId: sessionId,
          backupSyncIntervalMs: 300000 // 5 minutes backup sync interval
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
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-pings',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows'
          ],
          timeout: 300000 // 5 minutes timeout for browser launch
        }
      });

      // Store client reference
      this.clients[sessionId] = client;

      // Set up event handlers
      await this.setupEventHandlers(client, sessionId, userId);

      // Initialize client
      logger.info(`Initializing WhatsApp client for session: ${sessionId}`);
      await client.initialize();
      logger.info(`WhatsApp client initialized for session: ${sessionId}`);

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
        // Update session with QR code
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          { 
            qrCode: qr, // Store raw QR string instead of data URL
            isConnected: false, 
            lastQRGenerated: new Date(),
            status: 'pending'
          },
          { new: true }
        );

      } catch (error) {
        logger.error(`Error storing QR code for session ${sessionId}:`, error);
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          { status: 'error', 'errorLog.lastError': error instanceof Error ? error.message : String(error) }
        ).catch(err => logger.error('Failed to update session with error:', err));
      }
    });

    // Authentication success - RemoteAuth with MongoStore handles auth data automatically
    client.on('authenticated', async () => {
      try {
        // Update session status in our custom session model
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          { 
            status: 'connected',
            lastActivity: new Date()
          }
        );
        logger.info(`Session ${sessionId} authenticated successfully`);
      } catch (error) {
        logger.error(`Error updating session status for ${sessionId}:`, error);
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
            status: 'connected',
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
      await WhatsappSession.findOneAndUpdate(
        { sessionId },
        { 
          status: 'error', 
          'errorLog.lastError': `Authentication failed: ${msg}`,
          'errorLog.lastErrorAt': new Date()
        }
      );
      // io.to(userId).emit('auth-failure', { sessionId, message: msg });
    });

    // Loading screen event
    client.on('loading_screen', (percent, message) => {
      logger.info(`Loading screen for session ${sessionId}: ${percent}% - ${message}`);
    });

    // Client initialization error
    client.on('change_state', (state) => {
      logger.info(`Client state changed for session ${sessionId}: ${state}`);
    });

    // Add error handler for client
    client.on('error', async (error) => {
      logger.error(`Client error for session ${sessionId}:`, error);
      await WhatsappSession.findOneAndUpdate(
        { sessionId },
        { 
          status: 'error', 
          'errorLog.lastError': error instanceof Error ? error.message : String(error),
          'errorLog.lastErrorAt': new Date()
        }
      );
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

      // Session data is stored in MongoDB, no file cleanup needed

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
   * Get existing QR code for a session
   */
  async getExistingQRCode(sessionId: string): Promise<string | null> {
    try {
      const session = await WhatsappSession.findOne({ sessionId });
      if (session && session.qrCode) {
        // Check if QR code is not too old (less than 5 minutes)
        const now = new Date();
        const qrAge = session.lastQRGenerated ? now.getTime() - session.lastQRGenerated.getTime() : 0;
        if (qrAge < 5 * 60 * 1000) { // 5 minutes
          return session.qrCode;
        } else {
          // Clean up old QR code
          await WhatsappSession.findOneAndUpdate(
            { sessionId },
            { qrCode: undefined, lastQRGenerated: undefined }
          );
        }
      }
      return null;
    } catch (error) {
      logger.error(`Error getting existing QR code for session ${sessionId}:`, error);
      return null;
    }
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

      // If session already exists and is connected, return a message
      if (result.message === 'Session already connected') {
        throw new Error('Session is already connected');
      }

      // If session exists but is waiting for connection, check if QR code is already available
      if (result.message === 'Session exists, waiting for connection') {
        const existingQR = await this.getExistingQRCode(sessionId);
        if (existingQR) {
          logger.info(`Returning existing QR code for session: ${sessionId}`);
          return existingQR;
        }
      }

      // Wait for QR code to be generated
      return new Promise((resolve, reject) => {
        const client = this.clients[sessionId];
        if (!client) {
          reject(new Error('Client not found after creation'));
          return;
        }

        // Increase timeout to 5 minutes to match frontend timeout
        const timeout = setTimeout(() => {
          reject(new Error('QR code generation timeout'));
        }, 300000); // 300 second (5 minutes) timeout

        // Check if QR code is already available in database
        const checkExistingQR = async () => {
          try {
            const existingQR = await this.getExistingQRCode(sessionId);
            if (existingQR) {
              clearTimeout(timeout);
              resolve(existingQR);
              return true;
            }
          } catch (error) {
            // Ignore database errors, continue with event listener
          }
          return false;
        };

        // Check immediately
        checkExistingQR().then(found => {
          if (!found) {
            // Set up periodic check every 2 seconds
            const checkInterval = setInterval(async () => {
              const found = await checkExistingQR();
              if (found) {
                clearInterval(checkInterval);
              }
            }, 2000);

            // Also listen for QR event as backup
            client.once('qr', async (qr) => {
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve(qr); // Return raw QR string instead of data URL
            });

            // Clean up interval on timeout
            setTimeout(() => {
              clearInterval(checkInterval);
            }, 300000); // 5 minutes
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
