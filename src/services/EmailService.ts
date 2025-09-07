import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

interface EmailData {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface BulkEmailData {
  recipients: Array<{
    email: string;
    data?: Record<string, any>;
  }>;
  template: string;
  subject: string;
  batchSize?: number;
}

class EmailService {
  private transporter!: Transporter;
  private config: EmailConfig;
  private templates: Map<string, handlebars.TemplateDelegate> = new Map();
  private templatesPath: string;

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'noreply@whatsapp-api.com'
    };

    this.templatesPath = path.join(__dirname, '../templates/emails');
    this.initializeTransporter();
    this.loadTemplates();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10 // messages per second
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email transporter verification failed:', error);
        } else {
          logger.info('Email transporter is ready');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Load email templates
   */
  private async loadTemplates(): Promise<void> {
    try {
      const templateFiles = [
        'welcome.hbs',
        'email-verification.hbs',
        'password-reset.hbs',
        'password-changed.hbs',
        'subscription-updated.hbs',
        'usage-alert.hbs',
        'webhook-failed.hbs',
        'session-disconnected.hbs',
        'monthly-report.hbs'
      ];

      for (const file of templateFiles) {
        try {
          const templatePath = path.join(this.templatesPath, file);
          const templateContent = await fs.readFile(templatePath, 'utf-8');
          const templateName = file.replace('.hbs', '');
          this.templates.set(templateName, handlebars.compile(templateContent));
        } catch (error) {
          logger.warn(`Template ${file} not found, using fallback`);
          this.createFallbackTemplate(file.replace('.hbs', ''));
        }
      }

      logger.info(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      logger.error('Error loading email templates:', error);
    }
  }

  /**
   * Create fallback templates
   */
  private createFallbackTemplate(templateName: string): void {
    const fallbackTemplates: Record<string, string> = {
      'welcome': `
        <h1>Welcome to WhatsApp API Service!</h1>
        <p>Hello {{name}},</p>
        <p>Welcome to our WhatsApp API service. Your account has been created successfully.</p>
        <p>You can now start using our API to send WhatsApp messages.</p>
        <p>Best regards,<br>WhatsApp API Team</p>
      `,
      'email-verification': `
        <h1>Verify Your Email</h1>
        <p>Hello {{name}},</p>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="{{verificationUrl}}">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `,
      'password-reset': `
        <h1>Reset Your Password</h1>
        <p>Hello {{name}},</p>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p><a href="{{resetUrl}}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      'password-changed': `
        <h1>Password Changed</h1>
        <p>Hello {{name}},</p>
        <p>Your password has been successfully changed.</p>
        <p>If you didn't make this change, please contact support immediately.</p>
      `,
      'subscription-updated': `
        <h1>Subscription Updated</h1>
        <p>Hello {{name}},</p>
        <p>Your subscription has been updated to: {{plan}}</p>
        <p>New limits:</p>
        <ul>
          <li>Messages per day: {{messageLimit}}</li>
          <li>API calls per hour: {{apiLimit}}</li>
        </ul>
      `,
      'usage-alert': `
        <h1>Usage Alert</h1>
        <p>Hello {{name}},</p>
        <p>You have used {{percentage}}% of your {{type}} limit.</p>
        <p>Current usage: {{current}} / {{limit}}</p>
        <p>Consider upgrading your plan to avoid service interruption.</p>
      `,
      'webhook-failed': `
        <h1>Webhook Delivery Failed</h1>
        <p>Hello {{name}},</p>
        <p>Your webhook endpoint failed to receive events:</p>
        <p>URL: {{webhookUrl}}</p>
        <p>Error: {{error}}</p>
        <p>Please check your endpoint and update if necessary.</p>
      `,
      'session-disconnected': `
        <h1>WhatsApp Session Disconnected</h1>
        <p>Hello {{name}},</p>
        <p>Your WhatsApp session "{{sessionName}}" has been disconnected.</p>
        <p>Please reconnect your session to continue sending messages.</p>
      `,
      'monthly-report': `
        <h1>Monthly Usage Report</h1>
        <p>Hello {{name}},</p>
        <p>Here's your usage summary for {{month}}:</p>
        <ul>
          <li>Messages sent: {{messagesSent}}</li>
          <li>API calls: {{apiCalls}}</li>
          <li>Total cost: {{totalCost}}</li>
        </ul>
      `
    };

    if (fallbackTemplates[templateName]) {
      this.templates.set(templateName, handlebars.compile(fallbackTemplates[templateName]));
    }
  }

  /**
   * Send single email
   */
  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      let html = emailData.html;
      let text = emailData.text;

      // Use template if specified
      if (emailData.template && this.templates.has(emailData.template)) {
        const template = this.templates.get(emailData.template)!;
        html = template(emailData.data || {});
        
        // Generate text version from HTML if not provided
        if (!text) {
          text = this.htmlToText(html);
        }
      }

      const mailOptions: SendMailOptions = {
        from: this.config.from,
        to: emailData.to,
        subject: emailData.subject,
        html,
        text,
        attachments: emailData.attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${emailData.to}`, {
        messageId: result.messageId,
        subject: emailData.subject
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email:', error, {
        to: emailData.to,
        subject: emailData.subject
      });
      return false;
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(bulkData: BulkEmailData): Promise<{ sent: number; failed: number }> {
    const batchSize = bulkData.batchSize || 10;
    let sent = 0;
    let failed = 0;

    try {
      const template = this.templates.get(bulkData.template);
      if (!template) {
        throw new AppError(`Template ${bulkData.template} not found`);
      }

      // Process in batches
      for (let i = 0; i < bulkData.recipients.length; i += batchSize) {
        const batch = bulkData.recipients.slice(i, i + batchSize);
        const promises = batch.map(async (recipient) => {
          try {
            const html = template(recipient.data || {});
            const text = this.htmlToText(html);

            const mailOptions: SendMailOptions = {
              from: this.config.from,
              to: recipient.email,
              subject: bulkData.subject,
              html,
              text
            };

            await this.transporter.sendMail(mailOptions);
            return true;
          } catch (error) {
            logger.error(`Failed to send email to ${recipient.email}:`, error);
            return false;
          }
        });

        const results = await Promise.all(promises);
        sent += results.filter(r => r).length;
        failed += results.filter(r => !r).length;

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < bulkData.recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Bulk email completed: ${sent} sent, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      logger.error('Bulk email failed:', error);
      return { sent, failed: bulkData.recipients.length };
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Welcome to WhatsApp API Service',
      template: 'welcome',
      data: { name }
    });
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(email: string, name: string, verificationToken: string): Promise<boolean> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      template: 'email-verification',
      data: { name, verificationUrl, verificationToken }
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, name: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      template: 'password-reset',
      data: { name, resetUrl, resetToken }
    });
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChanged(email: string, name: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Password Changed Successfully',
      template: 'password-changed',
      data: { name }
    });
  }

  /**
   * Send subscription update notification
   */
  async sendSubscriptionUpdate(email: string, name: string, plan: string, limits: any): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Subscription Updated',
      template: 'subscription-updated',
      data: { 
        name, 
        plan, 
        messageLimit: limits.messagesPerDay,
        apiLimit: limits.apiCallsPerHour
      }
    });
  }

  /**
   * Send usage alert
   */
  async sendUsageAlert(email: string, name: string, type: string, current: number, limit: number): Promise<boolean> {
    const percentage = Math.round((current / limit) * 100);
    
    return this.sendEmail({
      to: email,
      subject: `Usage Alert: ${percentage}% of ${type} limit reached`,
      template: 'usage-alert',
      data: { name, type, current, limit, percentage }
    });
  }

  /**
   * Send webhook failure notification
   */
  async sendWebhookFailure(email: string, name: string, webhookUrl: string, error: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Webhook Delivery Failed',
      template: 'webhook-failed',
      data: { name, webhookUrl, error }
    });
  }

  /**
   * Send session disconnected notification
   */
  async sendSessionDisconnected(email: string, name: string, sessionName: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'WhatsApp Session Disconnected',
      template: 'session-disconnected',
      data: { name, sessionName }
    });
  }

  /**
   * Send monthly report
   */
  async sendMonthlyReport(email: string, name: string, reportData: any): Promise<boolean> {
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    
    return this.sendEmail({
      to: email,
      subject: `Monthly Report - ${month}`,
      template: 'monthly-report',
      data: { 
        name, 
        month,
        messagesSent: reportData.messagesSent,
        apiCalls: reportData.apiCalls,
        totalCost: reportData.totalCost.toFixed(2)
      }
    });
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(email: string, subject: string, html: string, text?: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Test email configuration
   */
  async testEmailConfig(): Promise<boolean> {
    try {
      await this.transporter.verify();
      
      // Send test email
      const testResult = await this.sendEmail({
        to: this.config.auth.user,
        subject: 'Email Configuration Test',
        html: '<h1>Test Email</h1><p>Your email configuration is working correctly!</p>',
        text: 'Test Email - Your email configuration is working correctly!'
      });

      return testResult;
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      return false;
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStats(): Promise<any> {
    try {
      // This would typically come from a database or email service provider
      // For now, return basic transporter info
      return {
        isConnected: this.transporter.isIdle(),
        poolSize: this.transporter.get('pool') ? 5 : 1,
        queueSize: 0, // Would need to implement queue tracking
        sentToday: 0, // Would need to implement tracking
        failedToday: 0 // Would need to implement tracking
      };
    } catch (error) {
      logger.error('Error getting email stats:', error);
      return null;
    }
  }

  /**
   * Close email transporter
   */
  async close(): Promise<void> {
    try {
      this.transporter.close();
      logger.info('Email transporter closed');
    } catch (error) {
      logger.error('Error closing email transporter:', error);
    }
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default new EmailService();
export { EmailService, EmailData, BulkEmailData };