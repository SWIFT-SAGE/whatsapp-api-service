import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * SEO-Optimized 301 Redirect Middleware
 * Redirects old URLs to new keyword-rich URLs for better SEO
 */

interface RedirectRule {
  from: string | RegExp;
  to: string;
  type: 'exact' | 'pattern';
}

// Define all 301 redirect rules
const redirectRules: RedirectRule[] = [
  // Documentation URLs - more descriptive and keyword-rich
  {
    from: '/api-docs',
    to: '/docs/whatsapp-api',
    type: 'exact'
  },
  {
    from: /^\/api-docs\/docs\/(.+)$/,
    to: '/docs/whatsapp-api/$1',
    type: 'pattern'
  },
  {
    from: '/documentation',
    to: '/docs/whatsapp-api',
    type: 'exact'
  },
  {
    from: '/docs',
    to: '/docs/whatsapp-api',
    type: 'exact'
  },

  // Pricing URLs - standardized
  {
    from: '/price',
    to: '/pricing',
    type: 'exact'
  },
  {
    from: '/plans',
    to: '/pricing',
    type: 'exact'
  },
  {
    from: '/subscription',
    to: '/pricing',
    type: 'exact'
  },

  // Feature URLs - more descriptive
  {
    from: '/features/bot',
    to: '/features/chatbot-builder',
    type: 'exact'
  },
  {
    from: '/features/automation',
    to: '/features/whatsapp-automation',
    type: 'exact'
  },
  {
    from: '/chatbot',
    to: '/features/whatsapp-chatbot-api',
    type: 'exact'
  },

  // Integration URLs - standardized naming
  {
    from: '/integration/shopify',
    to: '/integrations/shopify-whatsapp',
    type: 'exact'
  },
  {
    from: '/integration/salesforce',
    to: '/integrations/salesforce-whatsapp',
    type: 'exact'
  },
  {
    from: '/shopify',
    to: '/integrations/shopify-whatsapp',
    type: 'exact'
  },
  {
    from: '/salesforce',
    to: '/integrations/salesforce-whatsapp',
    type: 'exact'
  },

  // Use case URLs - descriptive and keyword-rich
  {
    from: '/use-case/ecommerce',
    to: '/use-cases/ecommerce-order-notifications',
    type: 'exact'
  },
  {
    from: '/use-case/support',
    to: '/use-cases/customer-support-automation',
    type: 'exact'
  },
  {
    from: '/ecommerce',
    to: '/use-cases/ecommerce-order-notifications',
    type: 'exact'
  },
  {
    from: '/support',
    to: '/use-cases/customer-support-automation',
    type: 'exact'
  },

  // Legacy URLs
  {
    from: '/signup',
    to: '/register',
    type: 'exact'
  },
  {
    from: '/sign-up',
    to: '/register',
    type: 'exact'
  },
  {
    from: '/signin',
    to: '/login',
    type: 'exact'
  },
  {
    from: '/sign-in',
    to: '/login',
    type: 'exact'
  },

  // Blog URLs - SEO-friendly structure
  {
    from: '/blog/post',
    to: '/blog',
    type: 'exact'
  },
  {
    from: '/articles',
    to: '/blog',
    type: 'exact'
  },

  // Help/Support URLs
  {
    from: '/support',
    to: '/help',
    type: 'exact'
  },
  {
    from: '/faq',
    to: '/help',
    type: 'exact'
  },
  {
    from: '/faqs',
    to: '/help',
    type: 'exact'
  },

  // About URLs
  {
    from: '/about-us',
    to: '/about',
    type: 'exact'
  },
  {
    from: '/company',
    to: '/about',
    type: 'exact'
  },

  // Contact URLs
  {
    from: '/contact-us',
    to: '/contact',
    type: 'exact'
  },
  {
    from: '/get-in-touch',
    to: '/contact',
    type: 'exact'
  }
];

/**
 * SEO Redirect Middleware
 * Implements 301 permanent redirects for URL consolidation
 */
export const seoRedirectMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestPath = req.path;

  // Check exact matches first (faster)
  const exactMatch = redirectRules.find(
    rule => rule.type === 'exact' && rule.from === requestPath
  );

  if (exactMatch) {
    logger.info(`301 Redirect: ${requestPath} → ${exactMatch.to}`);
    res.redirect(301, exactMatch.to);
    return;
  }

  // Check pattern matches
  for (const rule of redirectRules) {
    if (rule.type === 'pattern' && rule.from instanceof RegExp) {
      const match = requestPath.match(rule.from);
      if (match) {
        // Replace capture groups in the target URL
        let targetUrl = rule.to;
        match.slice(1).forEach((group, index) => {
          targetUrl = targetUrl.replace(`$${index + 1}`, group);
        });
        
        logger.info(`301 Redirect (pattern): ${requestPath} → ${targetUrl}`);
        res.redirect(301, targetUrl);
        return;
      }
    }
  }

  // No redirect needed, continue to next middleware
  next();
};

/**
 * Trailing slash redirect middleware
 * Removes trailing slashes for URL consistency (except root)
 */
export const trailingSlashMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path !== '/' && req.path.endsWith('/')) {
    const newPath = req.path.slice(0, -1);
    const queryString = req.url.slice(req.path.length);
    
    logger.info(`301 Redirect (trailing slash): ${req.path} → ${newPath}`);
    res.redirect(301, newPath + queryString);
    return;
  }
  
  next();
};

/**
 * Lowercase URL middleware
 * Redirects uppercase URLs to lowercase for consistency
 */
export const lowercaseUrlMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const hasUppercase = /[A-Z]/.test(req.path);
  
  if (hasUppercase) {
    const lowercasePath = req.path.toLowerCase();
    const queryString = req.url.slice(req.path.length);
    
    logger.info(`301 Redirect (lowercase): ${req.path} → ${lowercasePath}`);
    res.redirect(301, lowercasePath + queryString);
    return;
  }
  
  next();
};

/**
 * Export all redirect rules for documentation purposes
 */
export const getRedirectRules = (): RedirectRule[] => {
  return redirectRules;
};

export default {
  seoRedirectMiddleware,
  trailingSlashMiddleware,
  lowercaseUrlMiddleware,
  getRedirectRules
};

