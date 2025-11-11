import { Client, Message, MessageMedia, RemoteAuth } from 'whatsapp-web.js';
import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose';
import WhatsappSession from '../models/WhatsappSession';
import MessageLog from '../models/MessageLog';
import { logger } from '../utils/logger';
import QRCodeManager from './QRCodeManager';
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
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if mongoose connection is ready with timeout
      const mongoose = require('mongoose');
      const maxWaitTime = 10000; // Wait max 10 seconds for database
      const startTime = Date.now();
      
      while (mongoose.connection.readyState !== 1 && (Date.now() - startTime) < maxWaitTime) {
        logger.info('Waiting for database connection to be ready...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (mongoose.connection.readyState !== 1) {
        logger.warn('Database connection not ready after waiting, skipping WhatsApp session initialization');
        this.initialized = true;
        return;
      }

      logger.info('Database connection ready, initializing WhatsApp sessions...');
      
      // Find sessions with a timeout
      const sessions = await Promise.race([
        WhatsappSession.find({ isConnected: true }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 5000)
        )
      ]) as any[];
      
      logger.info(`Found ${sessions.length} active sessions to initialize`);
      
      // Initialize sessions sequentially with delays to avoid overwhelming the system
      for (const session of sessions) {
        try {
          logger.info(`Initializing session: ${session.sessionId}`);
          await this.createClient(session.sessionId, session.userId.toString());
          // Add delay between initializations
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (sessionError) {
          logger.error(`Failed to initialize session ${session.sessionId}:`, sessionError);
          // Continue with next session
        }
      }
      
      this.initialized = true;
      logger.info(`WhatsApp service initialized with ${sessions.length} sessions`);
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
  async createClient(sessionId: string, userId: string, forceRestart: boolean = false): Promise<{ qr?: string; success: boolean; message: string }> {
    try {
      // Check if client already exists
      if (this.clients[sessionId]) {
        const client = this.clients[sessionId];
        
        if (forceRestart) {
          logger.info(`Force restarting client for session: ${sessionId}`);
          // Destroy existing client
          try {
            await client.destroy();
          } catch (destroyError) {
            logger.warn(`Error destroying existing client for ${sessionId}:`, destroyError);
          }
          delete this.clients[sessionId];
          // Continue to create new client below
        } else {
          // If client exists and is connected
          if (client.info && client.info.wid) {
            return { success: true, message: 'Session already connected' };
          } else {
            // Client exists but not connected, return existing QR if available
            return { success: true, message: 'Session exists, waiting for connection' };
          }
        }
      }

      const client = new Client({
        authStrategy: new RemoteAuth({
          store: this.mongoStore,
          clientId: sessionId,
          backupSyncIntervalMs: 300000 // 5 minutes backup sync interval
        })
      });

      // Store client reference
      this.clients[sessionId] = client;

      // Set up event handlers
      await this.setupEventHandlers(client, sessionId, userId);

      // Initialize client with timeout
      logger.info(`Initializing WhatsApp client for session: ${sessionId}`);
      
      try {
        // Set a timeout for client initialization (increased to 60 seconds)
        const initPromise = client.initialize();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Client initialization timeout')), 60000); // 60 seconds
        });
        
        await Promise.race([initPromise, timeoutPromise]);
        logger.info(`WhatsApp client initialized successfully for session: ${sessionId}`);
        
        // Set a fallback timer to check if QR code was generated
        setTimeout(async () => {
          const qrSession = QRCodeManager.getSession(sessionId);
          if (qrSession && qrSession.status === 'initializing') {
            logger.warn(`QR code not generated after 15 seconds for session ${sessionId}, checking client status`);
            
            // Check if client is still valid
            const client = this.clients[sessionId];
            if (client && !client.info) {
              logger.info(`Client exists but no QR generated for ${sessionId}, this is normal during initialization`);
            }
          }
        }, 15000); // Check after 15 seconds
        
        return { success: true, message: 'Client initialization started' };
      } catch (initError) {
        logger.error(`Client initialization failed for session ${sessionId}:`, initError);
        
        // Clean up failed client
        if (this.clients[sessionId]) {
          try {
            // Check if client has a pupeteer instance before destroying
            if (this.clients[sessionId].pupBrowser || this.clients[sessionId].pupPage) {
              await this.clients[sessionId].destroy();
            }
          } catch (destroyError) {
            logger.warn(`Error destroying failed client for ${sessionId}:`, destroyError);
            // Force cleanup even if destroy fails
          }
          delete this.clients[sessionId];
        }
        
        // Update session status in database
        try {
          await WhatsappSession.findOneAndUpdate(
            { sessionId },
            { 
              status: 'disconnected',
              isConnected: false,
              'errorLog.lastError': initError instanceof Error ? initError.message : String(initError),
              'errorLog.lastErrorAt': new Date()
            }
          );
        } catch (dbError) {
          logger.error(`Failed to update session status for ${sessionId}:`, dbError);
        }
        
        return { success: false, message: `Client initialization failed: ${initError instanceof Error ? initError.message : String(initError)}` };
      }
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
        logger.info(`QR code generated for session: ${sessionId}`);
        
        // Check if QR session exists in manager, if not initialize it
        let qrSession = QRCodeManager.getSession(sessionId);
        if (!qrSession) {
          logger.info(`QR session not found, initializing for: ${sessionId}`);
          qrSession = await QRCodeManager.initializeSession(sessionId, userId);
        }
        
        // Update QR code through manager
        await QRCodeManager.updateQRCode(sessionId, qr);
        
        logger.info(`QR code updated in manager for session: ${sessionId}`);

      } catch (error) {
        logger.error(`Error handling QR code for session ${sessionId}:`, error);
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          { status: 'error', 'errorLog.lastError': error instanceof Error ? error.message : String(error) }
        ).catch(err => logger.error('Failed to update session with error:', err));
      }
    });

    // Client ready event
    client.on('ready', async () => {
      try {
        const info = client.info;

        // Mark session as connected in QR manager
        await QRCodeManager.markSessionConnected(sessionId);

        // Update session status in database
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          {
            isConnected: true,
            phoneNumber: info.wid?.user || 'Unknown',
            qrCode: undefined,
            status: 'connected',
            lastActivity: new Date(),
            deviceInfo: {
              name: info.pushname || 'Unknown',
              version: info.phone?.wa_version || 'Unknown'
            }
          }
        );

        // Emit connection status to user (will be implemented when socket.io is available)
        // io.to(userId).emit('whatsapp-connected', { sessionId, phoneNumber: info.wid?.user || 'Unknown' });

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
          { 
            isConnected: false, 
            qrCode: undefined,
            status: 'disconnected',
            lastActivity: new Date()
          }
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

      // Additional validation: Check if client is actually ready
      const state = await client.getState();
      if (state !== 'CONNECTED') {
        return { success: false, error: `Session is not ready. Current state: ${state}` };
      }

      // Validate and format phone number
      if (!to) {
        return { success: false, error: 'Phone number is required' };
      }

      // Clean and format phone number
      let formattedTo = to.trim();
      
      // Remove any non-digit characters except + and @
      if (!formattedTo.includes('@')) {
        // Remove spaces, dashes, parentheses, etc.
        formattedTo = formattedTo.replace(/[^\d+]/g, '');
        
        // Ensure it starts with + for international format
        if (!formattedTo.startsWith('+')) {
          return { success: false, error: 'Phone number must include country code (e.g., +1234567890)' };
        }
        
        // Add WhatsApp suffix
        formattedTo = `${formattedTo.substring(1)}@c.us`;
      }

      logger.info(`Sending message to ${formattedTo} via session ${sessionId}`);
      
      const sentMessage = await client.sendMessage(formattedTo, message, options);
      
      return { 
        success: true, 
        messageId: sentMessage.id._serialized 
      };
    } catch (error: any) {
      logger.error(`Error sending message via session ${sessionId}:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes('not registered')) {
        return { success: false, error: 'Phone number is not registered on WhatsApp' };
      } else if (error.message?.includes('Rate limit')) {
        return { success: false, error: 'WhatsApp rate limit exceeded. Please wait before sending more messages.' };
      } else if (error.message?.includes('Session closed')) {
        return { success: false, error: 'WhatsApp session has been closed. Please reconnect.' };
      } else if (error.message?.includes('Evaluation failed')) {
        return { success: false, error: 'WhatsApp client error. Please check phone number format and try again.' };
      } else if (error.message?.includes('Target closed')) {
        return { success: false, error: 'WhatsApp session disconnected. Please reconnect the session.' };
      }
      
      return { success: false, error: error.message || 'Failed to send message' };
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

      // Additional validation: Check if client is actually ready
      const state = await client.getState();
      if (state !== 'CONNECTED') {
        return { success: false, error: `Session is not ready. Current state: ${state}` };
      }

      // Validate phone number format
      const formattedTo = to.includes('@') ? to : `${to}@c.us`;
      
      const sentMessage = await client.sendMessage(formattedTo, media, { caption });

      return { 
        success: true, 
        messageId: sentMessage.id._serialized 
      };
    } catch (error: any) {
      logger.error(`Error sending media via session ${sessionId}:`, error);
      
      // Provide more specific error messages
      if (error.message?.includes('not registered')) {
        return { success: false, error: 'Phone number is not registered on WhatsApp' };
      } else if (error.message?.includes('Rate limit')) {
        return { success: false, error: 'WhatsApp rate limit exceeded. Please wait before sending more messages.' };
      } else if (error.message?.includes('Session closed')) {
        return { success: false, error: 'WhatsApp session has been closed. Please reconnect.' };
      } else if (error.message?.includes('Media too large')) {
        return { success: false, error: 'Media file is too large. Please use a smaller file.' };
      }
      
      return { success: false, error: error.message || 'Failed to send media' };
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
        { 
          isConnected: false, 
          qrCode: undefined,
          status: 'disconnected',
          lastActivity: new Date()
        }
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
    const qrSession = QRCodeManager.getSession(sessionId);
    if (qrSession && qrSession.status === 'ready' && qrSession.qrText) {
      return qrSession.qrText;
    }
    
    // Fallback to database check
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
   * Fix session status for connected sessions that have incorrect status
   */
  async fixSessionStatus(sessionId: string): Promise<boolean> {
    try {
      const client = this.clients[sessionId];
      if (!client) {
        return false;
      }

      // Check if client is actually connected
      const state = await client.getState();
      const info = client.info;
      
      if (state === 'CONNECTED' && info && info.wid) {
        // Update session to correct connected status
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          {
            isConnected: true,
            phoneNumber: info.wid.user || 'Unknown',
            status: 'connected',
            lastActivity: new Date(),
            deviceInfo: {
              name: info.pushname || 'Unknown',
              version: info.phone?.wa_version || 'Unknown'
            }
          }
        );
        
        logger.info(`Fixed session status for ${sessionId}: now marked as connected`);
        return true;
      } else {
        // Session is not actually connected, mark as disconnected
        await WhatsappSession.findOneAndUpdate(
          { sessionId },
          {
            isConnected: false,
            status: 'disconnected',
            lastActivity: new Date()
          }
        );
        
        logger.info(`Fixed session status for ${sessionId}: marked as disconnected`);
        return false;
      }
    } catch (error) {
      logger.error(`Error fixing session status for ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Initialize a new WhatsApp session using QR Code Manager
   */
  async initializeSession(sessionId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Starting session initialization for: ${sessionId}, user: ${userId}`);
      
      // Initialize QR session in manager
      await QRCodeManager.initializeSession(sessionId, userId);
      logger.info(`QR session initialized in manager for: ${sessionId}`);
      
      // Check if this is a retry/restart scenario
      const existingClient = this.clients[sessionId];
      const forceRestart = existingClient && (!existingClient.info || !existingClient.info.wid);
      
      logger.info(`Client status for ${sessionId}: exists=${!!existingClient}, forceRestart=${forceRestart}`);
      
      const result = await this.createClient(sessionId, userId, forceRestart);
      logger.info(`Create client result for ${sessionId}:`, result);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      // If session already exists and is connected
      if (result.message === 'Session already connected') {
        logger.info(`Session ${sessionId} already connected, marking in manager`);
        await QRCodeManager.markSessionConnected(sessionId);
        return { success: true, message: 'Session is already connected' };
      }

      logger.info(`Session ${sessionId} initialization completed successfully`);
      return { success: true, message: 'Session initialization started' };
    } catch (error) {
      logger.error(`Error initializing session ${sessionId}:`, error);
      
      // Remove session from manager on error
      QRCodeManager.removeSession(sessionId);
      
      throw error;
    }
  }
}

export default new WhatsAppService();
