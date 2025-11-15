/**
 * Message Templates Examples
 * 
 * This file demonstrates how to use message templates in your WhatsApp API service
 */

const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000/api';
const TOKEN = 'your_jwt_token_here'; // Get from login
const SESSION_ID = 'session_xxxxx'; // Your WhatsApp session ID

// API Helper
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// ============================================================================
// EXAMPLE 1: Send Built-in Templates
// ============================================================================

async function example1_SendBuiltInTemplates() {
  console.log('\n=== Example 1: Send Built-in Templates ===\n');
  
  // 1. Welcome message
  console.log('Sending welcome message...');
  const welcome = await api.post('/templates/send', {
    sessionId: SESSION_ID,
    to: '919876543210',
    templateName: 'welcome',
    variables: {
      name: 'John Doe'
    }
  });
  console.log('✓ Welcome sent:', welcome.data);
  
  // 2. Order confirmation
  console.log('\nSending order confirmation...');
  const order = await api.post('/templates/send', {
    sessionId: SESSION_ID,
    to: '919876543210',
    templateName: 'orderConfirmation',
    variables: {
      name: 'John Doe',
      orderId: 'ORD12345',
      amount: '2,499'
    }
  });
  console.log('✓ Order confirmation sent:', order.data);
  
  // 3. Appointment reminder
  console.log('\nSending appointment reminder...');
  const appointment = await api.post('/templates/send', {
    sessionId: SESSION_ID,
    to: '919876543210',
    templateName: 'appointment',
    variables: {
      name: 'John Doe',
      date: 'January 15, 2024',
      time: '10:00 AM'
    }
  });
  console.log('✓ Appointment reminder sent:', appointment.data);
}

// ============================================================================
// EXAMPLE 2: Create Custom Template
// ============================================================================

async function example2_CreateCustomTemplate() {
  console.log('\n=== Example 2: Create Custom Template ===\n');
  
  const templateData = {
    name: 'Payment Reminder',
    description: 'Remind customers about pending payments',
    category: 'notification',
    type: 'text',
    content: {
      text: `Hi *{{name}}*! 👋

This is a friendly reminder about your pending payment.

📋 Invoice: {{invoiceNumber}}
💰 Amount: ₹{{amount}}
📅 Due Date: {{dueDate}}

Please make the payment at your earliest convenience.

_Reply to this message if you have any questions._

Thank you! 🙏`
    },
    variables: ['name', 'invoiceNumber', 'amount', 'dueDate'],
    formatting: {
      useBold: true,
      useItalic: true,
      useEmojis: true
    }
  };
  
  try {
    const response = await api.post('/templates', templateData);
    console.log('✓ Template created successfully!');
    console.log('Template ID:', response.data.data._id);
    console.log('Template Name:', response.data.data.name);
    return response.data.data._id;
  } catch (error) {
    console.error('Error creating template:', error.response?.data || error.message);
  }
}

// ============================================================================
// EXAMPLE 3: Send Custom Template
// ============================================================================

async function example3_SendCustomTemplate(templateId) {
  console.log('\n=== Example 3: Send Custom Template ===\n');
  
  try {
    const response = await api.post('/templates/send', {
      sessionId: SESSION_ID,
      to: '919876543210',
      templateId: templateId, // or use templateName
      variables: {
        name: 'John Doe',
        invoiceNumber: 'INV-2024-001',
        amount: '5,000',
        dueDate: 'January 31, 2024'
      }
    });
    
    console.log('✓ Custom template sent successfully!');
    console.log('Results:', response.data);
  } catch (error) {
    console.error('Error sending template:', error.response?.data || error.message);
  }
}

// ============================================================================
// EXAMPLE 4: Bulk Send Templates
// ============================================================================

