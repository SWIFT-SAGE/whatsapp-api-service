import { Request, Response } from 'express';
import TemplateService from '../services/TemplateService';
import { logger } from '../utils/logger';

class TemplateController {
  /**
   * Create a new template
   * POST /api/templates
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any)._id;
      const templateData = req.body;
      
      const template = await TemplateService.createTemplate(userId, templateData);
      
      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      });
    } catch (error: any) {
      logger.error('Error in createTemplate:', error);
      
      if (error.code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Template with this name already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to create template'
        });
      }
    }
  }

  /**
   * Get all templates for the authenticated user
   * GET /api/templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any)._id;
      const { category, type, isActive } = req.query;
      
      const filters: any = {};
      if (category) filters.category = category;
      if (type) filters.type = type;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      
      const templates = await TemplateService.getUserTemplates(userId, filters);
      
      res.json({
        success: true,
        count: templates.length,
        data: templates
      });
    } catch (error: any) {
      logger.error('Error in getTemplates:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch templates'
      });
    }
  }

  /**
   * Get a single template by ID
   * GET /api/templates/:id
   */
  async getTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any)._id;
      const { id } = req.params;
      
      const template = await TemplateService.getTemplate(userId, id);
      
      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: template
      });
    } catch (error: any) {
      logger.error('Error in getTemplateById:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch template'
      });
    }
  }

  /**
   * Update a template
   * PUT /api/templates/:id
   */
  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any)._id;
      const { id } = req.params;
      const updates = req.body;
      
      const template = await TemplateService.updateTemplate(userId, id, updates);
      
      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Template updated successfully',
        data: template
      });
    } catch (error: any) {
      logger.error('Error in updateTemplate:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update template'
      });
    }
  }

  /**
   * Delete a template
   * DELETE /api/templates/:id
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any)._id;
      const { id } = req.params;
      
      const deleted = await TemplateService.deleteTemplate(userId, id);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error: any) {
      logger.error('Error in deleteTemplate:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete template'
      });
    }
  }

  /**
   * Send a message using a template
   * POST /api/templates/send
   */
  async sendTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any)._id;
      const { sessionId, to, templateId, templateName, variables, delay } = req.body;
      
      // Validate required fields
      if (!sessionId || !to) {
        res.status(400).json({
          success: false,
          message: 'sessionId and to (recipient) are required'
        });
        return;
      }
      
      if (!templateId && !templateName) {
        res.status(400).json({
          success: false,
          message: 'Either templateId or templateName is required'
        });
        return;
      }
      
      // Send custom template from database
      const result = await TemplateService.sendCustomTemplate(userId, {
        sessionId,
        to,
        templateId,
        templateName,
        variables,
        delay: delay || 2000
      });
      
      // Check if any messages were actually sent
      if (result.success && result.sent > 0) {
        res.json({
          success: true,
          message: `Template sent successfully to ${result.sent} recipient(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
          data: result
        });
      } else {
        // All messages failed
        const errorMessage = result.results?.[0]?.error || 'Failed to send template';
        res.status(400).json({
          success: false,
          message: errorMessage,
          data: result
        });
      }
    } catch (error: any) {
      logger.error('Error in sendTemplate:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send template'
      });
    }
  }

  /**
   * Get list of built-in templates (removed - no longer supported)
   * GET /api/templates/built-in
   */
  async getBuiltInTemplates(req: Request, res: Response): Promise<void> {
    try {
      // Built-in templates removed
      res.json({
        success: true,
        count: 0,
        data: [],
        examples: {
          welcome: { name: 'John' },
          orderConfirmation: { name: 'John', orderId: 'ORD12345', amount: '2,499' },
          appointment: { name: 'John', date: '2024-01-15', time: '10:00 AM' },
          reminder: { name: 'John', task: 'Complete project', deadline: '2024-01-20' },
          productUpdate: { 
            productName: 'Premium Plan', 
            oldPrice: '4999', 
            newPrice: '3999',
            features: ['Feature 1', 'Feature 2'],
            link: 'https://example.com'
          },
          invoice: {
            customerName: 'John',
            items: [{ name: 'Item 1', price: '1000' }],
            total: '1000',
            dueDate: '2024-01-31'
          },
          followup: { name: 'John', topic: 'your inquiry' },
          shipping: {
            name: 'John',
            orderId: 'ORD12345',
            trackingNumber: 'TRK123456',
            carrier: 'DHL',
            deliveryDate: '2024-01-18'
          },
          feedback: { name: 'John', product: 'Premium Plan' }
        }
      });
    } catch (error: any) {
      logger.error('Error in getBuiltInTemplates:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch built-in templates'
      });
    }
  }

  /**
   * Preview a template with variables
   * POST /api/templates/preview
   */
  async previewTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as any)._id;
      const { templateId, templateName, variables } = req.body;
      
      if (!templateId && !templateName) {
        res.status(400).json({
          success: false,
          message: 'Either templateId or templateName is required'
        });
        return;
      }
      
      const identifier = templateId || templateName;
      const template = await TemplateService.getTemplate(userId, identifier);
      
      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }
      
      // Replace variables in template text
      let preview = template.content.text || '';
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          preview = preview.replace(regex, String(value));
        }
      }
      
      res.json({
        success: true,
        data: {
          original: template.content.text,
          preview,
          variables: template.variables
        }
      });
    } catch (error: any) {
      logger.error('Error in previewTemplate:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to preview template'
      });
    }
  }
}

export default new TemplateController();
