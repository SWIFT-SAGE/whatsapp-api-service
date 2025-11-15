import MessageTemplate, { IMessageTemplate } from '../models/MessageTemplate';
import WhatsAppService from './whatsappService';
import { logger } from '../utils/logger';
import { MessageMedia } from 'whatsapp-web.js';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

interface TemplateVariable {
  [key: string]: string | number;
}

interface SendTemplateOptions {
  sessionId: string;
  to: string | string[];
  templateId?: string;
  templateName?: string;
  variables?: TemplateVariable;
  delay?: number; // Delay between bulk sends in ms
}

class TemplateService {
  private whatsappService: WhatsAppService;
  private builtInTemplates: Map<string, Function>;

  constructor() {
    this.whatsappService = WhatsAppService.getInstance();
    this.builtInTemplates = this.initializeBuiltInTemplates();
  }

  /**
   * Initialize built-in templates
   */
  private initializeBuiltInTemplates(): Map<string, Function> {
    const templates = new Map<string, Function>();

    templates.set('welcome', (data: any) => 
      `*Welcome ${data.name}!* 👋\n\n` +
      `Thank you for contacting us. How can we help you today?`
    );

    templates.set('orderConfirmation', (data: any) => 
      `Hi *${data.name}*,\n\n` +
      `✅ Your order has been confirmed!\n\n` +
      `📦 Order ID: \`${data.orderId}\`\n` +
      `💰 Amount: ₹${data.amount}\n\n` +
      `We'll notify you once it ships.`
    );

    templates.set('appointment', (data: any) => 
      `Hello *${data.name}*,\n\n` +
      `📅 Your appointment is confirmed:\n` +
      `🗓️ Date: ${data.date}\n` +
      `🕐 Time: ${data.time}\n\n` +
      `See you soon!`
    );

    templates.set('reminder', (data: any) =>
      `⏰ *Reminder for ${data.name}*\n\n` +
      `Task: ${data.task}\n` +
      `Deadline: ${data.deadline}\n\n` +
      `_This is an automated reminder_`
    );

    templates.set('productUpdate', (data: any) => {
      const featuresText = data.features
        ? data.features.map((f: string) => `• ${f}`).join('\n')
        : '';
      
      return `🎉 *New Product Launch!*\n\n` +
             `${data.productName}\n` +
             `Price: ~₹${data.oldPrice}~ *₹${data.newPrice}*\n\n` +
             `Features:\n${featuresText}\n\n` +
             `> Order now: ${data.link}`;
    });

    templates.set('invoice', (data: any) => {
      const itemsText = data.items
        ? data.items.map((item: any) => `• ${item.name} - ₹${item.price}`).join('\n')
        : '';
      
      return `*INVOICE*\n` +
             `${'='.repeat(30)}\n\n` +
             `Customer: ${data.customerName}\n\n` +
             `Items:\n${itemsText}\n\n` +
             `${'='.repeat(30)}\n` +
             `*Total: ₹${data.total}*\n` +
             `Due Date: \`${data.dueDate}\`\n\n` +
             `_Thank you for your business!_`;
    });

    templates.set('followup', (data: any) =>
      `Hey ${data.name},\n\n` +
      `Just following up on ${data.topic}. ` +
      `Let me know if you have any questions!`
    );

    templates.set('shipping', (data: any) =>
      `📦 *Shipping Update*\n\n` +
      `Hi ${data.name},\n\n` +
      `Your order ${data.orderId} has been shipped!\n\n` +
      `🚚 Tracking: \`${data.trackingNumber}\`\n` +
      `📍 Carrier: ${data.carrier}\n` +
      `📅 Expected Delivery: ${data.deliveryDate}`
    );

    templates.set('feedback', (data: any) =>
      `Hi ${data.name}! 😊\n\n` +
      `We'd love to hear your feedback about ${data.product}.\n\n` +
      `Please rate your experience (1-5 stars) and share your thoughts.\n\n` +
      `Thank you for helping us improve!`
    );

    return templates;
  }

