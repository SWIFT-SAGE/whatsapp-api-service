import express from 'express';
import TemplateController from '../controllers/TemplateController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Template routes
router.get('/', TemplateController.getTemplates);
router.get('/:templateId', TemplateController.getTemplate);
router.post('/', TemplateController.createTemplate);
router.put('/:templateId', TemplateController.updateTemplate);
router.delete('/:templateId', TemplateController.deleteTemplate);
router.post('/:templateId/render', TemplateController.renderTemplate);
router.post('/:templateId/use', TemplateController.incrementUsage);

export default router;

