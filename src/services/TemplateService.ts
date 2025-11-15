import MessageTemplate, { IMessageTemplate } from '../models/MessageTemplate';
import whatsappService from './whatsappService';
import { logger } from '../utils/logger';
import { MessageMedia, Buttons, List } from 'whatsapp-web.js';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getAllBuiltInTemplates, getBuiltInTemplateById, BuiltInTemplateDefinition } from './BuiltInTemplates';

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
  async sendTemplate(options: SendTemplateOptions): Promise<any> {
    try {
      const { sessionId, to, templateId, templateName, variables = {} } = options;
      
      // Handle single or multiple recipients
      const recipients = Array.isArray(to) ? to : [to];
      
      // Get built-in template
      const identifier = templateId || templateName!;
      const builtInTemplate = getBuiltInTemplateById(identifier);
      
      if (!builtInTemplate) {
        throw new Error(`Template not found: ${identifier}`);
      }
      
      const results = [];
      
      for (const recipient of recipients) {
        try {
          // Format phone number - preserve + sign if present, otherwise add it
          let chatId: string;
          if (recipient.includes('@')) {
            chatId = recipient;
          } else {
            // Remove spaces, dashes, parentheses but keep + and digits
            let cleaned = recipient.replace(/[\s\-\(\)]/g, '');
            // If it doesn't start with +, add it (assuming country code is included)
            if (!cleaned.startsWith('+')) {
              cleaned = '+' + cleaned;
            }
            // Remove + for WhatsApp format (country code without +)
            chatId = `${cleaned.substring(1)}@c.us`;
          }
          
          logger.info(`Sending ${builtInTemplate.type} template "${builtInTemplate.id}" to ${chatId}`);
          
          let result: any;
          
          // Handle different template types
          switch (builtInTemplate.type) {
            case 'text':
              const messageText = this.replaceVariables(builtInTemplate.content.text || '', variables);
              logger.info(`Text template message: ${messageText.substring(0, 100)}...`);
              result = await whatsappService.sendMessage(sessionId, chatId, messageText);
              break;
              
            case 'buttons':
              logger.info(`Sending button template with ${builtInTemplate.content.buttons?.length || 0} buttons`);
              result = await this.sendBuiltInButtonTemplate(sessionId, chatId, builtInTemplate, variables);
              break;
              
            case 'list':
              logger.info(`Sending list template with ${builtInTemplate.content.listSections?.length || 0} sections`);
              result = await this.sendBuiltInListTemplate(sessionId, chatId, builtInTemplate, variables);
              break;
              
            default:
              throw new Error(`Unsupported template type: ${builtInTemplate.type}`);
          }
          
          if (!result.success) {
            logger.error(`Failed to send template to ${chatId}: ${result.error}`);
          } else {
            logger.info(`Template sent successfully to ${chatId}, messageId: ${result.messageId}`);
          }
          
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
          logger.error(`Error sending template to ${recipient}:`, error);
          results.push({
            to: recipient,
            success: false,
            error: error.message || 'Unknown error'
          });
        }
      }
      
      const sentCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      // Return success only if at least one message was sent successfully
      return {
        success: sentCount > 0,
        sent: sentCount,
        failed: failedCount,
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
              result = await whatsappService.sendMessage(sessionId, chatId, messageText);
              break;
              
            case 'media':
              result = await this.sendMediaTemplate(sessionId, chatId, template, variables);
              break;
              
            case 'buttons':
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
        return await whatsappService.sendMediaFromUrl(sessionId, chatId, template.content.mediaUrl, caption);
      } else {
        throw new Error('Media URL is required for media templates');
      }
    } catch (error: any) {
      logger.error('Error sending media template:', error);
      throw error;
    }
  }

  /**
   * Send button template (using whatsapp-web.js Buttons class)
   */
  private async sendButtonTemplate(sessionId: string, chatId: string, template: IMessageTemplate, variables: TemplateVariable): Promise<any> {
    try {
      // Replace variables in text
      const bodyText = template.content.text 
        ? this.replaceVariables(template.content.text, variables)
        : '';
      
      const buttonTitle = template.content.buttonTitle 
        ? this.replaceVariables(template.content.buttonTitle, variables)
        : undefined;
      
      const buttonFooter = template.content.buttonFooter 
        ? this.replaceVariables(template.content.buttonFooter, variables)
        : undefined;
      
      // Prepare buttons (max 3 buttons)
      const buttonList = template.content.buttons && template.content.buttons.length > 0
        ? template.content.buttons.slice(0, 3).map(btn => ({
            id: btn.id,
            body: this.replaceVariables(btn.body, variables)
          }))
        : [];
      
      if (buttonList.length === 0) {
        throw new Error('At least one button is required for button templates');
      }
      
      // Create Buttons object
      const buttons = new Buttons(
        bodyText,
        buttonList,
        buttonTitle || '',
        buttonFooter || ''
      );
      
      return await whatsappService.sendButtonMessage(sessionId, chatId, buttons);
    } catch (error: any) {
      logger.error('Error sending button template:', error);
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
   * Send built-in button template
   */
  private async sendBuiltInButtonTemplate(sessionId: string, chatId: string, template: BuiltInTemplateDefinition, variables: TemplateVariable): Promise<any> {
    try {
      const bodyText = template.content.text 
        ? this.replaceVariables(template.content.text, variables)
        : '';
      
      const buttonTitle = template.content.buttonTitle 
        ? this.replaceVariables(template.content.buttonTitle, variables)
        : '';
      
      const buttonFooter = template.content.buttonFooter 
        ? this.replaceVariables(template.content.buttonFooter, variables)
        : '';
      
      const buttonList = template.content.buttons.map((btn: any) => ({
        id: btn.id,
        body: this.replaceVariables(btn.body, variables)
      }));
      
      const buttons = new Buttons(
        bodyText,
        buttonList,
        buttonTitle,
        buttonFooter
      );
      
      return await whatsappService.sendButtonMessage(sessionId, chatId, buttons);
    } catch (error: any) {
      logger.error('Error sending built-in button template:', error);
      throw error;
    }
  }

  /**
   * Send built-in list template
   */
  private async sendBuiltInListTemplate(sessionId: string, chatId: string, template: BuiltInTemplateDefinition, variables: TemplateVariable): Promise<any> {
    try {
      const listBody = template.content.listBody 
        ? this.replaceVariables(template.content.listBody, variables)
        : '';
      
      const listButtonText = template.content.listButtonText || 'View Options';
      const listTitle = template.content.listTitle || '';
      const listFooter = template.content.listFooter || '';
      
      const sections = template.content.listSections.map((section: any) => ({
        title: section.title,
        rows: section.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description
        }))
      }));
      
      const list = new List(
        listBody,
        listButtonText,
        sections,
        listTitle,
        listFooter
      );
      
      return await whatsappService.sendListMessage(sessionId, chatId, list);
    } catch (error: any) {
      logger.error('Error sending built-in list template:', error);
      throw error;
    }
  }

  /**
   * Get all built-in template definitions
   */
  getBuiltInTemplates(): BuiltInTemplateDefinition[] {
    return getAllBuiltInTemplates();
  }
}

export default new TemplateService();

