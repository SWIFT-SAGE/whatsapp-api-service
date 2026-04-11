import { Request, Response } from 'express';
import CampaignService from '../services/CampaignService';
import { IUser } from '../models/User';
import { logger } from '../utils/logger';

class CampaignController {
  /** POST /api/campaigns */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { sessionId, name, message, recipients, tags, mediaUrl, caption, delayBetweenMessages, scheduledAt } = req.body;

      if (!sessionId || !name || !message) {
        res.status(400).json({ success: false, message: 'sessionId, name, message are required' });
        return;
      }

      let campaign;
      if (tags && Array.isArray(tags) && tags.length > 0) {
        // Build recipient list from Contact Book tags
        campaign = await CampaignService.createFromTags({ userId, sessionId, name, message, tags, mediaUrl, caption, delayBetweenMessages });
      } else {
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
          res.status(400).json({ success: false, message: 'Provide recipients array or tags to build recipient list' });
          return;
        }
        campaign = await CampaignService.create({ userId, sessionId, name, message, recipients, mediaUrl, caption, delayBetweenMessages, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined });
      }

      res.status(201).json({ success: true, data: campaign });
    } catch (err: any) {
      logger.error('CampaignController.create error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /** GET /api/campaigns */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { status, page, limit } = req.query;
      const result = await CampaignService.list(
        userId,
        status as string,
        page ? parseInt(page as string) : 1,
        limit ? parseInt(limit as string) : 20
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** GET /api/campaigns/:id */
  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const campaign = await CampaignService.getById(userId, req.params.id);
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Campaign not found' });
        return;
      }
      res.json({ success: true, data: campaign });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** POST /api/campaigns/:id/start */
  async start(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      await CampaignService.start(userId, req.params.id);
      res.json({ success: true, message: 'Campaign started' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /** POST /api/campaigns/:id/pause */
  async pause(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      await CampaignService.pause(userId, req.params.id);
      res.json({ success: true, message: 'Campaign paused' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /** POST /api/campaigns/:id/cancel */
  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      await CampaignService.cancel(userId, req.params.id);
      res.json({ success: true, message: 'Campaign cancelled' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /** DELETE /api/campaigns/:id */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const deleted = await CampaignService.delete(userId, req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Campaign not found' });
        return;
      }
      res.json({ success: true, message: 'Campaign deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

export default new CampaignController();
