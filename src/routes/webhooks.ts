import express, { Request, Response } from 'express';
import { param } from 'express-validator';
import { IUser } from '../models/User';
import WebhookController from '../controllers/WebhookController';
import WebhookService from '../services/WebhookService';
import { handleValidationErrors } from '../middleware/validation';
import {
  validateWebhookId,
  validateCreateWebhook,
  validateUpdateWebhook,
  validateGetWebhooks,
  validateTestWebhook,
  validateGetWebhookLogs,
  validateGetWebhookStats,
  validateBulkWebhookOperation,
  validateRetryWebhook,
  validateExportWebhooks
} from '../validation/webhookValidation';

const router = express.Router();

// Webhook CRUD operations
router.post('/', validateCreateWebhook, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const webhook = await WebhookService.createWebhook(userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Webhook created successfully',
      data: webhook
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create webhook'
    });
  }
});

router.get('/', validateGetWebhooks, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { sessionId } = req.query;
    const webhooks = await WebhookService.getUserWebhooks(userId, sessionId as string);
    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retrieve webhooks'
    });
  }
});

router.get('/:webhookId', validateWebhookId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookId } = req.params;
    const webhook = await WebhookService.getWebhook(webhookId, userId);
    res.json({
      success: true,
      data: webhook
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : 'Webhook not found'
    });
  }
});

router.put('/:webhookId', validateWebhookId, validateUpdateWebhook, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookId } = req.params;
    const webhook = await WebhookService.updateWebhook(webhookId, userId, req.body);
    res.json({
      success: true,
      message: 'Webhook updated successfully',
      data: webhook
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update webhook'
    });
  }
});

router.delete('/:webhookId', validateWebhookId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookId } = req.params;
    await WebhookService.deleteWebhook(webhookId, userId);
    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete webhook'
    });
  }
});

// Webhook testing
router.post('/:webhookId/test', validateWebhookId, validateTestWebhook, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookId } = req.params;
    const webhook = await WebhookService.getWebhook(webhookId, userId);
    const result = await WebhookService.testWebhookDelivery(webhook);
    res.json({
      success: true,
      message: 'Webhook test completed',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to test webhook'
    });
  }
});

// Test webhook URL (without creating webhook)
router.post('/test-url', validateTestWebhook, handleValidationErrors, WebhookController.testWebhook);

// Webhook statistics
router.get('/:webhookId/stats', validateWebhookId, validateGetWebhookStats, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookId } = req.params;
    const { days } = req.query;
    const stats = await WebhookService.getWebhookStats(webhookId, userId, days ? parseInt(days as string) : 30);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get webhook statistics'
    });
  }
});

// Webhook logs
router.get('/:webhookId/logs', validateWebhookId, validateGetWebhookLogs, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookId } = req.params;
    const { limit } = req.query;
    const logs = await WebhookService.getWebhookLogs(webhookId, userId, limit ? parseInt(limit as string) : 50);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get webhook logs'
    });
  }
});

// Regenerate webhook secret
router.post('/:webhookId/regenerate-secret', validateWebhookId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookId } = req.params;
    const result = await WebhookService.regenerateSecret(webhookId, userId);
    res.json({
      success: true,
      message: 'Webhook secret regenerated successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to regenerate webhook secret'
    });
  }
});

// Bulk operations
router.post('/bulk', validateBulkWebhookOperation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const { webhookIds, operation } = req.body;
    
    const results = [];
    for (const webhookId of webhookIds) {
      try {
        switch (operation) {
          case 'activate':
            await WebhookService.updateWebhook(webhookId, userId, { isActive: true });
            results.push({ webhookId, success: true });
            break;
          case 'deactivate':
            await WebhookService.updateWebhook(webhookId, userId, { isActive: false });
            results.push({ webhookId, success: true });
            break;
          case 'delete':
            await WebhookService.deleteWebhook(webhookId, userId);
            results.push({ webhookId, success: true });
            break;
          case 'test':
            const webhook = await WebhookService.getWebhook(webhookId, userId);
            const testResult = await WebhookService.testWebhookDelivery(webhook);
            results.push({ webhookId, ...testResult });
            break;
        }
      } catch (error) {
        results.push({ 
          webhookId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    res.json({
      success: true,
      message: `Bulk ${operation} operation completed`,
      data: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to perform bulk operation'
    });
  }
});

// Get supported events
router.get('/events/supported', (req, res) => {
  const events = WebhookService.getSupportedEvents();
  res.json({
    success: true,
    data: events
  });
});

// Export webhooks
router.get('/export', validateExportWebhooks, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser)._id.toString();
    const webhooks = await WebhookService.getUserWebhooks(userId);
    
    const { format = 'json' } = req.query;
    
    if (format === 'csv') {
      const csv = webhooks.map(webhook => ({
        id: webhook._id.toString(),
        name: webhook.url,
        url: webhook.url,
        events: webhook.events.join(';'),
        isActive: webhook.isActive.toString(),
        successCount: webhook.successCount.toString(),
        failureCount: webhook.failureCount.toString(),
        createdAt: webhook.createdAt.toISOString(),
        lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() || ''
      }));
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=webhooks.csv');
      
      // Simple CSV conversion
      const headers = Object.keys(csv[0] || {});
      const csvContent = [
        headers.join(','),
        ...csv.map(row => headers.map(header => `"${(row as any)[header] || ''}"`).join(','))
      ].join('\n');
      
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: webhooks
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to export webhooks'
    });
  }
});

export default router;
