import { Request, Response } from 'express';
import MessageTemplate, { IMessageTemplate } from '../models/MessageTemplate';
import { IUser } from '../models/User';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/common';

export class TemplateController {
  /**
   * Get all templates for a user
   */
  getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req.user as IUser)._id;
      const { category, active } = req.query;

      let query: any = { userId };
      
      if (category) {
        query.category = category;
      }
      
      if (active === 'true') {
        query.isActive = true;
      }

      const templates = await MessageTemplate.find(query).sort({ createdAt: -1 });

      res.json({
        success: true,
        message: 'Templates retrieved successfully',
        data: templates
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve templates'
      } as ApiResponse);
    }
  }

  /**
   * Get a single template by ID
   */
  getTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { templateId } = req.params;
      const userId = (req.user as IUser)._id;

      const template = await MessageTemplate.findOne({ _id: templateId, userId });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Template retrieved successfully',
        data: template
      } as ApiResponse);

    } catch (error) {
      logger.error('Error getting template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve template'
      } as ApiResponse);
    }
  }

  /**
   * Create a new template
   */
  createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req.user as IUser)._id;
      const { name, category, content, description, isActive } = req.body;

      // Validate required fields
      if (!name || !category || !content) {
        res.status(400).json({
          success: false,
          message: 'Name, category, and content are required'
        } as ApiResponse);
        return;
      }

      // Validate category
      if (!['marketing', 'otp', 'custom'].includes(category)) {
        res.status(400).json({
          success: false,
          message: 'Invalid category. Must be marketing, otp, or custom'
        } as ApiResponse);
        return;
      }

      const template = new MessageTemplate({
        userId,
        name,
        category,
        content,
        description,
        isActive: isActive !== undefined ? isActive : true
      });

      await template.save();

      logger.info(`Template created: ${template._id} by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      } as ApiResponse);

    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create template'
      } as ApiResponse);
    }
  }

  /**
   * Update a template
   */
  updateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { templateId } = req.params;
      const userId = (req.user as IUser)._id;
      const { name, category, content, description, isActive } = req.body;

      const template = await MessageTemplate.findOne({ _id: templateId, userId });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        } as ApiResponse);
        return;
      }

      // Update fields if provided
      if (name) template.name = name;
      if (category) {
        if (!['marketing', 'otp', 'custom'].includes(category)) {
          res.status(400).json({
            success: false,
            message: 'Invalid category'
          } as ApiResponse);
          return;
        }
        template.category = category;
      }
      if (content) template.content = content;
      if (description !== undefined) template.description = description;
      if (isActive !== undefined) template.isActive = isActive;

      await template.save();

      logger.info(`Template updated: ${template._id} by user ${userId}`);

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: template
      } as ApiResponse);

    } catch (error) {
      logger.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update template'
      } as ApiResponse);
    }
  }

  /**
   * Delete a template
   */
  deleteTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { templateId } = req.params;
      const userId = (req.user as IUser)._id;

      const template = await MessageTemplate.findOneAndDelete({ _id: templateId, userId });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        } as ApiResponse);
        return;
      }

      logger.info(`Template deleted: ${templateId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Template deleted successfully'
      } as ApiResponse);

    } catch (error) {
      logger.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete template'
      } as ApiResponse);
    }
  }

  /**
   * Render template with variables
   */
  renderTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { templateId } = req.params;
      const userId = (req.user as IUser)._id;
      const variables = req.body.variables || {};

      const template = await MessageTemplate.findOne({ _id: templateId, userId });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        } as ApiResponse);
        return;
      }

      // Replace variables in template content
      let renderedContent = template.content;
      
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        renderedContent = renderedContent.replace(regex, value as string);
      }

      res.json({
        success: true,
        message: 'Template rendered successfully',
        data: {
          original: template.content,
          rendered: renderedContent,
          variables: template.variables,
          providedVariables: Object.keys(variables)
        }
      } as ApiResponse);

    } catch (error) {
      logger.error('Error rendering template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to render template'
      } as ApiResponse);
    }
  }

  /**
   * Increment template usage count
   */
  incrementUsage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { templateId } = req.params;
      const userId = (req.user as IUser)._id;

      const template = await MessageTemplate.findOne({ _id: templateId, userId });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template not found'
        } as ApiResponse);
        return;
      }

      await template.incrementUsage();

      res.json({
        success: true,
        message: 'Usage count updated'
      } as ApiResponse);

    } catch (error) {
      logger.error('Error incrementing template usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update usage count'
      } as ApiResponse);
    }
  }
}

export default new TemplateController();

