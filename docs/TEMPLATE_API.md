# WhatsApp Template API Documentation

## Overview
The Template API allows you to create, manage, and send reusable message templates through your WhatsApp sessions.

## Base URL
```
/api/templates
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer YOUR_API_KEY
```

---

## Endpoints

### 1. Create Template
**POST** `/api/templates`

Create a new message template.

**Request Body:**
```json
{
  "name": "welcome_message",
  "category": "marketing",
  "type": "text",
  "content": {
    "text": "Hello {{name}}! Welcome to {{company}}. We're excited to have you on board!"
  },
  "variables": ["name", "company"],
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "_id": "template_id_here",
    "name": "welcome_message",
    "userId": "user_id",
    "category": "marketing",
    "type": "text",
    "content": { ... },
    "variables": ["name", "company"],
    "isActive": true,
    "usageCount": 0,
    "createdAt": "2025-11-19T...",
    "updatedAt": "2025-11-19T..."
  }
}
```

---

### 2. List Templates
**GET** `/api/templates`

Get all templates for the authenticated user.

**Query Parameters:**
- `category` (optional) - Filter by category
- `type` (optional) - Filter by type (text, list, product, order, poll)
- `isActive` (optional) - Filter by active status (true/false)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [ ... templates array ... ]
}
```

---

### 3. Get Template by ID
**GET** `/api/templates/:id`

Get a specific template by ID or name.

**Response:**
```json
{
  "success": true,
  "data": { ... template object ... }
}
```

---

### 4. Update Template
**PUT** `/api/templates/:id`

Update an existing template.

**Request Body:**
```json
{
  "content": {
    "text": "Updated message text with {{variable}}"
  },
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": { ... updated template ... }
}
```

---

### 5. Delete Template
**DELETE** `/api/templates/:id`

Delete a template.

**Response:**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---

### 6. Send Template Message
**POST** `/api/templates/send`

Send a template message through a WhatsApp session.

**Request Body (Single Recipient):**
```json
{
  "sessionId": "session_123",
  "to": "+1234567890",
  "templateName": "welcome_message",
  "variables": {
    "name": "John",
    "company": "Acme Corp"
  }
}
```

**Request Body (Multiple Recipients):**
```json
{
  "sessionId": "session_123",
  "to": ["+1234567890", "+0987654321", "+1122334455"],
  "templateId": "template_id_here",
  "variables": {
    "name": "Customer",
    "company": "Acme Corp"
  },
  "delay": 2000
}
```

**Parameters:**
- `sessionId` (required) - WhatsApp session ID
- `to` (required) - Phone number(s) with country code
- `templateId` or `templateName` (required) - Template identifier
- `variables` (optional) - Object with variable values
- `delay` (optional) - Delay between bulk sends in milliseconds (default: 2000)

**Response:**
```json
{
  "success": true,
  "message": "Template sent successfully to 3 recipient(s)",
  "data": {
    "success": true,
    "sent": 3,
    "failed": 0,
    "results": [
      {
        "to": "+1234567890",
        "success": true,
        "messageId": "msg_abc123"
      },
      {
        "to": "+0987654321",
        "success": true,
        "messageId": "msg_def456"
      },
      {
        "to": "+1122334455",
        "success": true,
        "messageId": "msg_ghi789"
      }
    ]
  }
}
```

---

### 7. Preview Template
**POST** `/api/templates/preview`

Preview a template with variables replaced.

**Request Body:**
```json
{
  "templateName": "welcome_message",
  "variables": {
    "name": "John",
    "company": "Acme Corp"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "original": "Hello {{name}}! Welcome to {{company}}.",
    "preview": "Hello John! Welcome to Acme Corp.",
    "variables": ["name", "company"]
  }
}
```

---

## Template Types

### 1. Text Template
Simple text messages with variable substitution.

```json
{
  "type": "text",
  "content": {
    "text": "Hello {{name}}! Your order {{orderId}} is ready."
  },
  "variables": ["name", "orderId"]
}
```

### 2. List Template
Interactive list messages with sections and rows.

```json
{
  "type": "list",
  "content": {
    "listBody": "Choose a product from our catalog:",
    "listButtonText": "View Products",
    "listTitle": "Product Catalog",
    "listFooter": "Powered by WhatsApp API",
    "listSections": [
      {
        "title": "Electronics",
        "rows": [
          {
            "id": "prod_1",
            "title": "Smartphone",
            "description": "Latest model - $699"
          },
          {
            "id": "prod_2",
            "title": "Laptop",
            "description": "High performance - $1299"
          }
        ]
      },
      {
        "title": "Accessories",
        "rows": [
          {
            "id": "prod_3",
            "title": "Headphones",
            "description": "Noise cancelling - $199"
          }
        ]
      }
    ]
  }
}
```

### 3. Product Template
Product catalog messages.

```json
{
  "type": "product",
  "content": {
    "productImage": "https://example.com/product.jpg",
    "title": "{{productName}}",
    "productDescription": "{{description}}",
    "currencyCode": "USD",
    "priceAmount1000": 99900,
    "productUrl": "https://example.com/products/{{productId}}"
  },
  "variables": ["productName", "description", "productId"]
}
```

### 4. Order Template
Order confirmation messages.

```json
{
  "type": "order",
  "content": {
    "orderId": "{{orderId}}",
    "orderStatus": "confirmed",
    "orderMessage": "Your order has been confirmed!",
    "orderTitle": "Order Confirmation",
    "totalAmount1000": 149900,
    "totalCurrencyCode": "USD",
    "orderItems": [
      {
        "productId": "{{productId}}",
        "name": "{{productName}}",
        "quantity": 1,
        "currency": "USD",
        "priceAmount1000": 149900
      }
    ]
  },
  "variables": ["orderId", "productId", "productName"]
}
```

### 5. Poll Template
Survey/poll messages.

```json
{
  "type": "poll",
  "content": {
    "pollName": "How satisfied are you with our service?",
    "pollOptions": [
      "Very Satisfied",
      "Satisfied",
      "Neutral",
      "Dissatisfied",
      "Very Dissatisfied"
    ],
    "selectableOptionsCount": 1
  }
}
```

---

## Code Examples

### JavaScript/Node.js
```javascript
// Create a template
const createTemplate = async () => {
  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'order_confirmation',
      type: 'text',
      content: {
        text: 'Hi {{name}}! Your order #{{orderId}} totaling ${{amount}} has been confirmed. Expected delivery: {{date}}'
      },
      variables: ['name', 'orderId', 'amount', 'date'],
      category: 'transactional'
    })
  });
  
  const result = await response.json();
  console.log(result);
};

