import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { config } from './config';
import { connectDatabase } from './config/database';
import { logger, requestLogger } from './utils/logger';
import { 
  globalErrorHandler, 
  notFoundHandler, 
  timeoutHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  gracefulShutdown
} from './utils/errorHandler';
import { 
  performanceMonitor, 
  errorTracker, 
  startMonitoring 
} from './utils/monitoring';
import { securityMiddleware } from './config/security';
import { compressionConfig } from './config/performance';
import apiRoutes from './routes';
import healthRoutes from './routes/health';
import whatsappService from './services/whatsappService';

// Load environment variables
dotenv.config();

// Handle uncaught exceptions and unhandled rejections
handleUncaughtException();
handleUnhandledRejection();

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins in development, configure properly in production
    credentials: true,
  },
});

const PORT = config.server.port;
const NODE_ENV = config.env;

// Trust proxy (for load balancers)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet(config.security.helmet));
app.use(securityMiddleware.requestSizeLimit);
app.use(securityMiddleware.ipFilter());
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

// Performance middleware
app.use(compressionConfig.middleware);
app.use(performanceMonitor);

// Request logging
app.use(requestLogger);

// Request timeout
app.use(timeoutHandler(120000)); // Set a default 120 second timeout for WhatsApp operations

// Body parsing middleware
app.use(express.json({ limit: '50mb' })); // Set a reasonable default body size limit
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Import controllers for web routes
import AuthController from './controllers/authController';
import { authenticateToken, optionalAuth } from './middleware/auth';
import WhatsappSession from './models/WhatsappSession';
import MessageLog from './models/MessageLog';
import User from './models/User';
import Analytics from './models/Analytics';

// Web routes (for dashboard)
app.get('/', optionalAuth, (req, res) => {
  // Provide default data for all included pages
  const defaultData = {
    user: req.user || null,
    stats: {
      totalMessages: 0,
      activeSessions: 0,
      totalSessions: 0,
      deliveryRate: '0'
    },
    sessions: [],
    recentAnalytics: [],
    plans: [
      {
        name: 'Free',
        price: 0,
        features: ['1 WhatsApp Session', '100 Messages/day', 'Basic Support', 'API Access'],
        popular: false
      },
      {
        name: 'Basic',
        price: 29,
        features: ['5 WhatsApp Sessions', '10,000 Messages/day', 'Priority Support', 'Advanced API', 'Webhooks'],
        popular: true
      },
      {
        name: 'Pro',
        price: 99,
        features: ['25 WhatsApp Sessions', '100,000 Messages/day', '24/7 Support', 'Full API Access', 'Custom Webhooks', 'Analytics'],
        popular: false
      },
      {
        name: 'Enterprise',
        price: 299,
        features: ['Unlimited Sessions', 'Unlimited Messages', 'Dedicated Support', 'Custom Integration', 'SLA Guarantee'],
        popular: false
      }
    ],
    baseUrl: `${req.protocol}://${req.get('host')}`
  };
  
  res.render('index', defaultData);
});

// Dashboard route with authentication and real data
app.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const user = req.user!;
    const userId = user._id;
    
    // Get user sessions
    const sessions = await WhatsappSession.find({ userId }).sort({ createdAt: -1 });
    const activeSessions = sessions.filter(s => s.isConnected).length;
    
    // Get message statistics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const messageStats = await MessageLog.aggregate([
      { $match: { userId, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          sentMessages: { $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] } },
          receivedMessages: { $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] } },
          deliveredMessages: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
        }
      }
    ]);
    
    const stats = messageStats[0] || {
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      deliveredMessages: 0
    };
    
    // Calculate delivery rate
    const deliveryRate = stats.sentMessages > 0 
      ? ((stats.deliveredMessages / stats.sentMessages) * 100).toFixed(1)
      : '0.0';
    
    // Get recent analytics
    const analytics = await Analytics.find({ userId })
      .sort({ date: -1 })
      .limit(7);
    
    const dashboardData = {
      user: {
        name: user.name,
        email: user.email,
        subscription: user.subscription,
        apiKey: user.apiKey
      },
      stats: {
        totalSessions: sessions.length,
        activeSessions,
        totalMessages: stats.totalMessages,
        deliveryRate: `${deliveryRate}%`
      },
      sessions: sessions.slice(0, 5), // Show only first 5 sessions
      recentAnalytics: analytics
    };
    
    res.render('pages/dashboard', dashboardData);
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.render('pages/dashboard', {
      user: { name: 'User', email: '', subscription: { plan: 'free' }, apiKey: '' },
      stats: { totalSessions: 0, activeSessions: 0, totalMessages: 0, deliveryRate: '0%' },
      sessions: [],
      recentAnalytics: []
    });
  }
});

// Login route with optional authentication (redirect if already logged in)
app.get('/login', optionalAuth, (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  res.render('pages/login');
});

// Register route with optional authentication (redirect if already logged in)
app.get('/register', optionalAuth, (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  res.render('pages/register');
});

