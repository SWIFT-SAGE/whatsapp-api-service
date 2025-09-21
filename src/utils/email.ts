import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Create transporter
const createTransporter = () => {
  // Check if SMTP is configured
  const isSmtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST;
  
  if (!isSmtpConfigured) {
    throw new Error('SMTP not configured');
  }

  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: secure, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
  
  
    debug: process.env.NODE_ENV === 'development', // Enable debug logging in development
    logger: process.env.NODE_ENV === 'development' // Enable logger in development
  });
};

// Send email function with retry logic
export const sendEmail = async (options: EmailOptions, retries: number = 3): Promise<void> => {
  try {
    // Check if SMTP is configured
    const isSmtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST;
    
    if (!isSmtpConfigured) {
      logger.warn('SMTP not configured, skipping email send');
      throw new Error('SMTP not configured');
    }

    const transporter = createTransporter();
    
    // Verify connection before sending
    await transporter.verify();
    
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'WhatsApp API Service'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };
    
    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${options.to}`, { messageId: result.messageId });
  } catch (error) {
    logger.error('Failed to send email:', error);
    
    // Retry logic for connection errors
    if (retries > 0 && (error as any).code === 'ETIMEDOUT') {
      logger.info(`Retrying email send (${retries} attempts left)...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return sendEmail(options, retries - 1);
    }
    
    throw new Error('Email sending failed');
  }
};

// Test email configuration
export const testEmailConfig = async (): Promise<boolean> => {
  try {
    const isSmtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST;
    
    if (!isSmtpConfigured) {
      logger.warn('Email configuration is not set');
      return false;
    }

    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration is valid');
    return true;
  } catch (error) {
    logger.error('Email configuration is invalid:', error);
    return false;
  }
};
