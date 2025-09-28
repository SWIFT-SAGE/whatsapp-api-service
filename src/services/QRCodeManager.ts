import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import QRCodeService from './QRCodeService';
import WhatsappSession from '../models/WhatsappSession';

export interface QRCodeSession {
  sessionId: string;
  userId: string;
  qrText?: string;
  qrDataURL?: string;
  status: 'initializing' | 'generating' | 'ready' | 'expired' | 'connected' | 'error';
  error?: string;
  createdAt: Date;
  lastUpdated: Date;
}

export class QRCodeManager extends EventEmitter {
  private sessions: Map<string, QRCodeSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    // Clean up expired sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);
  }

  /**
   * Initialize a new QR code session
   */
  async initializeSession(sessionId: string, userId: string): Promise<QRCodeSession> {
    try {
      const session: QRCodeSession = {
        sessionId,
        userId,
        status: 'initializing',
        createdAt: new Date(),
        lastUpdated: new Date()
      };

      this.sessions.set(sessionId, session);
      
      logger.info(`QR code session initialized: ${sessionId}`);
      
      // Emit initialization event
      this.emit('session:initialized', session);
      
      return session;
    } catch (error) {
      logger.error(`Error initializing QR session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Update QR code for a session
   */
  async updateQRCode(sessionId: string, qrText: string): Promise<void> {
    try {
      logger.info(`Updating QR code for session: ${sessionId}, text length: ${qrText.length}`);
      
      const session = this.sessions.get(sessionId);
      if (!session) {
        logger.error(`QR session not found in manager: ${sessionId}`);
        throw new Error(`QR session not found: ${sessionId}`);
      }

      // Validate QR text
      const validation = QRCodeService.validateQRText(qrText);
      if (!validation.valid) {
        logger.error(`QR validation failed for session ${sessionId}: ${validation.error}`);
        throw new Error(validation.error);
      }

      // Update session status
      session.status = 'generating';
      session.qrText = qrText;
      session.lastUpdated = new Date();
      
      logger.info(`QR session status updated to generating: ${sessionId}`);
      this.emit('session:generating', session);

      // Generate QR code data URL
      const qrResult = await QRCodeService.generateDataURL(qrText);
      
      if (!qrResult.success) {
        logger.error(`QR generation failed for session ${sessionId}: ${qrResult.error}`);
        session.status = 'error';
        session.error = qrResult.error;
        this.emit('session:error', session);
        throw new Error(qrResult.error);
      }

      // Update session with QR data
      session.qrDataURL = qrResult.dataURL;
      session.status = 'ready';
      session.lastUpdated = new Date();

      // Update database
      await WhatsappSession.findOneAndUpdate(
        { sessionId },
        { 
          qrCode: qrText,
          lastQRGenerated: new Date(),
          status: 'pending'
        }
      );

      logger.info(`QR code successfully generated and stored for session: ${sessionId}, status: ${session.status}`);
      
      // Emit ready event
      this.emit('session:ready', session);
      
    } catch (error) {
      logger.error(`Error updating QR code for session ${sessionId}:`, error);
      
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'error';
        session.error = error instanceof Error ? error.message : 'Unknown error';
        session.lastUpdated = new Date();
        this.emit('session:error', session);
      }
      
      throw error;
    }
  }

  /**
   * Mark session as connected
   */
  async markSessionConnected(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'connected';
      session.lastUpdated = new Date();
      
      // Clear QR data as it's no longer needed
      session.qrText = undefined;
      session.qrDataURL = undefined;
      
      logger.info(`QR session marked as connected: ${sessionId}`);
      this.emit('session:connected', session);
      
      // Remove from active sessions after a delay
      setTimeout(() => {
      }, 30000); // Keep for 30 seconds for any final events
    }
  }

  /**
   * Get QR session
   */
  getSession(sessionId: string): QRCodeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all QR sessions (for debugging)
   */
  getAllSessions(): { [sessionId: string]: QRCodeSession } {
    const result: { [sessionId: string]: QRCodeSession } = {};
    this.sessions.forEach((session, sessionId) => {
      result[sessionId] = session;
    });
    return result;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): QRCodeSession[] {
    return Array.from(this.sessions.values()).filter(session => session.userId === userId);
  }
  /**
   * Remove a session
   */
  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      logger.info(`QR session removed: ${sessionId}`);
      this.emit('session:removed', session);
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      // Mark sessions as expired after 5 minutes
      if (QRCodeService.isQRCodeExpired(session.createdAt) && session.status !== 'connected') {
        session.status = 'expired';
        session.lastUpdated = now;
        expiredSessions.push(sessionId);
        this.emit('session:expired', session);
      }
    }

    // Remove expired sessions after 10 minutes
    for (const [sessionId, session] of this.sessions.entries()) {
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      if (session.createdAt < tenMinutesAgo) {
        this.sessions.delete(sessionId);
        logger.info(`Expired QR session cleaned up: ${sessionId}`);
      }
    }

    if (expiredSessions.length > 0) {
      logger.info(`Marked ${expiredSessions.length} QR sessions as expired`);
    }
  }

  /**
   * Get session statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
  } {
    const stats = {
      total: this.sessions.size,
      byStatus: {} as Record<string, number>
    };

    for (const session of this.sessions.values()) {
      stats.byStatus[session.status] = (stats.byStatus[session.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    this.removeAllListeners();
    logger.info('QR Code Manager destroyed');
  }
}

// Export singleton instance
export default new QRCodeManager();
