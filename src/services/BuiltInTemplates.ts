/**
 * Built-in Templates with Buttons and Lists
 * Comprehensive templates using whatsapp-web.js Buttons and List classes
 */

export interface BuiltInTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'transactional' | 'notification' | 'custom';
  type: 'text' | 'buttons' | 'list';
  variables: string[];
  content: any;
}

export const builtInTemplates: BuiltInTemplateDefinition[] = [
  // ========================================
  // TEXT TEMPLATES (Existing)
  // ========================================
  {
    id: 'welcome',
    name: 'Welcome Message',
    description: 'Simple welcome message for new customers',
    category: 'marketing',
    type: 'text',
    variables: ['name'],
    content: {
      text: '*Welcome {{name}}!* 👋\n\nThank you for contacting us. How can we help you today?'
    }
  },
  {
    id: 'reminder',
    name: 'Task Reminder',
    description: 'Automated task reminder',
    category: 'notification',
    type: 'text',
    variables: ['name', 'task', 'deadline'],
    content: {
      text: '⏰ *Reminder for {{name}}*\n\nTask: {{task}}\nDeadline: {{deadline}}\n\n_This is an automated reminder_'
    }
  },
  
  // ========================================
  // BUTTON TEMPLATES
  // ========================================
  {
    id: 'orderConfirmation',
    name: 'Order Confirmation with Actions',
    description: 'Order confirmation with interactive buttons',
    category: 'transactional',
    type: 'buttons',
    variables: ['name', 'orderId', 'amount'],
    content: {
      text: 'Hi *{{name}}* 👋\n\n✅ *Your order has been confirmed!*\n\n📦 Order ID: `{{orderId}}`\n💰 Amount: ₹{{amount}}\n\nWe\'ll notify you once it ships.',
      buttonTitle: 'Order Confirmed',
      buttonFooter: 'Swift Sage Digital Solutions',
      buttons: [
        { id: 'track_order', body: '📍 Track Order' },
        { id: 'view_invoice', body: '📄 Invoice' },
        { id: 'support', body: '💬 Support' }
      ]
    }
  },
  {
    id: 'appointment',
    name: 'Appointment Booking',
    description: 'Appointment confirmation with action buttons',
    category: 'transactional',
    type: 'buttons',
    variables: ['name', 'date', 'time'],
    content: {
      text: 'Hello *{{name}}*,\n\n📅 Your appointment is confirmed:\n🗓️ Date: {{date}}\n🕐 Time: {{time}}\n\nPlease confirm your appointment.',
      buttonTitle: 'Appointment Confirmation',
      buttonFooter: 'Swift Sage Digital Solutions',
      buttons: [
        { id: 'confirm_apt', body: '✅ Confirm' },
        { id: 'reschedule', body: '📅 Reschedule' },
        { id: 'cancel', body: '❌ Cancel' }
      ]
    }
  },
  {
    id: 'otpVerification',
    name: 'OTP Verification',
    description: 'One-time password verification',
    category: 'transactional',
    type: 'buttons',
    variables: ['otp', 'orderId'],
    content: {
      text: '🔐 *OTP Verification*\n\nYour OTP is: *{{otp}}*\n\nOrder ID: {{orderId}}\n⚠️ Valid for 10 minutes',
      buttonTitle: 'Verification Required',
      buttonFooter: 'Do not share this OTP',
      buttons: [
        { id: 'verify_otp', body: '✅ Verify' },
        { id: 'resend_otp', body: '🔄 Resend OTP' }
      ]
    }
  },
  {
    id: 'paymentConfirmation',
    name: 'Payment Confirmation',
    description: 'Payment received confirmation with actions',
    category: 'transactional',
    type: 'buttons',
    variables: ['amount', 'method', 'transactionId'],
    content: {
      text: '💳 *Payment Received*\n\nAmount: ₹{{amount}}\nMethod: {{method}}\nTransaction ID: `{{transactionId}}`\n\nThank you for your payment!',
      buttonTitle: 'Payment Successful',
      buttonFooter: '',
      buttons: [
        { id: 'download_receipt', body: '📥 Download Receipt' },
        { id: 'view_order', body: '📦 View Order' },
        { id: 'support', body: '💬 Help' }
      ]
    }
  },
  {
    id: 'welcomeMenu',
    name: 'Welcome Menu with Options',
    description: 'Welcome message with service options',
    category: 'marketing',
    type: 'buttons',
    variables: ['name'],
    content: {
      text: 'Welcome *{{name}}*! 👋\n\nThank you for contacting Swift Sage Digital Solutions.\nHow can we help you today?',
      buttonTitle: 'Welcome to Swift Sage',
      buttonFooter: 'Your Web Development Partner',
      buttons: [
        { id: 'services', body: '🛍️ Our Services' },
        { id: 'pricing', body: '💰 Pricing' },
        { id: 'contact', body: '📞 Contact Us' }
      ]
    }
  },
  
  // ========================================
  // LIST TEMPLATES
  // ========================================
  {
    id: 'productCatalog',
    name: 'Product/Service Catalog',
    description: 'Comprehensive service catalog with categories',
    category: 'marketing',
    type: 'list',
    variables: [],
    content: {
      listBody: 'Choose from our premium services below:',
      listButtonText: 'View Services',
      listTitle: 'Swift Sage Services',
      listFooter: 'Contact us for custom quotes',
      listSections: [
        {
          title: '💼 Web Development',
          rows: [
            {
              id: 'landing_page',
              title: 'Landing Page',
              description: '₹15,000 - Single page website'
            },
            {
              id: 'business_website',
              title: 'Business Website',
              description: '₹35,000 - Multi-page professional site'
            },
            {
              id: 'ecommerce',
              title: 'E-Commerce Store',
              description: '₹60,000 - Full online store with payment'
            }
          ]
        },
        {
          title: '🔌 API Services',
          rows: [
            {
              id: 'api_integration',
              title: 'API Integration',
              description: '₹20,000 - Third-party API integration'
            },
            {
              id: 'custom_api',
              title: 'Custom API Development',
              description: '₹45,000 - Build your own REST API'
            },
            {
              id: 'whatsapp_api',
              title: 'WhatsApp API Setup',
              description: '₹25,000 - Business automation'
            }
          ]
        },
        {
          title: '🤖 Automation',
          rows: [
            {
              id: 'web_scraping',
              title: 'Web Scraping',
              description: '₹18,000 - Data extraction tools'
            },
            {
              id: 'social_automation',
              title: 'Social Media Automation',
              description: '₹30,000 - Instagram/TikTok bots'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'orderTracking',
    name: 'Order Tracking Menu',
    description: 'Track orders and view history',
    category: 'transactional',
    type: 'list',
    variables: [],
    content: {
      listBody: 'Select an order to track or view details:',
      listButtonText: 'Select Order',
      listTitle: 'Order Tracking',
      listFooter: 'Swift Sage Digital Solutions',
      listSections: [
        {
          title: 'Recent Orders',
          rows: [
            {
              id: 'order_13223',
              title: 'Order #13223',
              description: '📦 In Transit - Expected Nov 18'
            },
            {
              id: 'order_13222',
              title: 'Order #13222',
              description: '✅ Delivered - Nov 12'
            },
            {
              id: 'order_13221',
              title: 'Order #13221',
              description: '🚚 Shipped - Expected Nov 20'
            }
          ]
        },
        {
          title: 'Actions',
          rows: [
            {
              id: 'track_new',
              title: 'Track by Order ID',
              description: 'Enter order number manually'
            },
            {
              id: 'all_orders',
              title: 'View All Orders',
              description: 'Complete order history'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'supportMenu',
    name: 'Customer Support Menu',
    description: 'Comprehensive support options',
    category: 'notification',
    type: 'list',
    variables: [],
    content: {
      listBody: 'How can we help you today?',
      listButtonText: 'Support Options',
      listTitle: 'Customer Support',
      listFooter: '24/7 Available',
      listSections: [
        {
          title: 'Quick Help',
          rows: [
            {
              id: 'faq',
              title: 'FAQs',
              description: 'Frequently Asked Questions'
            },
            {
              id: 'track_order',
              title: 'Track Order',
              description: 'Check order status'
            },
            {
              id: 'payment_help',
              title: 'Payment Issues',
              description: 'Help with payments'
            }
          ]
        },
        {
          title: 'Contact Support',
          rows: [
            {
              id: 'live_chat',
              title: 'Live Chat',
              description: '💬 Connect with agent now'
            },
            {
              id: 'call_support',
              title: 'Call Support',
              description: '📱 +91 98765 43210'
            },
            {
              id: 'email_support',
              title: 'Email Support',
              description: '📧 support@swiftsage.com'
            }
          ]
        },
        {
          title: 'Account',
          rows: [
            {
              id: 'update_profile',
              title: 'Update Profile',
              description: 'Change account details'
            },
            {
              id: 'change_password',
              title: 'Change Password',
              description: 'Reset your password'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'pricingPlans',
    name: 'Pricing Plans',
    description: 'Monthly and annual pricing options',
    category: 'marketing',
    type: 'list',
    variables: [],
    content: {
      listBody: 'Choose the plan that fits your needs:',
      listButtonText: 'View Plans',
      listTitle: 'Pricing Plans',
      listFooter: 'Cancel anytime. No hidden fees.',
      listSections: [
        {
          title: 'Monthly Plans',
          rows: [
            {
              id: 'basic_monthly',
              title: 'Basic Plan',
              description: '₹2,999/month - 5 API calls/day'
            },
            {
              id: 'pro_monthly',
              title: 'Professional Plan',
              description: '₹5,999/month - Unlimited calls'
            },
            {
              id: 'enterprise_monthly',
              title: 'Enterprise Plan',
              description: '₹12,999/month - Premium support'
            }
          ]
        },
        {
          title: 'Annual Plans (Save 20%)',
          rows: [
            {
              id: 'basic_yearly',
              title: 'Basic Annual',
              description: '₹28,790/year - Best value'
            },
            {
              id: 'pro_yearly',
              title: 'Professional Annual',
              description: '₹57,590/year - Most popular'
            },
            {
              id: 'enterprise_yearly',
              title: 'Enterprise Annual',
              description: '₹1,24,790/year - Priority support'
            }
          ]
        }
      ]
    }
  },
  {
    id: 'feedback',
    name: 'Feedback Request',
    description: 'Customer feedback collection',
    category: 'notification',
    type: 'list',
    variables: ['name', 'product'],
    content: {
      listBody: 'Hi {{name}}! 😊\n\nWe\'d love to hear your feedback about {{product}}.',
      listButtonText: 'Rate Experience',
      listTitle: 'Your Feedback Matters',
      listFooter: 'Thank you for helping us improve!',
      listSections: [
        {
          title: 'Rating',
          rows: [
            { id: 'rate_5', title: '⭐⭐⭐⭐⭐', description: 'Excellent' },
            { id: 'rate_4', title: '⭐⭐⭐⭐', description: 'Good' },
            { id: 'rate_3', title: '⭐⭐⭐', description: 'Average' },
            { id: 'rate_2', title: '⭐⭐', description: 'Below Average' },
            { id: 'rate_1', title: '⭐', description: 'Poor' }
          ]
        },
        {
          title: 'Actions',
          rows: [
            { id: 'write_review', title: 'Write Review', description: 'Share detailed feedback' },
            { id: 'skip', title: 'Skip', description: 'Maybe later' }
          ]
        }
      ]
    }
  },
  {
    id: 'shipping',
    name: 'Shipping Tracking',
    description: 'Shipping status with tracking options',
    category: 'transactional',
    type: 'list',
    variables: ['name', 'orderId', 'trackingNumber', 'carrier', 'deliveryDate'],
    content: {
      listBody: '📦 *Shipping Update*\n\nHi {{name}},\n\nYour order {{orderId}} has been shipped!\n\n🚚 Tracking: `{{trackingNumber}}`\n📍 Carrier: {{carrier}}\n📅 Expected Delivery: {{deliveryDate}}',
      listButtonText: 'Tracking Options',
      listTitle: 'Order Shipped',
      listFooter: 'Track your package in real-time',
      listSections: [
        {
          title: 'Actions',
          rows: [
            { id: 'track_live', title: 'Track Live', description: 'Real-time location tracking' },
            { id: 'delivery_instructions', title: 'Delivery Instructions', description: 'Add special instructions' },
            { id: 'contact_carrier', title: 'Contact Carrier', description: 'Speak with delivery partner' }
          ]
        }
      ]
    }
  }
];

/**
 * Get all built-in templates
 */
export function getAllBuiltInTemplates(): BuiltInTemplateDefinition[] {
  return builtInTemplates;
}

/**
 * Get built-in template by ID
 */
export function getBuiltInTemplateById(id: string): BuiltInTemplateDefinition | undefined {
  return builtInTemplates.find(t => t.id === id);
}

/**
 * Get built-in templates by type
 */
export function getBuiltInTemplatesByType(type: 'text' | 'buttons' | 'list'): BuiltInTemplateDefinition[] {
  return builtInTemplates.filter(t => t.type === type);
}

/**
 * Get built-in templates by category
 */
export function getBuiltInTemplatesByCategory(category: string): BuiltInTemplateDefinition[] {
  return builtInTemplates.filter(t => t.category === category);
}

