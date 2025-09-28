import * as QRCode from 'qrcode';
import { logger } from '../utils/logger';

export interface QRCodeOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export interface QRCodeResult {
  success: boolean;
  dataURL?: string;
  error?: string;
}

export class QRCodeService {
  private static readonly DEFAULT_OPTIONS: QRCodeOptions = {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 300,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };

  /**
   * Generate QR code data URL from text
   */
  static async generateDataURL(text: string, options?: QRCodeOptions): Promise<QRCodeResult> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'QR code text cannot be empty'
        };
      }

      const qrOptions = { ...this.DEFAULT_OPTIONS, ...options };
      
      const dataURL = await QRCode.toDataURL(text, qrOptions);
      
      logger.info(`QR code generated successfully for text length: ${text.length}`);
      
      return {
        success: true,
        dataURL
      };
    } catch (error) {
      logger.error('Error generating QR code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code'
      };
    }
  }

  /**
   * Generate QR code as SVG string
   */
  static async generateSVG(text: string, options?: QRCodeOptions): Promise<QRCodeResult> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'QR code text cannot be empty'
        };
      }

      const qrOptions = { ...this.DEFAULT_OPTIONS, ...options };
      
      const svg = await QRCode.toString(text, { 
        ...qrOptions, 
        type: 'svg' 
      });
      
      logger.info(`QR code SVG generated successfully for text length: ${text.length}`);
      
      return {
        success: true,
        dataURL: svg
      };
    } catch (error) {
      logger.error('Error generating QR code SVG:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code SVG'
      };
    }
  }

  /**
   * Validate QR code text
   */
  static validateQRText(text: string): { valid: boolean; error?: string } {
    if (!text) {
      return { valid: false, error: 'QR code text is required' };
    }

    if (text.length > 4296) {
      return { valid: false, error: 'QR code text is too long (max 4296 characters)' };
    }

    // Basic validation for WhatsApp QR codes - just check if it's not empty and reasonable length
    if (text.length < 10) {
      return { valid: false, error: 'QR code text is too short' };
    }

    return { valid: true };
  }

  /**
   * Check if QR code is expired (older than 5 minutes)
   */
  static isQRCodeExpired(generatedAt: Date): boolean {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    return generatedAt < fiveMinutesAgo;
  }
}

export default QRCodeService;