  /**
   * Replace variables in template text
   */
  private replaceVariables(text: string, variables: TemplateVariable): string {
    let result = text;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  /**
   * Apply WhatsApp formatting
   */
  private applyFormatting(text: string, formatting: any): string {
    let formatted = text;
    
    // These are already in the template, but we can add more formatting if needed
    if (formatting.useBold) {
      // Already using *text* in templates
    }
    
    if (formatting.useItalic) {
      // Already using _text_ in templates
    }
    
    return formatted;
  }

  /**
   * Create a new template
   */
  async createTemplate(userId: string, templateData: Partial<IMessageTemplate>): Promise<IMessageTemplate> {
    try {
      const template = new MessageTemplate({
        userId,
        ...templateData
      });

      await template.save();
      logger.info(`Template created: ${template.name} for user ${userId}`);
      
      return template;
    } catch (error: any) {
      logger.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Get template by ID or name
   */
  async getTemplate(userId: string, identifier: string): Promise<IMessageTemplate | null> {
    try {
      // Try to find by ID first
      let template = await MessageTemplate.findOne({ _id: identifier, userId });
      
      // If not found, try by name
      if (!template) {
        template = await MessageTemplate.findOne({ name: identifier, userId, isActive: true });
      }
      
      return template;
    } catch (error: any) {
      logger.error('Error getting template:', error);
      throw error;
    }
  }

  /**
   * Get all templates for a user
   */
  async getUserTemplates(userId: string, filters?: any): Promise<IMessageTemplate[]> {
    try {
      const query: any = { userId };
      
      if (filters?.category) {
        query.category = filters.category;
      }
      
      if (filters?.type) {
        query.type = filters.type;
      }
      
      if (filters?.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      const templates = await MessageTemplate.find(query).sort({ createdAt: -1 });
      return templates;
    } catch (error: any) {
      logger.error('Error getting user templates:', error);
      throw error;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(userId: string, templateId: string, updates: Partial<IMessageTemplate>): Promise<IMessageTemplate | null> {
    try {
      const template = await MessageTemplate.findOneAndUpdate(
        { _id: templateId, userId },
        { $set: updates },
        { new: true }
      );
      
      if (template) {
        logger.info(`Template updated: ${template.name}`);
      }
      
      return template;
    } catch (error: any) {
      logger.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    try {
      const result = await MessageTemplate.deleteOne({ _id: templateId, userId });
      return result.deletedCount > 0;
    } catch (error: any) {
      logger.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Send template message
   */
  async sendTemplate(options: SendTemplateOptions): Promise<any> {
    try {
      const { sessionId, to, templateId, templateName, variables = {} } = options;
      
      // Handle single or multiple recipients
      const recipients = Array.isArray(to) ? to : [to];
      
      // Get template
      let template: IMessageTemplate | null = null;
      let messageText: string = '';
      
      if (templateId || templateName) {
        const identifier = templateId || templateName!;
        
        // First, try to get from database (we need userId, so we'll handle this in the controller)
        // For now, check built-in templates
        if (this.builtInTemplates.has(identifier)) {
          const templateFunc = this.builtInTemplates.get(identifier)!;
          messageText = templateFunc(variables);
        } else {
          throw new Error(`Template not found: ${identifier}`);
        }
      } else {
        throw new Error('Template ID or name is required');
      }
      
      const results = [];
      
      for (const recipient of recipients) {
        try {
          // Format phone number
          const chatId = recipient.includes('@') ? recipient : `${recipient.replace(/[^\d]/g, '')}@c.us`;
          
          // Send message
          const result = await this.whatsappService.sendMessage(sessionId, chatId, messageText);
          
          results.push({
            to: recipient,
            success: result.success,
            messageId: result.messageId,
            error: result.error
          });
          
          // Add delay between bulk sends
          if (recipients.length > 1 && options.delay) {
            await new Promise(resolve => setTimeout(resolve, options.delay));
          }
        } catch (error: any) {
          results.push({
            to: recipient,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error: any) {
      logger.error('Error sending template:', error);
      throw error;
    }
  }

  /**
   * Send template with custom content (from database template)
   */
  async sendCustomTemplate(userId: string, options: SendTemplateOptions): Promise<any> {
    try {
      const { sessionId, to, templateId, templateName, variables = {} } = options;
      
      // Get template from database
      const identifier = templateId || templateName!;
      const template = await this.getTemplate(userId, identifier);
      
      if (!template) {
        throw new Error(`Template not found: ${identifier}`);
      }
      
      // Handle single or multiple recipients
      const recipients = Array.isArray(to) ? to : [to];
      const results = [];
      
      for (const recipient of recipients) {
        try {
          const chatId = recipient.includes('@') ? recipient : `${recipient.replace(/[^\d]/g, '')}@c.us`;
          let result: any;
          
          // Handle different template types
          switch (template.type) {
            case 'text':
              const messageText = this.replaceVariables(template.content.text || '', variables);
              result = await this.whatsappService.sendMessage(sessionId, chatId, messageText);
              break;
              
            case 'media':
              result = await this.sendMediaTemplate(sessionId, chatId, template, variables);
              break;
              
            case 'button':
              result = await this.sendButtonTemplate(sessionId, chatId, template, variables);
              break;
              
            case 'list':
              result = await this.sendListTemplate(sessionId, chatId, template, variables);
              break;
              
            default:
              throw new Error(`Unsupported template type: ${template.type}`);
          }
          
          // Update usage count
          await MessageTemplate.findByIdAndUpdate(template._id, { $inc: { usageCount: 1 } });
          
          results.push({
            to: recipient,
            success: result.success,
            messageId: result.messageId,
            error: result.error
          });
          
          // Add delay between bulk sends
          if (recipients.length > 1 && options.delay) {
            await new Promise(resolve => setTimeout(resolve, options.delay));
          }
        } catch (error: any) {
          results.push({
            to: recipient,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error: any) {
      logger.error('Error sending custom template:', error);
      throw error;
    }
  }

  /**
   * Send media template
   */
  private async sendMediaTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      const caption = template.content.caption 
        ? this.replaceVariables(template.content.caption, variables)
        : undefined;
      
      if (template.content.mediaUrl) {
        // Send from URL
        return await this.whatsappService.sendMediaFromUrl(sessionId, chatId, template.content.mediaUrl, caption);
      } else {
        throw new Error('Media URL is required for media templates');
      }
    } catch (error: any) {
      logger.error('Error sending media template:', error);
      throw error;
    }
  }

  /**
   * Send button template (using formatted text)
   */
  private async sendButtonTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      let messageText = template.content.text 
        ? this.replaceVariables(template.content.text, variables)
        : '';
      
      // Add buttons as formatted text (WhatsApp Web.js doesn't support interactive buttons via client)
      if (template.content.buttons && template.content.buttons.length > 0) {
        messageText += '\n\n_Select an option:_\n';
        template.content.buttons.forEach((button, index) => {
          messageText += `\n${index + 1}. ${button.text}`;
        });
      }
      
      if (template.content.footer) {
        messageText += `\n\n_${template.content.footer}_`;
      }
      
      return await this.whatsappService.sendMessage(sessionId, chatId, messageText);
    } catch (error: any) {
      logger.error('Error sending button template:', error);
      throw error;
    }
  }

  /**
   * Send list template (using formatted text)
   */
  private async sendListTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      let messageText = template.content.listTitle 
        ? `*${this.replaceVariables(template.content.listTitle, variables)}*\n\n`
        : '';
      
      // Add list sections
      if (template.content.listSections && template.content.listSections.length > 0) {
        template.content.listSections.forEach((section) => {
          messageText += `*${section.title}*\n`;
          section.rows.forEach((row, index) => {
            messageText += `${index + 1}. *${row.title}*`;
            if (row.description) {
              messageText += `\n   _${row.description}_`;
            }
            messageText += '\n';
          });
          messageText += '\n';
        });
      }
      
      if (template.content.footer) {
        messageText += `_${template.content.footer}_`;
      }
      
      return await this.whatsappService.sendMessage(sessionId, chatId, messageText);
    } catch (error: any) {
      logger.error('Error sending list template:', error);
      throw error;
    }
  }

  /**
   * Get built-in template names
   */
  getBuiltInTemplates(): string[] {
    return Array.from(this.builtInTemplates.keys());
  }
}

export default new TemplateService();

