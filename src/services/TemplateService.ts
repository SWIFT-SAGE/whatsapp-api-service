import MessageTemplate, { IMessageTemplate } from '../models/MessageTemplate';
import whatsappService from './whatsappService';
import { logger } from '../utils/logger';
import { List } from 'whatsapp-web.js';
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
  constructor() {
    // Built-in templates are now imported from BuiltInTemplates.ts
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
   * Send template message (handles built-in templates)
   */

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
              result = await whatsappService.sendMessage(sessionId, chatId, messageText);
              break;
              
            case 'product':
              result = await this.sendProductTemplate(sessionId, chatId, template, variables);
              break;
              
            case 'order':
              result = await this.sendOrderTemplate(sessionId, chatId, template, variables);
              break;
              
            case 'poll':
              result = await this.sendPollTemplate(sessionId, chatId, template, variables);
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
   * Send list template (using whatsapp-web.js List class)
   */
  private async sendListTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      // Replace variables
      const listBody = template.content.listBody 
        ? this.replaceVariables(template.content.listBody, variables)
        : '';
      
      const listButtonText = template.content.listButtonText 
        ? this.replaceVariables(template.content.listButtonText, variables)
        : 'View Options';
      
      const listTitle = template.content.listTitle 
        ? this.replaceVariables(template.content.listTitle, variables)
        : '';
      
      const listFooter = template.content.listFooter 
        ? this.replaceVariables(template.content.listFooter, variables)
        : '';
      
      // Prepare sections with variable replacement
      const sections = template.content.listSections && template.content.listSections.length > 0
        ? template.content.listSections.map(section => ({
            title: this.replaceVariables(section.title, variables),
            rows: section.rows.map(row => ({
              id: row.id,
              title: this.replaceVariables(row.title, variables),
              description: row.description ? this.replaceVariables(row.description, variables) : undefined
            }))
          }))
        : [];
      
      if (sections.length === 0) {
        throw new Error('At least one section is required for list templates');
      }
      
      // Create List object
      const list = new List(
        listBody,
        listButtonText,
        sections,
        listTitle,
        listFooter
      );
      
      return await whatsappService.sendListMessage(sessionId, chatId, list);
    } catch (error: any) {
      logger.error('Error sending list template:', error);
      throw error;
    }
  }


  /**
   * Send product template (whatsapp-web.js Product class)
   */
  private async sendProductTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      const product = {
        productImage: template.content.productImage ? this.replaceVariables(template.content.productImage, variables) : '',
        businessOwnerJid: template.content.businessOwnerJid || chatId,
        productId: template.content.productId ? this.replaceVariables(template.content.productId, variables) : `PROD-${Date.now()}`,
        title: template.content.title ? this.replaceVariables(template.content.title, variables) : '',
        description: template.content.productDescription ? this.replaceVariables(template.content.productDescription, variables) : '',
        currencyCode: template.content.currencyCode || 'INR',
        priceAmount1000: template.content.priceAmount1000 || 0,
        url: template.content.productUrl ? this.replaceVariables(template.content.productUrl, variables) : '',
        retailerId: template.content.retailerId ? this.replaceVariables(template.content.retailerId, variables) : ''
      };

      logger.info('Sending product message:', { productId: product.productId, title: product.title });
      
      return await whatsappService.sendMessage(sessionId, chatId, product as any);
    } catch (error: any) {
      logger.error('Error sending product template:', error);
      throw error;
    }
  }

  /**
   * Send order template (whatsapp-web.js Order class)
   */
  private async sendOrderTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      const order = {
        orderId: template.content.orderId ? this.replaceVariables(template.content.orderId, variables) : `ORD-${Date.now()}`,
        thumbnail: template.content.thumbnail || '',
        itemCount: template.content.itemCount || template.content.orderItems?.length || 0,
        status: template.content.orderStatus || 'pending',
        surface: template.content.surface || 'catalog',
        message: template.content.orderMessage ? this.replaceVariables(template.content.orderMessage, variables) : '',
        orderTitle: template.content.orderTitle ? this.replaceVariables(template.content.orderTitle, variables) : '',
        sellerJid: template.content.sellerJid || chatId,
        token: template.content.token || `token_${Date.now()}`,
        totalAmount1000: template.content.totalAmount1000 || 0,
        totalCurrencyCode: template.content.totalCurrencyCode || 'INR',
        items: template.content.orderItems?.map(item => ({
          productId: this.replaceVariables(item.productId, variables),
          name: this.replaceVariables(item.name, variables),
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          currency: item.currency,
          priceAmount1000: item.priceAmount1000
        })) || []
      };

      logger.info('Sending order message:', { orderId: order.orderId, itemCount: order.itemCount });
      
      return await whatsappService.sendMessage(sessionId, chatId, order as any);
    } catch (error: any) {
      logger.error('Error sending order template:', error);
      throw error;
    }
  }

  /**
   * Send poll template (whatsapp-web.js Poll class)
   */
  private async sendPollTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      const poll = {
        name: template.content.pollName ? this.replaceVariables(template.content.pollName, variables) : '',
        options: template.content.pollOptions?.map(opt => this.replaceVariables(opt, variables)) || [],
        selectableOptionsCount: template.content.selectableOptionsCount || 1
      };

      logger.info('Sending poll message:', { question: poll.name, optionCount: poll.options.length });
      
      return await whatsappService.sendMessage(sessionId, chatId, poll as any);
    } catch (error: any) {
      logger.error('Error sending poll template:', error);
      throw error;
    }
  }

}

export default new TemplateService();

