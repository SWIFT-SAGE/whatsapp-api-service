/**
 * Client-Side Analytics & Tracking Implementation
 * Implements Google Analytics 4, Core Web Vitals, and Custom Event Tracking
 * 
 * @version 1.0.0
 * @requires Google Analytics 4
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const ANALYTICS_CONFIG = {
    GA4_MEASUREMENT_ID: 'G-GXYQWFETJS', // Replace with your actual Measurement ID
    DEBUG_MODE: false, // Set to true for development
    TRACK_ERRORS: true,
    TRACK_WEB_VITALS: true,
    TRACK_USER_TIMING: true
  };

  // ============================================================================
  // GOOGLE ANALYTICS 4 INITIALIZATION
  // ============================================================================

  /**
   * Initialize Google Analytics 4
   */
  function initializeGA4() {
    // Load gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_CONFIG.GA4_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // Initialize dataLayer and gtag function
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      dataLayer.push(arguments);
    }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', ANALYTICS_CONFIG.GA4_MEASUREMENT_ID, {
      send_page_view: true,
      anonymize_ip: true,
      cookie_flags: 'SameSite=None;Secure',
      debug_mode: ANALYTICS_CONFIG.DEBUG_MODE
    });

    console.log('✅ Google Analytics 4 initialized');
  }

  // ============================================================================
  // EVENT TRACKING
  // ============================================================================

  /**
   * Track custom event
   * @param {string} eventName - Name of the event
   * @param {object} parameters - Event parameters
   */
  function trackEvent(eventName, parameters = {}) {
    if (typeof gtag === 'function') {
      gtag('event', eventName, parameters);
      
      if (ANALYTICS_CONFIG.DEBUG_MODE) {
        console.log('📊 Event tracked:', eventName, parameters);
      }
    }
  }

  /**
   * Track page view (for SPA navigation)
   * @param {string} pagePath - Page path
   * @param {string} pageTitle - Page title
   */
  function trackPageView(pagePath, pageTitle) {
    trackEvent('page_view', {
      page_path: pagePath,
      page_title: pageTitle || document.title,
      page_location: window.location.href
    });
  }

  /**
   * Track conversion event
   * @param {string} conversionName - Name of conversion
   * @param {number} value - Value of conversion
   */
  function trackConversion(conversionName, value = 0) {
    trackEvent(conversionName, {
      value: value,
      currency: 'USD',
      event_category: 'conversion'
    });
  }

  // ============================================================================
  // CTA CLICK TRACKING
  // ============================================================================

  /**
   * Track CTA button clicks
   */
  function setupCTATracking() {
    // Primary CTA buttons
    document.querySelectorAll('[data-cta="primary"], .btn-primary, a[href*="register"], a[href*="signup"]').forEach(button => {
      button.addEventListener('click', function(e) {
        const buttonText = this.textContent.trim();
        const buttonHref = this.getAttribute('href') || '';
        
        trackEvent('cta_click_primary', {
          button_text: buttonText,
          button_url: buttonHref,
          button_location: getElementLocation(this)
        });
      });
    });

    // Secondary CTA buttons
    document.querySelectorAll('[data-cta="secondary"], .btn-outline-primary, a[href*="demo"]').forEach(button => {
      button.addEventListener('click', function(e) {
        const buttonText = this.textContent.trim();
        const buttonHref = this.getAttribute('href') || '';
        
        trackEvent('cta_click_secondary', {
          button_text: buttonText,
          button_url: buttonHref,
          button_location: getElementLocation(this)
        });
      });
    });

    // Demo buttons
    document.querySelectorAll('[href*="demo"], [data-action="demo"]').forEach(button => {
      button.addEventListener('click', function(e) {
        trackEvent('demo_request', {
          button_text: this.textContent.trim(),
          page_location: window.location.pathname
        });
      });
    });
  }

  /**
   * Get element location on page
   * @param {Element} element - DOM element
   * @returns {string} Location description
   */
  function getElementLocation(element) {
    if (element.closest('nav')) return 'navigation';
    if (element.closest('header')) return 'header';
    if (element.closest('footer')) return 'footer';
    if (element.closest('.hero')) return 'hero';
    if (element.closest('.pricing')) return 'pricing';
    return 'content';
  }

  // ============================================================================
  // FORM TRACKING
  // ============================================================================

  /**
   * Track form submissions
   */
  function setupFormTracking() {
    document.querySelectorAll('form').forEach(form => {
      // Track form start
      const inputs = form.querySelectorAll('input, textarea, select');
      let formStarted = false;

      inputs.forEach(input => {
        input.addEventListener('focus', function() {
          if (!formStarted) {
            formStarted = true;
            trackEvent('form_start', {
              form_id: form.id || 'unknown',
              form_name: form.name || 'unknown',
              form_location: window.location.pathname
            });
          }
        });
      });

      // Track form submission
      form.addEventListener('submit', function(e) {
        const formId = this.id || 'unknown';
        const formName = this.name || 'unknown';

        trackEvent('form_submit', {
          form_id: formId,
          form_name: formName,
          form_location: window.location.pathname
        });

        // Track specific forms
        if (formId.includes('register') || formId.includes('signup')) {
          trackEvent('sign_up', {
            method: 'email'
          });
        } else if (formId.includes('contact')) {
          trackEvent('contact_form_submit', {
            form_type: 'contact'
          });
        }
      });
    });
  }

  // ============================================================================
  // SCROLL DEPTH TRACKING
  // ============================================================================

  /**
   * Track scroll depth milestones
   */
  function setupScrollTracking() {
    const milestones = [25, 50, 75, 90, 100];
    const reached = new Set();

    window.addEventListener('scroll', throttle(function() {
      const scrollPercentage = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );

      milestones.forEach(milestone => {
        if (scrollPercentage >= milestone && !reached.has(milestone)) {
          reached.add(milestone);
          trackEvent('scroll_depth', {
            percentage: milestone,
            page_path: window.location.pathname
          });
        }
      });
    }, 500));
  }

  // ============================================================================
  // CORE WEB VITALS TRACKING
  // ============================================================================

  /**
   * Track Core Web Vitals
   */
  function setupWebVitalsTracking() {
    if (!ANALYTICS_CONFIG.TRACK_WEB_VITALS) return;

    // Check if web-vitals library is available
    if (typeof webVitals !== 'undefined') {
      // Use web-vitals library if loaded
      webVitals.getCLS(sendToAnalytics);
      webVitals.getFID(sendToAnalytics);
      webVitals.getLCP(sendToAnalytics);
      webVitals.getFCP(sendToAnalytics);
      webVitals.getTTFB(sendToAnalytics);
    } else {
      // Fallback: Basic performance tracking
      window.addEventListener('load', function() {
        setTimeout(function() {
          const perfData = window.performance.timing;
          const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
          const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.navigationStart;
          const firstByte = perfData.responseStart - perfData.navigationStart;

          trackEvent('page_performance', {
            page_load_time: pageLoadTime,
            dom_content_loaded: domContentLoaded,
            time_to_first_byte: firstByte,
            page_path: window.location.pathname
          });
        }, 0);
      });
    }
  }

  /**
   * Send Web Vitals to Analytics
   * @param {object} metric - Web Vital metric
   */
  function sendToAnalytics(metric) {
    const value = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value);
    
    trackEvent(metric.name, {
      value: value,
      metric_id: metric.id,
      metric_delta: metric.delta,
      page_path: window.location.pathname
    });

    // Also send to custom endpoint for server-side tracking
    if (navigator.sendBeacon) {
      const body = JSON.stringify({
        name: metric.name,
        value: value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        url: window.location.href,
        userAgent: navigator.userAgent
      });

      navigator.sendBeacon('/api/analytics/web-vitals', body);
    }
  }

  // ============================================================================
  // ERROR TRACKING
  // ============================================================================

  /**
   * Track JavaScript errors
   */
  function setupErrorTracking() {
    if (!ANALYTICS_CONFIG.TRACK_ERRORS) return;

    window.addEventListener('error', function(event) {
      trackEvent('exception', {
        description: event.message,
        fatal: false,
        error_file: event.filename,
        error_line: event.lineno,
        error_column: event.colno
      });
    });

    window.addEventListener('unhandledrejection', function(event) {
      trackEvent('exception', {
        description: `Unhandled Promise Rejection: ${event.reason}`,
        fatal: false
      });
    });
  }

  // ============================================================================
  // LINK TRACKING
  // ============================================================================

  /**
   * Track outbound link clicks
   */
  function setupLinkTracking() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Track outbound links
      if (href.startsWith('http') && !href.includes(window.location.hostname)) {
        trackEvent('click', {
          link_url: href,
          link_text: link.textContent.trim(),
          link_classes: link.className,
          outbound: true
        });
      }

      // Track documentation links
      if (href.includes('/docs/') || href.includes('/api-docs')) {
        trackEvent('docs_page_view', {
          doc_url: href,
          doc_section: href.split('/').pop()
        });
      }

      // Track integration page links
      if (href.includes('/integrations/')) {
        trackEvent('integration_page_view', {
          integration_type: href.split('/').pop(),
          from_page: window.location.pathname
        });
      }
    });
  }

  // ============================================================================
  // USER ENGAGEMENT TRACKING
  // ============================================================================

  /**
   * Track user engagement (time on page)
   */
  function setupEngagementTracking() {
    let engagementTime = 0;
    let isActive = true;
    let lastActiveTime = Date.now();

    // Track active time
    const interval = setInterval(function() {
      if (isActive) {
        engagementTime += 1;
      }
    }, 1000);

    // Detect user activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, function() {
        isActive = true;
        lastActiveTime = Date.now();
      });
    });

    // Detect inactivity
    setInterval(function() {
      if (Date.now() - lastActiveTime > 5000) {
        isActive = false;
      }
    }, 1000);

    // Send engagement time on page unload
    window.addEventListener('beforeunload', function() {
      if (engagementTime > 5) { // Only track if more than 5 seconds
        trackEvent('user_engagement', {
          engagement_time_msec: engagementTime * 1000,
          page_path: window.location.pathname
        });
      }
    });
  }

  // ============================================================================
  // ECOMMERCE TRACKING
  // ============================================================================

  /**
   * Track plan selection (e-commerce)
   * @param {string} planName - Name of the plan
   * @param {number} price - Price of the plan
   */
  window.trackPlanSelection = function(planName, price) {
    trackEvent('begin_checkout', {
      currency: 'USD',
      value: price,
      items: [{
        item_id: `plan_${planName.toLowerCase()}`,
        item_name: `${planName} Plan`,
        item_category: 'subscription',
        price: price,
        quantity: 1
      }]
    });
  };

  /**
   * Track plan upgrade completion
   * @param {string} planName - Name of the plan
   * @param {number} price - Price of the plan
   */
  window.trackPlanUpgrade = function(planName, price) {
    // Track as conversion
    trackConversion('plan_upgraded', price);

    // Track as e-commerce purchase
    trackEvent('purchase', {
      transaction_id: `txn_${Date.now()}`,
      value: price,
      currency: 'USD',
      items: [{
        item_id: `plan_${planName.toLowerCase()}`,
        item_name: `${planName} Plan`,
        item_category: 'subscription',
        price: price,
        quantity: 1
      }]
    });
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Throttle function execution
   * @param {Function} func - Function to throttle
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Throttled function
   */
  function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize all tracking
   */
  function initializeTracking() {
    console.log('🚀 Initializing analytics tracking...');

    // Initialize GA4
    initializeGA4();

    // Set up event tracking
    setTimeout(function() {
      setupCTATracking();
      setupFormTracking();
      setupScrollTracking();
      setupWebVitalsTracking();
      setupErrorTracking();
      setupLinkTracking();
      setupEngagementTracking();

      console.log('✅ Analytics tracking initialized');
    }, 100);
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTracking);
  } else {
    initializeTracking();
  }

  // ============================================================================
  // EXPOSE PUBLIC API
  // ============================================================================

  window.analytics = {
    trackEvent: trackEvent,
    trackPageView: trackPageView,
    trackConversion: trackConversion,
    trackPlanSelection: window.trackPlanSelection,
    trackPlanUpgrade: window.trackPlanUpgrade
  };

})();

