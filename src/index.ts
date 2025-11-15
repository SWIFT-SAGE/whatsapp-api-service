import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './config/passport';
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

// Cookie parsing middleware
app.use(cookieParser());

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-that-is-at-least-32-characters-long',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize() as any);
app.use(passport.session() as any);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Static files with caching headers for better performance
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, // Cache for 1 day in production
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Cache images, fonts, and other assets longer
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
    // Cache CSS and JS for shorter time
    else if (filePath.match(/\.(css|js)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

// SEO Redirect middleware (must be before route definitions)
import { seoRedirectMiddleware, trailingSlashMiddleware, lowercaseUrlMiddleware } from './middleware/redirects';
app.use(lowercaseUrlMiddleware);
app.use(trailingSlashMiddleware);
app.use(seoRedirectMiddleware);

// Import controllers for web routes
import AuthController from './controllers/authController';
import { authenticateToken, authenticateWeb, optionalAuth } from './middleware/auth';
import WhatsappSession from './models/WhatsappSession';
import MessageLog from './models/MessageLog';
import User, { IUser } from './models/User';
import Analytics from './models/Analytics';

// Web routes (for dashboard)
app.get('/', optionalAuth, (req, res) => {
  // Provide default data for all included pages
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
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
    baseUrl,
    fullUrl,
    seo: {
      title: 'WhatsApp Business API 2025 | Integration & Automation',
      description: 'Build WhatsApp chatbot solutions with our REST API. Integrate with Shopify, automate marketing campaigns, and boost customer engagement. Free tier available for developers.',
      keywords: 'WhatsApp Business API, WhatsApp API integration, WhatsApp chatbot API, REST API WhatsApp messaging, WhatsApp marketing automation, integrate WhatsApp with Shopify, WhatsApp API for developers, WhatsApp Business API 2025',
      url: fullUrl,
      type: 'website'
    },
    showFAQSchema: true,
    showPricingSchema: false
  };
  
  res.render('index', defaultData);
});

// Dashboard route - requires authentication
app.get('/dashboard', authenticateWeb, async (req, res) => {
  try {
    // authenticateWeb middleware ensures user exists and redirects if not
    const user = req.user as IUser;
    const userId = user._id;
    
    // Get user sessions
    const sessions = await WhatsappSession.find({ userId }).sort({ createdAt: -1 });
    const activeSessions = sessions.filter(s => s.isConnected).length;
    
    // Get message statistics (last 30 days) - only outbound messages
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const messageStats = await MessageLog.aggregate([
      { $match: { userId, createdAt: { $gte: thirtyDaysAgo }, direction: 'outbound' } }, // Only count outbound messages
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 }, // Total outbound messages
          sentMessages: { $sum: 1 }, // Same as total (all are outbound)
          receivedMessages: { $sum: 0 }, // Not counting received messages
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
      recentAnalytics: analytics,
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
      authToken: req.cookies.authToken // Add auth token for client-side use
    };
    res.render('pages/dashboard', dashboardData);
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.render('pages/dashboard', {
      user: { name: 'User', email: '', subscription: { plan: 'free' }, apiKey: '' },
      stats: { totalSessions: 0, activeSessions: 0, totalMessages: 0, deliveryRate: '0%' },
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
      ]
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

// Pricing route with optional user data and SEO
app.get('/pricing', optionalAuth, (req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const pricingData = {
    user: req.user || null,
    plans: [
      {
        name: 'Free',
        price: 0,
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: ['5 Messages Total', '1 Chatbot', 'Basic Support', 'API Access'],
        limits: { messages: 5, botMessages: 0, chatbots: 1, apiCalls: 10 }
      },
      {
        name: 'Basic',
        price: 25,
        monthlyPrice: 25,
        yearlyPrice: 270,
        features: ['100,000 Messages/month', '1 Chatbot', 'Email Support', 'Webhooks', 'Analytics'],
        limits: { messages: 100000, botMessages: 100000, chatbots: 1, apiCalls: 2000 }
      },
      {
        name: 'Pro',
        price: 40,
        monthlyPrice: 40,
        yearlyPrice: 432,
        features: ['Unlimited API Messages', '10,000 Bot Messages/month', '2 Chatbots', 'Priority Support', 'Advanced Analytics'],
        limits: { messages: -1, botMessages: 10000, chatbots: 2, apiCalls: 20000 }
      }
    ],
    baseUrl,
    fullUrl,
    seo: {
      title: 'Pricing - WhatsApp API Plans Starting at $0',
      description: 'Flexible WhatsApp API pricing plans for businesses of all sizes. Start free with 5 messages, upgrade to Basic ($25/mo) or Pro ($40/mo) for advanced features.',
      keywords: 'WhatsApp API pricing, WhatsApp Business API cost, messaging API plans, affordable WhatsApp API',
      url: fullUrl,
      type: 'website'
    },
    showPricingSchema: true,
    showFAQSchema: false
  };
  res.render('pricing', pricingData);
});

// Contact route with optional user data
app.get('/contact', optionalAuth, (req, res) => {
  const contactData = {
    user: req.user || null
  };
  res.render('pages/contact', contactData);
});

// SEO-optimized documentation route (new URL structure)
app.get('/docs/whatsapp-api', optionalAuth, (req, res) => {
  const apiDocsData = {
    user: req.user || null,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    version: '1.0.0',
    currentPage: 'overview'
  };
  res.render('api-docs', apiDocsData);
});

// SEO-optimized documentation pages routes (new URL structure)
app.get('/docs/whatsapp-api/:page', optionalAuth, (req, res) => {
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

// Legacy routes (keep for backwards compatibility - will be redirected by middleware)
app.get('/api-docs', optionalAuth, (req, res) => {
  const apiDocsData = {
    user: req.user || null,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    version: '1.0.0',
    currentPage: 'overview'
  };
  res.render('api-docs', apiDocsData);
});

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

// Static pages routes
app.get('/about', optionalAuth, (req, res) => {
  res.render('pages/about', { user: req.user || null });
});

app.get('/blog', optionalAuth, (req, res) => {
  res.render('pages/blog', { user: req.user || null });
});

app.get('/careers', optionalAuth, (req, res) => {
  res.render('pages/careers', { user: req.user || null });
});

app.get('/help', optionalAuth, (req, res) => {
  res.render('pages/help', { user: req.user || null });
});

app.get('/community', optionalAuth, (req, res) => {
  res.render('pages/community', { user: req.user || null });
});

app.get('/security', optionalAuth, (req, res) => {
  res.render('pages/security', { user: req.user || null });
});

app.get('/privacy', optionalAuth, (req, res) => {
  res.render('pages/privacy', { user: req.user || null });
});

app.get('/terms', optionalAuth, (req, res) => {
  res.render('pages/terms', { user: req.user || null });
});

app.get('/cookies', optionalAuth, (req, res) => {
  res.render('pages/cookies', { user: req.user || null });
});

app.get('/licenses', optionalAuth, (req, res) => {
  res.render('pages/licenses', { user: req.user || null });
});

app.get('/changelog', optionalAuth, (req, res) => {
  res.render('pages/changelog', { user: req.user || null });
});

// Authentication routes for form submissions
app.post('/auth/login', AuthController.login);
app.post('/auth/register', AuthController.register);
app.post('/auth/logout', authenticateToken, AuthController.logout);
app.post('/auth/forgot-password', AuthController.forgotPassword);
app.post('/auth/reset-password', AuthController.resetPassword);
app.get('/auth/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.render('pages/email-verification', { 
        success: false,
        message: 'Verification token is required'
      });
    }

    // Find user with verification token
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.render('pages/email-verification', { 
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Verify the user
    user.isVerified = true;
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // Generate JWT token for automatic login
    const jwt = require('jsonwebtoken');
    const payload = { userId: user._id.toString() };
    const authToken = jwt.sign(payload, config.jwt.secret, { 
      expiresIn: config.jwt.expiresIn 
    });

    // Set the token as an HTTP-only cookie
    res.cookie('authToken', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.render('pages/email-verification', { 
      success: true,
      message: 'Email verified successfully!',
      authToken: authToken // Pass token to frontend for immediate use
    });
  } catch (error) {
    res.render('pages/email-verification', { 
      success: false,
      message: 'Email verification failed'
    });
  }
});

// Success page after OAuth
app.get('/success', optionalAuth, (req, res) => {
  res.render('pages/success', { user: req.user || null });
});

// Feature pages
app.get('/features/whatsapp-chatbot-api', optionalAuth, (req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.render('pages/features/whatsapp-chatbot-api', {
    user: req.user || null,
    baseUrl,
    fullUrl,
    seo: {
      title: 'WhatsApp Chatbot API for Developers | Build AI-Powered Bots',
      description: 'Build intelligent WhatsApp chatbots with our REST API. Create conversational AI, automate customer support, and handle inquiries 24/7 with natural language processing.',
      keywords: 'WhatsApp chatbot API, conversational AI WhatsApp, WhatsApp bot development, automated WhatsApp responses, NLP chatbot API',
      url: fullUrl,
      type: 'article'
    }
  });
});

// Integration pages
app.get('/integrations/shopify-whatsapp', optionalAuth, (req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.render('pages/integrations/shopify-whatsapp', {
    user: req.user || null,
    baseUrl,
    fullUrl,
    seo: {
      title: 'Shopify WhatsApp Integration | Automated Order Notifications',
      description: 'Connect Shopify with WhatsApp Business API. Send order confirmations, shipping updates, and abandoned cart reminders. Boost conversions by 40% with WhatsApp.',
      keywords: 'Shopify WhatsApp integration, WhatsApp Shopify plugin, automated order updates, abandoned cart WhatsApp, e-commerce messaging',
      url: fullUrl,
      type: 'article'
    }
  });
});

app.get('/integrations/salesforce-whatsapp', optionalAuth, (req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.render('pages/integrations/salesforce-whatsapp', {
    user: req.user || null,
    baseUrl,
    fullUrl,
    seo: {
      title: 'Salesforce WhatsApp Integration | CRM Messaging Automation',
      description: 'Integrate Salesforce CRM with WhatsApp Business API. Automate lead nurturing, send appointment reminders, and engage prospects via WhatsApp. 60% higher conversion rates.',
      keywords: 'Salesforce WhatsApp integration, CRM WhatsApp automation, lead nurturing WhatsApp, Salesforce messaging API',
      url: fullUrl,
      type: 'article'
    }
  });
});

// Use case pages
app.get('/use-cases/ecommerce-order-notifications', optionalAuth, (req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.render('pages/use-cases/ecommerce-order-notifications', {
    user: req.user || null,
    baseUrl,
    fullUrl,
    seo: {
      title: 'WhatsApp Order Notifications for E-commerce | 98% Open Rate',
      description: 'Send automated order confirmations, shipping updates, and delivery notifications via WhatsApp. Reduce support tickets by 70% and increase customer satisfaction.',
      keywords: 'WhatsApp order notifications, e-commerce order updates, automated shipping notifications, order tracking WhatsApp',
      url: fullUrl,
      type: 'article'
    }
  });
});

app.get('/use-cases/customer-support-automation', optionalAuth, (req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.render('pages/use-cases/customer-support-automation', {
    user: req.user || null,
    baseUrl,
    fullUrl,
    seo: {
      title: 'WhatsApp Customer Support Automation | AI Chatbot Support',
      description: 'Automate customer support with AI-powered WhatsApp chatbots. Resolve 80% of inquiries instantly, reduce costs by 60%, and provide 24/7 multilingual assistance.',
      keywords: 'WhatsApp customer support automation, AI support chatbot, automated customer service, WhatsApp helpdesk',
      url: fullUrl,
      type: 'article'
    }
  });
});

// Logout route to clear all authentication
app.get('/logout', (req, res) => {
  // Clear the authentication cookie with all possible options
  res.clearCookie('authToken', { 
    path: '/',
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    sameSite: 'lax'
  });
  
  // Also clear any other potential auth cookies
  res.clearCookie('token');
  res.clearCookie('jwt');
  
  // Set cache control headers to prevent caching
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Redirect to login with a query parameter to indicate logout
  res.redirect('/login?logout=true');
});

// Debug endpoint to check OAuth configuration
app.get('/debug/oauth-config', (req, res) => {
  const googleOAuthConfig = require('./config/google-oauth').googleOAuthConfig;
  res.json({
    environment: config.env,
    isProduction: config.isProduction,
    callbackURL: googleOAuthConfig.callbackURL,
    clientID: googleOAuthConfig.clientID.substring(0, 30) + '...',
    envVars: {
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
      PRODUCTION_URL: process.env.PRODUCTION_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      PORT: process.env.PORT
    },
    expectedInGoogleConsole: 'http://localhost:3000/auth/google/callback'
  });
});

// Google OAuth routes
app.get('/auth/google', (req, res, next) => {
  const googleOAuthConfig = require('./config/google-oauth').googleOAuthConfig;
  logger.info('🔐 Google OAuth Initiation:', {
    callbackURL: googleOAuthConfig.callbackURL,
    clientID: googleOAuthConfig.clientID.substring(0, 30) + '...',
    requestedURL: req.url,
    host: req.get('host'),
    protocol: req.protocol
  });
  next();
}, passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

app.get('/auth/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login?error=auth_failed',
    session: false
  }),
  AuthController.googleAuthCallback
);

// API routes for AJAX calls from frontend
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById((req.user as IUser)._id).select('-password');
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

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message, newsletter } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Log the contact form submission
    logger.info('Contact form submission:', { name, email, subject });

    // Save to database
    try {
      const Contact = require('./models/Contact').default;
      const newContact = new Contact({
        name,
        email,
        phone: phone || undefined,
        subject,
        message,
        newsletter: newsletter || false
      });
      
      await newContact.save();
      logger.info('Contact form saved to database:', { id: newContact._id });
    } catch (dbError) {
      logger.error('Failed to save contact form to database:', dbError);
      // Continue even if database save fails
    }

    // TODO: Send email notification to admin
    // TODO: Send confirmation email to user

    res.json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!'
    });
  } catch (error) {
    logger.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
});