async function example4_BulkSendTemplates() {
  console.log('\n=== Example 4: Bulk Send Templates ===\n');
  
  const customers = [
    { phone: '919876543210', name: 'John Doe', orderId: 'ORD001', amount: '1,299' },
    { phone: '918765432109', name: 'Jane Smith', orderId: 'ORD002', amount: '2,499' },
    { phone: '917654321098', name: 'Bob Johnson', orderId: 'ORD003', amount: '999' }
  ];
  
  console.log(`Sending order confirmations to ${customers.length} customers...\n`);
  
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    
    try {
      const response = await api.post('/templates/send', {
        sessionId: SESSION_ID,
        to: customer.phone,
        templateName: 'orderConfirmation',
        variables: {
          name: customer.name,
          orderId: customer.orderId,
          amount: customer.amount
        }
      });
      
      console.log(`✓ [${i + 1}/${customers.length}] Sent to ${customer.name}`);
    } catch (error) {
      console.error(`✗ [${i + 1}/${customers.length}] Failed for ${customer.name}:`, 
        error.response?.data?.message || error.message);
    }
    
    // Wait 2 seconds between messages to avoid rate limiting
    if (i < customers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n✓ Bulk send completed!');
}

// ============================================================================
// EXAMPLE 5: Get All Templates
// ============================================================================

async function example5_GetAllTemplates() {
  console.log('\n=== Example 5: Get All Templates ===\n');
  
  // Get all templates
  const allTemplates = await api.get('/templates');
  console.log(`Total templates: ${allTemplates.data.count}`);
  
  // Get templates by category
  const transactional = await api.get('/templates?category=transactional');
  console.log(`Transactional templates: ${transactional.data.count}`);
  
  const marketing = await api.get('/templates?category=marketing');
  console.log(`Marketing templates: ${marketing.data.count}`);
  
  // Get built-in templates
  const builtIn = await api.get('/templates/built-in');
  console.log(`Built-in templates: ${builtIn.data.count}`);
  console.log('Available built-in templates:', builtIn.data.data.join(', '));
}

// ============================================================================
// EXAMPLE 6: Preview Template
// ============================================================================

async function example6_PreviewTemplate() {
  console.log('\n=== Example 6: Preview Template ===\n');
  
  // First, get a template
  const templates = await api.get('/templates');
  if (templates.data.count === 0) {
    console.log('No custom templates found. Create one first!');
    return;
  }
  
  const templateId = templates.data.data[0]._id;
  
  // Preview with variables
  const preview = await api.post('/templates/preview', {
    templateId: templateId,
    variables: {
      name: 'John Doe',
      orderId: 'ORD12345',
      amount: '2,499'
    }
  });
  
  console.log('Template preview:');
  console.log('─'.repeat(50));
  console.log(preview.data.data.preview);
  console.log('─'.repeat(50));
}

// ============================================================================
// EXAMPLE 7: Update Template
// ============================================================================

async function example7_UpdateTemplate(templateId) {
  console.log('\n=== Example 7: Update Template ===\n');
  
  try {
    const updates = {
      content: {
        text: `Hi *{{name}}*! 👋

URGENT: Your payment is overdue.

📋 Invoice: {{invoiceNumber}}
💰 Amount: ₹{{amount}}
📅 Due Date: {{dueDate}} (OVERDUE)

Please make the payment immediately to avoid service interruption.

_Reply to this message if you need assistance._

Thank you! 🙏`
      },
      description: 'Urgent payment reminder for overdue invoices'
    };
    
    const response = await api.put(`/templates/${templateId}`, updates);
    console.log('✓ Template updated successfully!');
    console.log('Updated template:', response.data.data.name);
  } catch (error) {
    console.error('Error updating template:', error.response?.data || error.message);
  }
}

// ============================================================================
// EXAMPLE 8: Delete Template
// ============================================================================

async function example8_DeleteTemplate(templateId) {
  console.log('\n=== Example 8: Delete Template ===\n');
  
  try {
    await api.delete(`/templates/${templateId}`);
    console.log('✓ Template deleted successfully!');
  } catch (error) {
    console.error('Error deleting template:', error.response?.data || error.message);
  }
}

// ============================================================================
// EXAMPLE 9: Advanced - Product Update with Formatting
// ============================================================================

async function example9_ProductUpdate() {
  console.log('\n=== Example 9: Product Update with Formatting ===\n');
  
  // Create a rich product update template
  const productTemplate = {
    name: 'Product Launch',
    category: 'marketing',
    type: 'text',
    content: {
      text: `🎉 *{{productName}} is Here!* 🎉

{{description}}

💰 *Special Launch Price*
~₹{{oldPrice}}~ → *₹{{newPrice}}* ({{discount}}% OFF!)

✨ *Key Features:*
{{features}}

🎁 *Limited Time Offer*
Valid until: {{validUntil}}

🛒 Order Now: {{orderLink}}

_Don't miss out on this amazing deal!_

> "{{testimonial}}" - {{customerName}}`
    },
    variables: [
      'productName', 'description', 'oldPrice', 'newPrice', 
      'discount', 'features', 'validUntil', 'orderLink', 
      'testimonial', 'customerName'
    ]
  };
  
  // Create template
  const created = await api.post('/templates', productTemplate);
  console.log('✓ Product template created:', created.data.data.name);
  
  // Send it
  const sent = await api.post('/templates/send', {
    sessionId: SESSION_ID,
    to: '919876543210',
    templateId: created.data.data._id,
    variables: {
      productName: 'Premium Business Plan',
      description: 'Everything you need to grow your business with WhatsApp automation.',
      oldPrice: '9,999',
      newPrice: '6,999',
      discount: '30',
      features: '• Unlimited Messages\n• Advanced Analytics\n• Priority Support\n• Custom Integrations',
      validUntil: 'January 31, 2024',
      orderLink: 'https://example.com/premium',
      testimonial: 'This changed our business communication forever!',
      customerName: 'Sarah, CEO of TechCorp'
    }
  });
  
  console.log('✓ Product update sent!');
}

// ============================================================================
// EXAMPLE 10: Error Handling
// ============================================================================

async function example10_ErrorHandling() {
  console.log('\n=== Example 10: Error Handling ===\n');
  
  try {
    // Try to send with missing variables
    await api.post('/templates/send', {
      sessionId: SESSION_ID,
      to: '919876543210',
      templateName: 'orderConfirmation',
      variables: {
        name: 'John' // Missing orderId and amount
      }
    });
  } catch (error) {
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error message:', error.response.data.message);
      console.log('Error details:', error.response.data.details);
    } else {
      console.log('Network error:', error.message);
    }
  }
  
  try {
    // Try to use non-existent template
    await api.post('/templates/send', {
      sessionId: SESSION_ID,
      to: '919876543210',
      templateName: 'nonExistentTemplate',
      variables: {}
    });
  } catch (error) {
    console.log('\nExpected error for non-existent template:');
    console.log('Message:', error.response?.data?.message);
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  try {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║     WhatsApp API - Message Templates Examples        ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    
    // Example 1: Send built-in templates
    await example1_SendBuiltInTemplates();
    
    // Example 2: Create custom template
    const templateId = await example2_CreateCustomTemplate();
    
    // Example 3: Send custom template
    if (templateId) {
      await example3_SendCustomTemplate(templateId);
    }
    
    // Example 4: Bulk send
    // await example4_BulkSendTemplates(); // Uncomment to test
    
    // Example 5: Get all templates
    await example5_GetAllTemplates();
    
    // Example 6: Preview template
    await example6_PreviewTemplate();
    
    // Example 7: Update template
    if (templateId) {
      await example7_UpdateTemplate(templateId);
    }
    
    // Example 9: Product update
    await example9_ProductUpdate();
    
    // Example 10: Error handling
    await example10_ErrorHandling();
    
    // Example 8: Delete template (run last)
    // if (templateId) {
    //   await example8_DeleteTemplate(templateId);
    // }
    
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║              All Examples Completed! ✓                ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n✗ Error running examples:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

// Check if running directly
if (require.main === module) {
  // Update these before running:
  if (TOKEN === 'your_jwt_token_here' || SESSION_ID === 'session_xxxxx') {
    console.error('\n⚠️  Please update TOKEN and SESSION_ID at the top of this file!\n');
    process.exit(1);
  }
  
  runAllExamples()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

// Export functions for use in other scripts
module.exports = {
  example1_SendBuiltInTemplates,
  example2_CreateCustomTemplate,
  example3_SendCustomTemplate,
  example4_BulkSendTemplates,
  example5_GetAllTemplates,
  example6_PreviewTemplate,
  example7_UpdateTemplate,
  example8_DeleteTemplate,
  example9_ProductUpdate,
  example10_ErrorHandling
};