// Pricing route with optional user data
app.get('/pricing', optionalAuth, (req, res) => {
  const pricingData = {
    user: req.user || null,
    plans: [
      {
        name: 'Free',
        price: 0,
        features: ['1 WhatsApp Session', '100 Messages/day', 'Basic Support', 'API Access'],
        limits: { sessions: 1, messages: 100, apiCalls: 1000 }
      },
      {
        name: 'Basic',
        price: 29,
        features: ['5 WhatsApp Sessions', '1,000 Messages/day', 'Email Support', 'Webhooks', 'Analytics'],
        limits: { sessions: 5, messages: 1000, apiCalls: 10000 }
      },
      {
        name: 'Pro',
        price: 99,
        features: ['25 WhatsApp Sessions', '10,000 Messages/day', 'Priority Support', 'Advanced Analytics', 'Custom Webhooks'],
        limits: { sessions: 25, messages: 10000, apiCalls: 100000 }
      },
      {
        name: 'Enterprise',
        price: 299,
        features: ['Unlimited Sessions', 'Unlimited Messages', '24/7 Support', 'Custom Integration', 'Dedicated Manager'],
        limits: { sessions: -1, messages: -1, apiCalls: -1 }
      }
    ]
  };
  res.render('pages/pricing', pricingData);
});

// API docs route with user context
app.get('/api-docs', optionalAuth, (req, res) => {
  const apiDocsData = {
    user: req.user || null,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    version: '1.0.0',
    currentPage: 'overview'
  };
  res.render('pages/api-docs', apiDocsData);
});

// API documentation pages routes
app.get('/api-docs/docs/:page', optionalAuth, (req, res) => {
  const { page } = req.params;
  const validPages = [
    'authentication', 'sessions', 'messages', 'webhooks', 
    'rate-limiting', 'error-codes', 'sdks-libraries', 
    'api-testing', 'code-examples'
  ];
  
  if (!validPages.includes(page)) {
    return res.status(404).render('pages/404');
  }
  
  const docData = {
    user: req.user || null,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    version: '1.0.0',
    currentPage: page
  };
  
  res.render(`pages/docs/${page}`, docData);
});

// Authentication routes for form submissions
app.post('/auth/login', AuthController.login);
app.post('/auth/register', AuthController.register);
app.post('/auth/logout', authenticateToken, AuthController.logout);
app.post('/auth/forgot-password', AuthController.forgotPassword);
app.post('/auth/reset-password', AuthController.resetPassword);
app.get('/auth/verify-email/:token', AuthController.verifyEmail);

// API routes for AJAX calls from frontend
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user!._id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Dashboard stats endpoint removed - now using /api/analytics/dashboard

// Mock billing endpoints for demo purposes
app.post('/api/billing/subscribe', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'This is a demo - billing functionality not implemented',
    checkoutUrl: null
  });
});

app.get('/api/billing/subscription-status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    subscription: {
      planName: 'Free',
      status: 'active',
      nextBillingDate: null
    }
  });
});

// Health check routes (before other routes for quick access)
app.use('/health', healthRoutes);

// API routes
app.use('/api', apiRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  
  socket.on('join-user-room', (userId) => {
    socket.join(userId);
    logger.info(`Socket ${socket.id} joined room: ${userId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Error tracking middleware
app.use(errorTracker);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Catch-all for web routes (after API routes)
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/health')) {
    return res.status(404).json({ 
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        timestamp: new Date().toISOString(),
      }
    });
  }
  res.status(404).render('pages/404');
});

// Start server function
const startServer = async () => {
  try {
    logger.info('🚀 Starting WhatsApp API Service...');
    
    // Validate configuration
    logger.info('📋 Validating configuration...');
    // config validation would happen here
    
    // Connect to database
    logger.info('🔌 Connecting to database...');
    try {
      await connectDatabase();
      logger.info('✅ Database connected successfully');
      
      // Initialize WhatsApp service after database connection
      logger.info('📱 Initializing WhatsApp service...');
      await whatsappService.initialize();
      logger.info('✅ WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      logger.warn('⚠️  Server will start without database connectivity');
      logger.warn('⚠️  Some features may not work properly');
    }
    
    // Start monitoring services
    logger.info('📊 Starting monitoring services...');
    startMonitoring();
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`\n🎉 WhatsApp API Service started successfully!`);
      logger.info(`📍 Server: http://localhost:${PORT}`);
      logger.info(`🌍 Environment: ${NODE_ENV}`);
      logger.info(`💚 Health: http://localhost:${PORT}/health`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`🔗 API Base: http://localhost:${PORT}/api`);
      logger.info(`📈 Metrics: http://localhost:${PORT}/health/metrics`);
      logger.info('\n✨ Service is ready to accept requests!');
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Setup graceful shutdown
gracefulShutdown(server);

// Make io available globally for other modules
(global as any).io = io;

// Start the server
startServer();
