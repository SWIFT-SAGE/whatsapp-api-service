// Performance optimization utilities
(function() {
  'use strict';

  // Lazy loading for images
  if ('loading' in HTMLImageElement.prototype) {
    // Browser supports native lazy loading
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
  } else {
    // Fallback to Intersection Observer
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lozad.js/1.16.0/lozad.min.js';
    script.onload = function() {
      const observer = lozad('.lazy', {
        loaded: function(el) {
          el.classList.add('loaded');
        }
      });
      observer.observe();
    };
    document.head.appendChild(script);
  }

  // Defer non-critical CSS
  function loadDeferredStyles() {
    const addStylesNode = document.getElementById('deferred-styles');
    if (addStylesNode) {
      const replacement = document.createElement('div');
      replacement.innerHTML = addStylesNode.textContent;
      document.body.appendChild(replacement);
      addStylesNode.parentElement.removeChild(addStylesNode);
    }
  }

  // Load deferred styles after page load
  if (window.addEventListener) {
    window.addEventListener('load', loadDeferredStyles);
  } else if (window.attachEvent) {
    window.attachEvent('onload', loadDeferredStyles);
  }

  // Preload key resources on hover
  const links = document.querySelectorAll('a[href^="/"]');
  links.forEach(link => {
    link.addEventListener('mouseenter', function() {
      const href = this.getAttribute('href');
      if (href && !document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
        const prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = href;
        document.head.appendChild(prefetchLink);
      }
    }, { once: true, passive: true });
  });

  // Web Vitals monitoring (if available)
  if ('web-vital' in window) {
    function sendToAnalytics(metric) {
      const body = JSON.stringify(metric);
      // Send to analytics endpoint
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/vitals', body);
      }
    }

    // Monitor Core Web Vitals
    ['CLS', 'FID', 'LCP', 'FCP', 'TTFB'].forEach(metric => {
      if (window[`get${metric}`]) {
        window[`get${metric}`](sendToAnalytics);
      }
    });
  }

  // Service Worker registration for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(registration) {
          console.log('ServiceWorker registered:', registration.scope);
        })
        .catch(function(err) {
          console.log('ServiceWorker registration failed:', err);
        });
    });
  }

  // Resource hints for critical resources
  function addResourceHint(url, rel) {
    if (!document.querySelector(`link[href="${url}"]`)) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = url;
      document.head.appendChild(link);
    }
  }

  // Preconnect to critical origins
  const criticalOrigins = [
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com'
  ];

  criticalOrigins.forEach(origin => {
    addResourceHint(origin, 'preconnect');
  });

  // Performance observer for monitoring
  if ('PerformanceObserver' in window) {
    try {
      // Observer for largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Observer for first input delay
      const fidObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.log('FID:', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Observer for cumulative layout shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        console.log('CLS:', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.error('Performance Observer error:', e);
    }
  }

  // Critical CSS inlining helper
  window.loadCSS = function(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'print';
    link.onload = function() {
      this.media = 'all';
    };
    document.head.appendChild(link);
  };

})();

