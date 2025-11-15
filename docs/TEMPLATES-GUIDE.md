# Message Templates Guide

Complete guide for creating and using message templates in your WhatsApp API service.

## Table of Contents

- [Overview](#overview)
- [Built-in Templates](#built-in-templates)
- [Custom Templates](#custom-templates)
- [Template Types](#template-types)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [WhatsApp Formatting](#whatsapp-formatting)

## Overview

Message templates allow you to create reusable, dynamic message formats that can be personalized with variables. This is perfect for:

- Order confirmations
- Appointment reminders
- Welcome messages
- Product updates
- Invoices
- Follow-up messages

## Built-in Templates

The service comes with pre-built templates that you can use immediately:

### 1. Welcome Template
```
Hi *{{name}}*! 👋

Thank you for contacting us. How can we help you today?
```
**Variables**: `name`

### 2. Order Confirmation Template
```
Hi *{{name}}*,

✅ Your order has been confirmed!

📦 Order ID: `{{orderId}}`
💰 Amount: ₹{{amount}}

We'll notify you once it ships.
```
**Variables**: `name`, `orderId`, `amount`

### 3. Appointment Template
```
Hello *{{name}}*,

📅 Your appointment is confirmed:
🗓️ Date: {{date}}
🕐 Time: {{time}}

See you soon!
```
**Variables**: `name`, `date`, `time`

### 4. Reminder Template
```
⏰ *Reminder for {{name}}*

Task: {{task}}
Deadline: {{deadline}}

_This is an automated reminder_
```
**Variables**: `name`, `task`, `deadline`

### 5. Product Update Template
```
🎉 *New Product Launch!*

{{productName}}
Price: ~₹{{oldPrice}}~ *₹{{newPrice}}*

Features:
• {{feature1}}
• {{feature2}}

> Order now: {{link}}
```
**Variables**: `productName`, `oldPrice`, `newPrice`, `features` (array), `link`

### 6. Invoice Template
```
*INVOICE*
==============================

Customer: {{customerName}}

Items:
• {{item1}} - ₹{{price1}}
• {{item2}} - ₹{{price2}}

==============================
*Total: ₹{{total}}*
Due Date: `{{dueDate}}`

_Thank you for your business!_
```
**Variables**: `customerName`, `items` (array), `total`, `dueDate`

### 7. Shipping Update Template
```
📦 *Shipping Update*

Hi {{name}},

Your order {{orderId}} has been shipped!

🚚 Tracking: `{{trackingNumber}}`
📍 Carrier: {{carrier}}
📅 Expected Delivery: {{deliveryDate}}
```
**Variables**: `name`, `orderId`, `trackingNumber`, `carrier`, `deliveryDate`

### 8. Feedback Template
```
Hi {{name}}! 😊

We'd love to hear your feedback about {{product}}.

Please rate your experience (1-5 stars) and share your thoughts.

Thank you for helping us improve!
```
**Variables**: `name`, `product`

### 9. Follow-up Template
```
Hey {{name}},

Just following up on {{topic}}. Let me know if you have any questions!
```
**Variables**: `name`, `topic`

## Custom Templates

Create your own templates via API or dashboard.

### Template Structure

```json
{
  "name": "My Template",
  "description": "Description of the template",
  "category": "marketing",
  "type": "text",
  "content": {
    "text": "Hi *{{name}}*! Your order {{orderId}} is ready.",
    "mediaUrl": "https://example.com/image.jpg",
    "caption": "Check out our new product!",
    "footer": "Thank you",
    "buttons": [
      { "id": "btn1", "text": "View Order" },
      { "id": "btn2", "text": "Contact Support" }
    ]
  },
  "variables": ["name", "orderId"],
  "formatting": {
    "useBold": true,
    "useItalic": true,
    "useEmojis": true
  }
}
```

### Template Categories

- **marketing**: Promotional messages, product updates
- **transactional**: Order confirmations, invoices
- **notification**: Reminders, alerts
- **custom**: General purpose templates

## Template Types

### 1. Text Template
Simple text-based messages with variable substitution.

```json
{
  "type": "text",
  "content": {
    "text": "Hi {{name}}! Welcome to our service."
  }
}
```

### 2. Media Template
Send images, videos, or documents with captions.

```json
{
  "type": "media",
  "content": {
    "mediaUrl": "https://example.com/image.jpg",
    "caption": "Check this out, {{name}}!"
  }
}
```

### 3. Button Template
Messages with selectable options (formatted as numbered list).

```json
{
  "type": "button",
  "content": {
    "text": "Choose an option:",
    "buttons": [
      { "id": "1", "text": "Option 1" },
      { "id": "2", "text": "Option 2" }
    ],
    "footer": "Reply with the number"
  }
}
```

### 4. List Template
Display multiple sections with items.

```json
{
  "type": "list",
  "content": {
    "listTitle": "Our Services",
    "listSections": [
      {
        "title": "Premium",
        "rows": [
          { "id": "p1", "title": "Service A", "description": "Description A" },
          { "id": "p2", "title": "Service B", "description": "Description B" }
        ]
      }
    ],
    "footer": "Select an option"
  }
}
```

## API Endpoints

### Get All Templates
```http
GET /api/templates
Authorization: Bearer YOUR_TOKEN
```

**Query Parameters**:
- `category`: Filter by category (marketing, transactional, notification, custom)
- `type`: Filter by type (text, media, button, list)
- `isActive`: Filter active/inactive templates

**Response**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "template_id",
      "name": "Welcome",
      "category": "transactional",
      "type": "text",
      "content": { ... },
      "variables": ["name"],
      "usageCount": 150,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Built-in Templates
```http
GET /api/templates/built-in
Authorization: Bearer YOUR_TOKEN
```

**Response**:
```json
{
  "success": true,
  "count": 9,
  "data": ["welcome", "orderConfirmation", "appointment", ...],
  "examples": {
    "welcome": { "name": "John" },
    "orderConfirmation": { "name": "John", "orderId": "ORD123", "amount": "2,499" }
  }
}
```

### Create Template
```http
POST /api/templates
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Order Shipped",
  "category": "transactional",
  "type": "text",
  "description": "Shipping notification template",
  "content": {
    "text": "Hi {{name}}! Your order {{orderId}} has shipped. Track: {{tracking}}"
  },
  "variables": ["name", "orderId", "tracking"]
}
```

### Send Template Message
```http
POST /api/templates/send
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "sessionId": "session_xxxxx",
  "to": "919876543210",
  "templateName": "welcome",
  "variables": {
    "name": "John Doe"
  }
}
```

**Bulk Send**:
```json
{
  "sessionId": "session_xxxxx",
  "to": ["919876543210", "918765432109", "917654321098"],
  "templateName": "orderConfirmation",
  "variables": {
    "name": "Customer",
    "orderId": "ORD123",
    "amount": "2,499"
  },
  "delay": 2000
}
```

### Update Template
```http
PUT /api/templates/:templateId
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "content": {
    "text": "Updated message content"
  },
  "isActive": true
}
```

### Delete Template
```http
DELETE /api/templates/:templateId
Authorization: Bearer YOUR_TOKEN
```

### Preview Template
```http
POST /api/templates/preview
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "templateId": "template_id",
  "variables": {
    "name": "John",
    "orderId": "ORD123"
  }
}
```

## Usage Examples

### Node.js Example

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const TOKEN = 'your_jwt_token';

// 1. Send a built-in template
async function sendWelcomeMessage() {
  try {
    const response = await axios.post(
      `${API_URL}/templates/send`,
      {
        sessionId: 'session_mhzejrf1_xxxx',
        to: '919876543210',
        templateName: 'welcome',
        variables: {
          name: 'John Doe'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// 2. Create a custom template
async function createCustomTemplate() {
  try {
    const response = await axios.post(
      `${API_URL}/templates`,
      {
        name: 'Payment Reminder',
        category: 'notification',
        type: 'text',
        description: 'Remind customers about pending payments',
        content: {
          text: `Hi *{{name}}*! 

This is a friendly reminder about your pending payment.

Invoice: {{invoiceNumber}}
Amount: ₹{{amount}}
Due Date: {{dueDate}}

Please make the payment at your earliest convenience.

Thank you!`
        },
        variables: ['name', 'invoiceNumber', 'amount', 'dueDate'],
        formatting: {
          useBold: true,
          useItalic: true,
          useEmojis: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Template created:', response.data);
    return response.data.data._id;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// 3. Send bulk messages
async function sendBulkOrderConfirmations() {
  const customers = [
    { phone: '919876543210', name: 'John', orderId: 'ORD001', amount: '1,299' },
    { phone: '918765432109', name: 'Jane', orderId: 'ORD002', amount: '2,499' },
    { phone: '917654321098', name: 'Bob', orderId: 'ORD003', amount: '999' }
  ];
  
  for (const customer of customers) {
    try {
      await axios.post(
        `${API_URL}/templates/send`,
        {
          sessionId: 'session_mhzejrf1_xxxx',
          to: customer.phone,
          templateName: 'orderConfirmation',
          variables: {
            name: customer.name,
            orderId: customer.orderId,
            amount: customer.amount
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`Message sent to ${customer.name}`);
      
      // Wait 2 seconds between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error sending to ${customer.name}:`, error.response?.data || error.message);
    }
  }
}

// 4. Get all templates
async function getAllTemplates() {
  try {
    const response = await axios.get(
      `${API_URL}/templates?category=transactional`,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      }
    );
    
    console.log('Templates:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
```

### cURL Examples

```bash
# 1. Send a welcome message
curl -X POST http://localhost:3000/api/templates/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_xxxxx",
    "to": "919876543210",
    "templateName": "welcome",
    "variables": {
      "name": "John Doe"
    }
  }'

# 2. Create a custom template
curl -X POST http://localhost:3000/api/templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Appointment Reminder",
    "category": "notification",
    "type": "text",
    "content": {
      "text": "Hi {{name}}! Reminder: Your appointment is on {{date}} at {{time}}."
    },
    "variables": ["name", "date", "time"]
  }'

# 3. Get all templates
curl -X GET "http://localhost:3000/api/templates?category=marketing" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Send bulk messages
curl -X POST http://localhost:3000/api/templates/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_xxxxx",
    "to": ["919876543210", "918765432109"],
    "templateName": "productUpdate",
    "variables": {
      "productName": "Premium Plan",
      "oldPrice": "4999",
      "newPrice": "3999",
      "features": ["Feature 1", "Feature 2"],
      "link": "https://example.com"
    },
    "delay": 2000
  }'
```

## WhatsApp Formatting

Use these formatting codes in your templates:

| Format | Syntax | Example |
|--------|--------|---------|
| **Bold** | `*text*` | `*Hello*` → **Hello** |
| _Italic_ | `_text_` | `_Hello_` → _Hello_ |
| ~Strikethrough~ | `~text~` | `~Hello~` → ~~Hello~~ |
| `Monospace` | `` `text` `` | `` `Hello` `` → `Hello` |
| Code Block | ```` ```text``` ```` | ``` ```code``` ``` |
| Quote | `> text` | `> Hello` → Quote block |

### Example with Formatting

```
*Order Confirmed* ✅

Hi _{{name}}_,

Your order has been placed successfully!

Details:
• Order ID: `{{orderId}}`
• Amount: *₹{{amount}}*
• Status: ~Pending~ *Confirmed*

> Thank you for shopping with us!

_For support, reply to this message._
```

## Best Practices

1. **Use Clear Variable Names**: `{{customerName}}` is better than `{{n}}`

2. **Test Templates**: Always preview templates before sending to customers

3. **Handle Missing Variables**: Provide default values when possible

4. **Rate Limiting**: Use the `delay` parameter for bulk sends (recommended: 2000ms)

5. **Keep It Concise**: WhatsApp users prefer shorter messages

6. **Use Emojis Sparingly**: Make messages professional yet friendly

7. **Add Fallback Text**: Include context even without variables:
   ```
   Hi {{name}}! → Hi there!
   ```

8. **Track Usage**: Monitor `usageCount` to optimize popular templates

9. **Version Control**: Keep old templates instead of deleting (set `isActive: false`)

10. **Format Properly**: Use WhatsApp's native formatting for better readability

## Dashboard Usage

Access the templates dashboard at: `http://localhost:3000/dashboard/section/templates`

Features:
- Browse built-in and custom templates
- Create new templates with a visual editor
- Send test messages
- View usage statistics
- Edit and delete templates
- Filter by category and type

## Rate Limiting

Template endpoints have the following rate limits:

- **Get templates**: 100 requests/minute
- **Create/Update/Delete**: 30 requests/minute
- **Send template**: 20 requests/minute
- **Preview**: 50 requests/minute

## Error Handling

Common errors and solutions:

| Error | Solution |
|-------|----------|
| `Template not found` | Check template ID/name, ensure it exists |
| `Session not found` | Verify sessionId is correct and active |
| `Missing variables` | Provide all required variables in the request |
| `Rate limit exceeded` | Wait before sending more messages |
| `Phone number not registered` | Verify the recipient has WhatsApp |

## Support

For issues or questions:
- Check the logs: `/api/templates/send` responses include detailed errors
- Review template structure in the dashboard
- Test with built-in templates first
- Contact support with template ID and error message

---

**Happy Templating! 📝**

