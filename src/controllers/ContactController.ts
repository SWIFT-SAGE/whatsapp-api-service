import { Request, Response } from 'express';
import ContactService from '../services/ContactService';
import { IUser } from '../models/User';
import { logger } from '../utils/logger';

class ContactController {
  /** GET /api/contacts */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { search, tags, isBlocked, page, limit } = req.query;

      const { contacts, total } = await ContactService.list({
        userId,
        search: search as string,
        tags: tags ? (tags as string).split(',') : undefined,
        isBlocked: isBlocked === 'true' ? true : isBlocked === 'false' ? false : undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? Math.min(parseInt(limit as string), 200) : 50,
      });

      res.json({ success: true, data: contacts, total });
    } catch (err: any) {
      logger.error('ContactController.list error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** GET /api/contacts/:id */
  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const contact = await ContactService.getById(userId, req.params.id);
      if (!contact) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      res.json({ success: true, data: contact });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** POST /api/contacts */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const contact = await ContactService.create(userId, req.body);
      res.status(201).json({ success: true, data: contact });
    } catch (err: any) {
      if (err.code === 11000) {
        res.status(409).json({ success: false, message: 'A contact with this phone number already exists' });
        return;
      }
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /** PUT /api/contacts/:id */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const contact = await ContactService.update(userId, req.params.id, req.body);
      if (!contact) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      res.json({ success: true, data: contact });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /** DELETE /api/contacts/:id */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const deleted = await ContactService.delete(userId, req.params.id);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      res.json({ success: true, message: 'Contact deleted' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** POST /api/contacts/:id/block */
  async block(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const contact = await ContactService.block(userId, req.params.id);
      if (!contact) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      res.json({ success: true, data: contact, message: 'Contact blocked' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** POST /api/contacts/:id/unblock */
  async unblock(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const contact = await ContactService.unblock(userId, req.params.id);
      if (!contact) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      res.json({ success: true, data: contact, message: 'Contact unblocked' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** PATCH /api/contacts/:id/tags */
  async updateTags(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const { add = [], remove = [] } = req.body;
      const contact = await ContactService.updateTags(userId, req.params.id, add, remove);
      if (!contact) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      res.json({ success: true, data: contact });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** GET /api/contacts/tags */
  async getTags(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as IUser)._id.toString();
      const tags = await ContactService.getAllTags(userId);
      res.json({ success: true, data: tags });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** POST /api/contacts/import/csv */
  async importCSV(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No CSV file uploaded. Use field name "file".' });
        return;
      }
      const userId = (req.user as IUser)._id.toString();
      const result = await ContactService.importFromCSV(userId, req.file.buffer);
      res.json({ success: true, data: result });
    } catch (err: any) {
      logger.error('CSV import error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

export default new ContactController();
