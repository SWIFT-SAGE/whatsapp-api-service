import express from 'express';
import authRoutes from './auth';
import whatsappRoutes from './whatsapp';
import analyticsRoutes from './analytics';
import dashboardRoutes from './dashboard';
import webhookRoutes from './webhooks';
import paymentRoutes from './payments';
import templateRoutes from './templates';
import { authenticateToken, authenticateApiKey } from '../middleware/auth';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp API Service',
    version: '1.0.0',
    description: 'Professional WhatsApp API service for businesses',
    endpoints: {
      auth: '/api/auth',
      whatsapp: '/api/whatsapp',
      analytics: '/api/analytics',
      webhooks: '/api/webhooks',
      payments: '/api/payments',
      health: '/api/health'
    },
    documentation: '/api-docs'
  });
});

// Route handlers
router.use('/auth', authRoutes);
// Use flexible auth for WhatsApp routes (accepts both JWT token and API key)
import { flexibleAuth } from '../middleware/flexAuth';
router.use('/whatsapp', flexibleAuth, whatsappRoutes);
router.use('/analytics', authenticateToken, analyticsRoutes);
router.use('/webhooks', authenticateToken, webhookRoutes);
router.use('/payments', paymentRoutes);
router.use('/templates', templateRoutes);
router.use('/dashboard', dashboardRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

export default router;