// Health check routes (before other routes for quick access)
app.use('/health', healthRoutes);

// Favicon is now served from /public/favicon.ico via static files middleware

// Handle Chrome DevTools requests
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(404).json({ error: 'Chrome DevTools not supported' });
});

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
    
    // Connect to database with timeout
    logger.info('🔌 Connecting to database...');
    let databaseConnected = false;
    try {
      // Add timeout for database connection
      await Promise.race([
        connectDatabase(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timeout (60s)')), 60000)
        )
      ]);
      logger.info('✅ Database connected successfully');
      databaseConnected = true;
      
      // Initialize WhatsApp service after database connection
      logger.info('📱 Initializing WhatsApp service...');
      try {
        await whatsappService.initialize();
        logger.info('✅ WhatsApp service initialized successfully');
      } catch (whatsappError) {
        logger.error('❌ WhatsApp service initialization failed:', whatsappError);
        logger.warn('⚠️  Server will continue without WhatsApp sessions');
        logger.warn('⚠️  You can manually initialize sessions later through the dashboard');
      }
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      logger.warn('⚠️  Server will start without database connectivity');
      logger.warn('⚠️  Some features may not work properly');
      logger.warn('⚠️  Please check your MONGODB_URI and network connection');
      
      // If it's a timeout error, provide specific guidance
      if (error instanceof Error && error.message.includes('timeout')) {
        logger.warn('💡 Tip: Check if MongoDB server is running and accessible');
        logger.warn('💡 Tip: Increase timeout values in .env if using MongoDB Atlas');
        logger.warn('💡 Current timeout settings can be found in your .env file');
      }
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