// Send template
const sendTemplate = async () => {
  const response = await fetch('/api/templates/send', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: 'session_123',
      to: '+1234567890',
      templateName: 'order_confirmation',
      variables: {
        name: 'John Doe',
        orderId: 'ORD-12345',
        amount: '149.99',
        date: '2025-11-25'
      }
    })
  });
  
  const result = await response.json();
  console.log(result);
};
```

### Python
```python
import requests

# Create template
def create_template():
    url = "https://api.messaging.com/api/templates"
    headers = {
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    }
    data = {
        "name": "order_confirmation",
        "type": "text",
        "content": {
            "text": "Hi {{name}}! Your order #{{orderId}} totaling ${{amount}} has been confirmed."
        },
        "variables": ["name", "orderId", "amount"],
        "category": "transactional"
    }
    
    response = requests.post(url, headers=headers, json=data)
    print(response.json())

# Send template
def send_template():
    url = "https://api.messaging.com/api/templates/send"
    headers = {
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    }
    data = {
        "sessionId": "session_123",
        "to": "+1234567890",
        "templateName": "order_confirmation",
        "variables": {
            "name": "John Doe",
            "orderId": "ORD-12345",
            "amount": "149.99"
        }
    }
    
    response = requests.post(url, headers=headers, json=data)
    print(response.json())
```

### cURL
```bash
# Create template
curl -X POST https://api.messaging.com/api/templates \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "welcome_message",
    "type": "text",
    "content": {
      "text": "Hello {{name}}! Welcome to our service."
    },
    "variables": ["name"]
  }'

# Send template
curl -X POST https://api.messaging.com/api/templates/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "to": "+1234567890",
    "templateName": "welcome_message",
    "variables": {
      "name": "John"
    }
  }'
```

---

## Error Responses

### Template Not Found
```json
{
  "success": false,
  "message": "Template not found: template_name"
}
```

### Missing Required Fields
```json
{
  "success": false,
  "message": "sessionId and to (recipient) are required"
}
```

### Send Failure
```json
{
  "success": false,
  "message": "Session not found or not connected",
  "data": {
    "success": false,
    "sent": 0,
    "failed": 1,
    "results": [
      {
        "to": "+1234567890",
        "success": false,
        "error": "Session not found or not connected"
      }
    ]
  }
}
```

---

## Best Practices

1. **Use Descriptive Names**: Name templates clearly (e.g., `order_confirmation`, `welcome_message`)
2. **Test with Preview**: Use the preview endpoint before sending to verify variable replacement
3. **Bulk Sending**: Use appropriate delays (2000-5000ms) to avoid rate limiting
4. **Error Handling**: Always check the `success` field and handle errors appropriately
5. **Variable Validation**: Ensure all required variables are provided when sending
6. **Template Management**: Regularly review and update templates for accuracy
7. **Rate Limiting**: Respect WhatsApp rate limits when sending bulk messages

---

## Notes

- Templates are user-specific and cannot be shared between users
- Variable names are case-sensitive
- Phone numbers must include country code (e.g., +1234567890)
- Bulk sending supports up to 100 recipients per request
- Template usage count is automatically tracked
- Inactive templates can still be sent but won't appear in active lists
