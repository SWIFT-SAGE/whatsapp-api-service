# SEO Analytics Setup Guide

**Version:** 1.0.0  
**Last Updated:** January 15, 2025  
**Status:** Ready for Implementation

---

## 📋 Table of Contents

1. [Google Search Console Setup](#google-search-console-setup)
2. [Google Analytics 4 Setup](#google-analytics-4-setup)
3. [Core Web Vitals Monitoring](#core-web-vitals-monitoring)
4. [Uptime Monitoring Setup](#uptime-monitoring-setup)
5. [Testing & Validation](#testing--validation)

---

## 🔍 Google Search Console Setup

### Step 1: Create Property

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click "Add Property"
3. Choose **URL prefix** property type
4. Enter: `https://apimessinging.com`

### Step 2: Verify Ownership

**Method 1: HTML Meta Tag (Recommended)**

1. Google will provide a verification code
2. Add this meta tag to `views/partials/head.ejs`:

```html
<meta name="google-site-verification" content="YOUR_VERIFICATION_CODE_HERE" />
```

3. Deploy changes
4. Click "Verify" in Google Search Console

**Method 2: HTML File Upload**

1. Download verification file from Google
2. Place in `public/` directory
3. Access: `https://apimessinging.com/google[CODE].html`
4. Click "Verify"

**Method 3: Google Analytics (If already set up)**

1. Link your GA4 property
2. Auto-verification

### Step 3: Submit Sitemap

1. In Search Console, go to "Sitemaps"
2. Enter sitemap URL: `https://apimessinging.com/sitemap.xml`
3. Click "Submit"
4. Monitor indexing status

### Step 4: Configure Settings

**URL Parameters:**
```
Sitemaps > URL Parameters

Add these parameters to "Let Google Decide":
- sort
- filter  
- page

Add these parameters to "No URLs":
- utm_source
- utm_medium
- utm_campaign
- utm_term
- utm_content
- ref
- fbclid
- gclid
```

**International Targeting:**
```
Settings > International Targeting
- Target Country: United States (or leave blank for global)
```

**Preferred Domain:**
```
Ensure canonical URLs use HTTPS and no www:
✅ https://apimessinging.com
❌ http://apimessinging.com
❌ https://www.apimessinging.com
```

### Step 5: Set Up Email Alerts

1. Go to "Settings" > "Users and permissions"
2. Add your email
3. Enable notifications for:
   - Critical crawl errors
   - Manual actions
   - Security issues
   - New messages

---

## 📊 Google Analytics 4 Setup

### Step 1: Create GA4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Admin > Create Property
3. Property name: "WhatsApp API Service"
4. Reporting time zone: Your timezone
5. Currency: USD

### Step 2: Create Data Stream

1. In property settings, click "Data Streams"
2. Click "Add stream" > "Web"
3. Website URL: `https://apimessinging.com`
4. Stream name: "Production Website"
5. Copy your **Measurement ID** (format: G-XXXXXXXXXX)

### Step 3: Add Tracking Code

1. Update `config/seo-analytics.js`:
```javascript
googleAnalytics: {
  measurementId: 'G-XXXXXXXXXX', // Replace with your actual ID
  // ... rest of config
}
```

2. Update `public/analytics-tracking.js`:
```javascript
const ANALYTICS_CONFIG = {
  GA4_MEASUREMENT_ID: 'G-XXXXXXXXXX', // Replace with your actual ID
  // ... rest of config
};
```

3. Include script in `views/partials/head.ejs`:
```html
<!-- Google Analytics 4 -->
<script src="/analytics-tracking.js" defer></script>
```

### Step 4: Configure Conversion Events

In GA4 Admin:

1. Go to "Events"
2. Click "Create event"
3. Create these conversion events:

**Sign-up Completion:**
```
Event name: sign_up_completed
Conversion: Yes
```

**API Key Generation:**
```
Event name: api_key_generated
Conversion: Yes
Value: 5
```

**Plan Upgrade:**
```
Event name: plan_upgraded
Conversion: Yes
Value: 10
```

**Free Trial Started:**
```
Event name: free_trial_started
Conversion: Yes
Value: 3
```

### Step 5: Set Up Custom Dimensions

In GA4 Admin > Custom definitions:

1. **Subscription Plan** (User-scoped)
   - Dimension name: `subscription_plan`
   - Scope: User
   - Event parameter: `subscription_plan`

2. **API Version** (Event-scoped)
   - Dimension name: `api_version`
   - Scope: Event
   - Event parameter: `api_version`

3. **Integration Platform** (User-scoped)
   - Dimension name: `integration_platform`
   - Scope: User
   - Event parameter: `integration_platform`

### Step 6: Configure E-commerce

1. Go to Admin > Data display > E-commerce Settings
2. Enable "E-commerce"
3. Your tracking code automatically sends purchase events

### Step 7: Link to Search Console

1. In GA4 Admin, go to "Product links"
2. Click "Link Search Console"
3. Select your Search Console property
4. Confirm linking

---

## ⚡ Core Web Vitals Monitoring

### Automatic Tracking (Already Implemented)

The `analytics-tracking.js` file automatically tracks:
- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)

### Manual Monitoring Options

**1. Google Search Console**
- Navigate to "Experience" > "Core Web Vitals"
- View performance by URL
- Identify issues affecting UX

**2. PageSpeed Insights**
- Visit: https://pagespeed.web.dev/
- Test your URLs:
  - https://apimessinging.com/
  - https://apimessinging.com/pricing
  - https://apimessinging.com/docs/apimessinging

**3. Chrome DevTools**
- Open DevTools (F12)
- Go to "Lighthouse" tab
- Run audit for Performance

### Set Up Alerts

Create alerts in GA4 for poor Core Web Vitals:

1. Go to Admin > Custom insights
2. Create insight: "Poor LCP"
   - Condition: `LCP > 4000ms`
   - Alert: Email notification

---

## 🚨 Uptime Monitoring Setup

### Option 1: Uptime Kuma (Self-hosted, Free)

**Installation:**
```bash
# Using Docker
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1

# Access at: http://localhost:3001
```

**Configuration:**
1. Create monitors for:
   - Homepage: `https://apimessinging.com/`
   - Health endpoint: `https://apimessinging.com/health`
   - API: `https://apimessinging.com/api/`

2. Set up notifications:
   - Email
   - Slack webhook
   - Discord (optional)

### Option 2: UptimeRobot (Cloud, Free tier)

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add monitors:
   - **Homepage Monitor**
     - Type: HTTP(S)
     - URL: `https://apimessinging.com/`
     - Interval: 5 minutes
   
   - **API Health Monitor**
     - Type: HTTP(S)
     - URL: `https://apimessinging.com/health`
     - Interval: 5 minutes

3. Set up alert contacts:
   - Email: Your email
   - Webhook: Slack/Discord

### Option 3: Pingdom (Premium, More features)

1. Sign up at [pingdom.com](https://www.pingdom.com)
2. Create uptime checks
3. Enable Real User Monitoring (RUM)
4. Set up custom alerts

---

## 🧪 Testing & Validation

### Test GA4 Tracking

**1. Real-time Reports:**
```
GA4 > Reports > Realtime

1. Open your website
2. Navigate to different pages
3. Verify events appear in real-time
4. Check user count updates
```

**2. Debug View:**
```
1. Install Google Analytics Debugger (Chrome extension)
2. Open your website
3. Open DevTools Console
4. Verify events being sent
5. Check for errors
```

**3. GA4 DebugView:**
```
GA4 > Configure > DebugView

1. Enable debug mode in analytics-tracking.js:
   DEBUG_MODE: true

2. Refresh your website
3. View events in DebugView
4. Verify all parameters
```

### Test Search Console

**1. URL Inspection Tool:**
```
Search Console > URL Inspection

1. Enter any URL from your site
2. Click "Test Live URL"
3. Verify:
   - Page is indexable
   - No errors
   - Structured data detected
```

**2. Rich Results Test:**
```
Visit: https://search.google.com/test/rich-results

1. Enter your homepage URL
2. Verify structured data:
   - Organization
   - FAQPage
   - Product (for pricing)
```

### Test Core Web Vitals

**1. Web Vitals Chrome Extension:**
```
1. Install: Web Vitals extension
2. Visit your pages
3. Check real-time metrics
4. Verify all metrics are "Good" (green)
```

**2. Lighthouse CI:**
```bash
npm install -g @lhci/cli

# Run audit
lhci autorun --collect.url=https://apimessinging.com

# Check results
lhci upload --target=temporary-public-storage
```

### Test Conversions

**1. Test Sign-up Funnel:**
```
1. Clear cookies
2. Visit homepage
3. Click "Start Free Trial"
4. Complete registration
5. Verify in GA4:
   - sign_up event fired
   - sign_up_completed conversion tracked
```

**2. Test Plan Upgrade:**
```
1. Login to dashboard
2. Go to pricing page
3. Select a paid plan
4. Verify in GA4:
   - begin_checkout event
   - plan_upgraded conversion
```

---

## 📈 Monitoring Dashboard Setup

### GA4 Custom Dashboard

Create custom report in GA4:

**1. Conversions Overview:**
- Metric: Conversions by event
- Dimension: Event name
- Filter: Conversion events only

**2. User Acquisition:**
- Metric: New users
- Dimension: Source/Medium
- Secondary: Landing page

**3. Engagement:**
- Metric: Engagement rate
- Dimension: Page path
- Secondary: User type (new/returning)

### Slack Notifications

**Set up Slack webhook:**

1. Create Slack app
2. Enable Incoming Webhooks
3. Copy webhook URL
4. Add to `config/seo-analytics.js`:

```javascript
notifications: {
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    channel: '#seo-alerts'
  }
}
```

---

## ✅ Post-Setup Checklist

### Immediate (Day 1)
- [ ] Google Search Console verified
- [ ] Sitemap submitted
- [ ] GA4 tracking code added
- [ ] Real-time tracking tested
- [ ] Conversion events created
- [ ] Uptime monitoring configured

### Week 1
- [ ] Verify 100+ pageviews in GA4
- [ ] Check Search Console for crawl errors
- [ ] Review Core Web Vitals data
- [ ] Test all conversion funnels
- [ ] Set up alerts and notifications

### Month 1
- [ ] Analyze traffic sources
- [ ] Review conversion rates
- [ ] Optimize low-performing pages
- [ ] Check keyword rankings
- [ ] Monitor uptime SLA (target: 99.9%)

---

## 🔧 Troubleshooting

### GA4 Not Tracking

**Issue:** No data in GA4 reports

**Solutions:**
1. Check Measurement ID is correct
2. Verify script loaded (DevTools Network tab)
3. Check browser console for errors
4. Disable ad blockers
5. Test in incognito mode

### Search Console Not Indexing

**Issue:** Pages not appearing in Google

**Solutions:**
1. Check robots.txt allows crawling
2. Verify sitemap is accessible
3. Use URL Inspection tool
4. Request indexing manually
5. Check for noindex tags

### Core Web Vitals Poor Scores

**Issue:** LCP, FID, or CLS exceeding thresholds

**Solutions:**
1. Optimize images (lazy loading, WebP)
2. Minimize JavaScript execution
3. Use CDN for static assets
4. Implement code splitting
5. Add explicit width/height to images

---

## 📞 Support Resources

- **Google Search Console Help:** https://support.google.com/webmasters
- **Google Analytics Help:** https://support.google.com/analytics
- **Web Vitals Guide:** https://web.dev/vitals/
- **PageSpeed Insights:** https://pagespeed.web.dev/

---

**Document Version:** 1.0  
**Next Review:** February 15, 2025

