import { Request, Response } from 'express';
import SchedulerService from '../services/SchedulerService';
import { IUser } from '../models/User';
import { logger } from '../utils/logger';

class ScheduledMessageController {
  /** POST /api/scheduled-messages */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { sessionId, to, message, scheduledAt, mediaUrl, caption } = req.body;

      if (!sessionId || !to || !message || !scheduledAt) {
        res.status(400).json({ success: false, message: 'sessionId, to, message, scheduledAt are required' });
        return;
      }

      const date = new Date(scheduledAt);
      if (isNaN(date.getTime())) {
        res.status(400).json({ success: false, message: 'scheduledAt must be a valid ISO date string' });
        return;
      }

      const scheduled = await SchedulerService.schedule({ userId, sessionId, to, message, scheduledAt: date, mediaUrl, caption });
      res.status(201).json({ success: true, data: scheduled });
    } catch (err: any) {
      logger.error('ScheduledMessageController.create error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /** GET /api/scheduled-messages */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { status, page, limit } = req.query;
      const result = await SchedulerService.list(
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

  /** DELETE /api/scheduled-messages/:id */
  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const msg = await SchedulerService.cancel(userId, req.params.id);
      if (!msg) {
        res.status(404).json({ success: false, message: 'Scheduled message not found or not cancellable' });
        return;
      }
      res.json({ success: true, data: msg, message: 'Message cancelled' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export default new ScheduledMessageController();
