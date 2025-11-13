/**
 * SEO Analytics & Monitoring Configuration
 * Centralized configuration for Google Search Console, GA4, and Performance Monitoring
 * 
 * @version 1.0.0
 * @last-updated 2025-01-15
 */

module.exports = {
  /**
   * Google Search Console Configuration
   */
  googleSearchConsole: {
    // Verification Methods
    verification: {
      // HTML Meta Tag Method (Recommended)
      metaTag: '<meta name="google-site-verification" content="YOUR_VERIFICATION_CODE_HERE" />',
      
      // Alternative: HTML File Upload Method
      htmlFile: {
        filename: 'google[YOUR_VERIFICATION_CODE].html',
        content: 'google-site-verification: google[YOUR_VERIFICATION_CODE].html'
      },
      
      // Alternative: DNS TXT Record
      dnsTxt: 'google-site-verification=YOUR_VERIFICATION_CODE',
      
      // Alternative: Google Analytics Verification
      useGAAccount: true
    },

    // Sitemap Configuration
    sitemaps: {
      main: {
        url: 'https://apimessinging.com/sitemap.xml',
        status: 'pending_submission',
        frequency: 'daily',
        lastMod: '2025-01-15'
      },
      // Additional sitemaps (if needed)
      blog: {
        url: 'https://apimessinging.com/sitemap-blog.xml',
        status: 'optional',
        frequency: 'weekly'
      },
      pages: {
        url: 'https://apimessinging.com/sitemap-pages.xml',
        status: 'optional',
        frequency: 'monthly'
      }
    },

    // Property Settings
    property: {
      url: 'https://apimessinging.com',
      propertyType: 'URL prefix', // or 'Domain property'
      preferredDomain: 'https://apimessinging.com', // No www
      targetCountry: 'United States',
      crawlRate: 'Let Google optimize'
    },

    // URL Parameters to Ignore (for better reporting)
    urlParameters: {
      ignore: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid'],
      configuration: {
        'sort': 'let_googlebot_decide',
        'filter': 'let_googlebot_decide',
        'page': 'representative_url',
        'search': 'no_urls'
      }
    },

    // Crawl Error Monitoring
    crawlErrors: {
      alertEmail: 'admin@apimessinging.com',
      notificationThreshold: 10, // Alert if more than 10 errors
      monitorTypes: ['server_errors', 'not_found', 'soft_404', 'access_denied']
    }
  },

  /**
   * Google Analytics 4 Configuration
   */
  googleAnalytics: {
    // Measurement ID
    measurementId: 'G-GXYQWFETJS', // Replace with your GA4 Measurement ID
    
    // API Secret for Measurement Protocol (server-side tracking)
    apiSecret: 'YOUR_API_SECRET_HERE',

    // Configuration
    config: {
      send_page_view: true,
      anonymize_ip: true, // GDPR compliance
      cookie_flags: 'SameSite=None;Secure',
      cookie_domain: 'apimessinging.com',
      cookie_expires: 63072000, // 2 years in seconds
      allow_google_signals: true, // For remarketing
      allow_ad_personalization_signals: false // GDPR compliance
    },

    // Enhanced Measurement (Auto-collected events)
    enhancedMeasurement: {
      page_views: true,
      scrolls: true, // 90% scroll depth
      outbound_clicks: true,
      site_search: true,
      video_engagement: true,
      file_downloads: true
    },

    // Custom Events Configuration
    events: {
      // User Engagement
      'user_signup': {
        category: 'engagement',
        label: 'user_registration',
        value: 0
      },
      'user_login': {
        category: 'engagement',
        label: 'authentication'
      },
      
      // Conversion Goals
      'sign_up_completed': {
        category: 'conversion',
        label: 'new_user_registration',
        value: 1,
        isConversion: true
      },
      'api_key_generated': {
        category: 'conversion',
        label: 'api_activation',
        value: 5,
        isConversion: true
      },
      'plan_upgraded': {
        category: 'conversion',
        label: 'subscription_upgrade',
        value: 10,
        isConversion: true
      },
      'free_trial_started': {
        category: 'conversion',
        label: 'trial_activation',
        value: 3,
        isConversion: true
      },

      // CTA Interactions
      'cta_click_primary': {
        category: 'engagement',
        label: 'primary_cta_interaction'
      },
      'cta_click_secondary': {
        category: 'engagement',
        label: 'secondary_cta_interaction'
      },
      'demo_request': {
        category: 'engagement',
        label: 'demo_button_click'
      },
      
      // Documentation
      'docs_page_view': {
        category: 'engagement',
        label: 'documentation_access'
      },
      'code_example_copy': {
        category: 'engagement',
        label: 'code_snippet_copied'
      },

      // Integration Pages
      'integration_page_view': {
        category: 'interest',
        label: 'integration_exploration'
      },
      'integration_guide_download': {
        category: 'engagement',
        label: 'guide_downloaded'
      },

      // Pricing
      'pricing_page_view': {
        category: 'interest',
        label: 'pricing_exploration'
      },
      'plan_comparison_toggle': {
        category: 'engagement',
        label: 'monthly_yearly_toggle'
      },

      // API Usage
      'api_test_sent': {
        category: 'product_usage',
        label: 'test_message_sent'
      },
      'webhook_configured': {
        category: 'product_usage',
        label: 'webhook_setup'
      },

      // Support
      'help_article_view': {
        category: 'support',
        label: 'knowledge_base_access'
      },
      'contact_form_submit': {
        category: 'support',
        label: 'support_request'
      }
    },

    // E-commerce Tracking (for paid plans)
    ecommerce: {
      enabled: true,
      currency: 'USD',
      items: {
        'free_plan': { id: 'plan_free', name: 'Free Plan', category: 'subscription', price: 0 },
        'basic_plan': { id: 'plan_basic', name: 'Basic Plan', category: 'subscription', price: 25 },
        'pro_plan': { id: 'plan_pro', name: 'Pro Plan', category: 'subscription', price: 40 }
      }
    },

    // User Properties (for segmentation)
    userProperties: {
      'user_type': ['free', 'basic', 'pro', 'enterprise'],
      'signup_date': 'timestamp',
      'api_usage_level': ['low', 'medium', 'high'],
      'integration_type': ['shopify', 'salesforce', 'woocommerce', 'custom']
    },

    // Custom Dimensions
    customDimensions: {
      'subscription_plan': 'dimension1',
      'api_version': 'dimension2',
      'integration_platform': 'dimension3',
      'user_segment': 'dimension4'
    }
  },

  /**
   * Core Web Vitals Monitoring
   */
  coreWebVitals: {
    enabled: true,
    
    // Thresholds (Google's recommended values)
    thresholds: {
      LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint (ms)
      FID: { good: 100, needsImprovement: 300 },   // First Input Delay (ms)
      CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
      FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint (ms)
      TTFB: { good: 800, needsImprovement: 1800 }  // Time to First Byte (ms)
    },

    // Reporting endpoint (send vitals data here)
    reportingEndpoint: '/api/analytics/web-vitals',
    
    // Sample rate (percentage of sessions to track)
    sampleRate: 100, // 100% = track all sessions

    // Attribution (detailed performance attribution)
    attribution: true,

    // Report all changes (not just final values)
    reportAllChanges: false
  },

  /**
   * PageSpeed Monitoring
   */
  pageSpeed: {
    // PageSpeed Insights API
    apiKey: 'YOUR_PAGESPEED_API_KEY_HERE',
    
    // Pages to monitor
    urls: [
      'https://apimessinging.com/',
      'https://apimessinging.com/pricing',
      'https://apimessinging.com/docs/apimessinging',
      'https://apimessinging.com/integrations/shopify-whatsapp',
      'https://apimessinging.com/register'
    ],

    // Alert thresholds
    alerts: {
      performanceScore: 80,  // Alert if score drops below 80
      accessibilityScore: 90,
      bestPracticesScore: 85,
      seoScore: 95,
      checkFrequency: '6h' // Check every 6 hours
    },

    // Notification settings
    notifications: {
      email: 'devops@apimessinging.com',
      slack: {
        webhookUrl: 'YOUR_SLACK_WEBHOOK_URL',
        channel: '#seo-alerts'
      }
    },

    // Lighthouse CI Integration
    lighthouseCI: {
      enabled: true,
      uploadTarget: 'temporary-public-storage',
      numberOfRuns: 3
    }
  },

  /**
   * Uptime Monitoring
   */
  uptimeMonitoring: {
    // Primary monitoring service config
    provider: 'uptime-kuma', // or 'pingdom', 'uptimerobot', etc.
    
    // Endpoints to monitor
    endpoints: [
      {
        name: 'Homepage',
        url: 'https://apimessinging.com/',
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        interval: 60 // Check every 60 seconds
      },
      {
        name: 'API Health',
        url: 'https://apimessinging.com/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        interval: 60
      },
      {
        name: 'API Endpoint',
        url: 'https://apimessinging.com/api/whatsapp/sessions',
        method: 'GET',
        expectedStatus: [200, 401], // 401 is acceptable (auth required)
        timeout: 5000,
        interval: 300 // Check every 5 minutes
      },
      {
        name: 'Documentation',
        url: 'https://apimessinging.com/docs/apimessinging',
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        interval: 300
      }
    ],

    // Alert configuration
    alerts: {
      channels: ['email', 'slack', 'sms'],
      email: 'alerts@apimessinging.com',
      slack: {
        webhookUrl: 'YOUR_SLACK_WEBHOOK_URL',
        channel: '#uptime-alerts'
      },
      sms: {
        provider: 'twilio',
        numbers: ['+1234567890']
      },
      
      // Alert thresholds
      consecutiveFailures: 3, // Alert after 3 consecutive failures
      uptimeThreshold: 99.9,  // Alert if uptime drops below 99.9%
      responseTimeThreshold: 3000 // Alert if response time > 3s
    },

    // Status page
    statusPage: {
      enabled: true,
      url: 'https://status.apimessinging.com',
      public: true
    }
  },

  /**
   * SEO Rank Tracking
   */
  rankTracking: {
    enabled: true,
    
    // Keywords to track
    keywords: [
      'WhatsApp Business API',
      'WhatsApp API integration',
      'WhatsApp chatbot API',
      'REST API WhatsApp',
      'WhatsApp automation',
      'Shopify WhatsApp integration',
      'WhatsApp marketing automation'
    ],

    // Search engines to track
    searchEngines: ['google', 'bing'],
    
    // Tracking frequency
    checkFrequency: 'daily',
    
    // Geographic locations to track
    locations: ['United States', 'United Kingdom', 'India', 'Canada'],

    // Alert on rank changes
    alerts: {
      enabled: true,
      threshold: 5, // Alert if rank changes by more than 5 positions
      email: 'seo@apimessinging.com'
    }
  },

  /**
   * Error Tracking & Monitoring
   */
  errorTracking: {
    // JavaScript Error Tracking
    frontend: {
      enabled: true,
      sampleRate: 100,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured'
      ]
    },

    // API Error Tracking
    backend: {
      enabled: true,
      trackRateLimitErrors: true,
      trackAuthErrors: true,
      trackServerErrors: true
    }
  },

  /**
   * Conversion Funnel Tracking
   */
  conversionFunnels: {
    // Sign-up Funnel
    signup: {
      steps: [
        { name: 'landing_page_view', event: 'page_view' },
        { name: 'register_page_view', event: 'page_view', url: '/register' },
        { name: 'form_start', event: 'form_start' },
        { name: 'form_submit', event: 'sign_up' },
        { name: 'email_verification', event: 'email_verify' },
        { name: 'signup_complete', event: 'sign_up_completed' }
      ],
      dropOffAlerts: true
    },

    // API Activation Funnel
    apiActivation: {
      steps: [
        { name: 'dashboard_view', event: 'page_view', url: '/dashboard' },
        { name: 'api_docs_view', event: 'docs_page_view' },
        { name: 'api_key_generate', event: 'api_key_generated' },
        { name: 'first_api_call', event: 'api_test_sent' }
      ],
      dropOffAlerts: true
    },

    // Upgrade Funnel
    upgrade: {
      steps: [
        { name: 'pricing_page_view', event: 'pricing_page_view' },
        { name: 'plan_select', event: 'begin_checkout' },
        { name: 'payment_info', event: 'add_payment_info' },
        { name: 'purchase_complete', event: 'plan_upgraded' }
      ],
      dropOffAlerts: true
    }
  }
};

