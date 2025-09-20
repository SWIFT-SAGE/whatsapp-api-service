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
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 5000, // 5 seconds
    greetingTimeout: 3000, // 3 seconds
    socketTimeout: 5000 // 5 seconds
  });
};

// Send email function
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    // Check if SMTP is configured
    const isSmtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST;
    
    if (!isSmtpConfigured) {
      logger.warn('SMTP not configured, skipping email send');
      throw new Error('SMTP not configured');
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'WhatsApp API Service'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };
    
    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${options.to}`, { messageId: result.messageId });
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw new Error('Email sending failed');
  }
};

// Test email configuration
export const testEmailConfig = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration is valid');
    return true;
  } catch (error) {
    logger.error('Email configuration is invalid:', error);
    return false;
  }
};
