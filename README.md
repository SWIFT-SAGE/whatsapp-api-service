# WhatsApp API Service

A production-ready WhatsApp API service built with Node.js, TypeScript, and Express. This service provides a comprehensive REST API for managing WhatsApp sessions, sending messages, handling webhooks, and analytics.

## 🚀 Features

- **Multi-Session Management**: Handle multiple WhatsApp sessions simultaneously
- **Message Operations**: Send text, media, location, and contact messages
- **Webhook Support**: Real-time event notifications with retry mechanisms
- **Analytics & Monitoring**: Comprehensive usage tracking and reporting
- **Rate Limiting**: Built-in protection against abuse
- **File Upload**: Support for media file uploads with validation
- **User Management**: Authentication, API keys, and subscription management
- **Production Ready**: Security headers, compression, caching, and clustering
- **Comprehensive Validation**: Input validation for all endpoints
- **Email Notifications**: Automated email alerts and reports

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB 5.0+
- Redis 6.0+ (optional, for caching and rate limiting)
- Chrome/Chromium (for WhatsApp Web automation)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd whatsapp-api-service
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration. See [Configuration Guide](#configuration-guide) for details.

### 4. Build the Application

```bash
npm run build
```

### 5. Start the Service

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## 🔧 Configuration Guide

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/whatsapp-api` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `your-super-secret-jwt-key-32-chars-min` |
| `JWT_REFRESH_SECRET` | JWT refresh secret (32+ chars) | `your-refresh-secret-32-chars-min` |

### Optional Configuration

#### Email (SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourapp.com
```

#### Redis (Caching & Rate Limiting)
```env
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

#### External Services
```env
# Twilio (SMS notifications)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# AWS (File storage)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-s3-bucket

# Firebase (Push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
```

## 🏗️ Production Deployment

### Docker Deployment

1. **Create Dockerfile:**

```dockerfile
FROM node:18-alpine

# Install Chrome dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Chrome path
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S whatsapp -u 1001

# Create directories and set permissions
RUN mkdir -p /app/sessions /app/uploads /app/logs
RUN chown -R whatsapp:nodejs /app

USER whatsapp

EXPOSE 3000

CMD ["npm", "start"]
```

2. **Create docker-compose.yml:**

```yaml
version: '3.8'

services:
  whatsapp-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/whatsapp-api
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./sessions:/app/sessions
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:5.0
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:6.2-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - whatsapp-api
    restart: unless-stopped

volumes:
  mongo_data:
  redis_data:
```

3. **Deploy:**

```bash
docker-compose up -d
```

### PM2 Deployment

1. **Install PM2:**

```bash
npm install -g pm2
```

2. **Create ecosystem.config.js:**

```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

3. **Start with PM2:**

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files
    location /uploads {
        alias /app/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 📚 API Documentation

Once the service is running, visit:
- **API Documentation**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`
- **Metrics**: `http://localhost:3000/metrics` (production only)

### Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

### API Endpoints

#### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - User logout

#### Sessions
- `GET /api/v1/sessions` - List sessions
- `POST /api/v1/sessions` - Create session
- `GET /api/v1/sessions/:id` - Get session details
- `PUT /api/v1/sessions/:id` - Update session
- `DELETE /api/v1/sessions/:id` - Delete session
- `GET /api/v1/sessions/:id/qr` - Get QR code
- `POST /api/v1/sessions/:id/start` - Start session
- `POST /api/v1/sessions/:id/stop` - Stop session

#### Messages
- `POST /api/v1/sessions/:id/messages` - Send message
- `POST /api/v1/sessions/:id/messages/bulk` - Send bulk messages
- `GET /api/v1/sessions/:id/messages` - Get messages
- `DELETE /api/v1/messages/:messageId` - Delete message

#### Webhooks
- `GET /api/v1/webhooks` - List webhooks
- `POST /api/v1/webhooks` - Create webhook
- `PUT /api/v1/webhooks/:id` - Update webhook
- `DELETE /api/v1/webhooks/:id` - Delete webhook
- `POST /api/v1/webhooks/:id/test` - Test webhook

## 🔒 Security Best Practices

### Environment Security
- Use strong, unique secrets for JWT tokens (32+ characters)
- Enable HTTPS in production
- Configure proper CORS origins
- Use environment variables for sensitive data
- Regular security updates

### Database Security
- Use MongoDB authentication
- Enable SSL/TLS for database connections
- Regular backups
- Monitor for suspicious activity

### API Security
- Rate limiting enabled by default
- Input validation on all endpoints
- API key authentication
- Request size limits
- Security headers (Helmet.js)

## 📊 Monitoring & Logging

### Health Checks

The service provides comprehensive health checks:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "whatsapp": "healthy"
  }
}
```

### Logging

Logs are structured and include:
- Request/response logging
- Error tracking
- Performance metrics
- Security events

Log files location: `./logs/`

### Metrics

Prometheus-compatible metrics available at `/metrics` (production only).

## 🚨 Troubleshooting

### Common Issues

1. **WhatsApp Session Not Starting**
   - Check Chrome/Chromium installation
   - Verify session directory permissions
   - Check firewall settings

2. **Database Connection Issues**
   - Verify MongoDB is running
   - Check connection string format
   - Ensure network connectivity

3. **High Memory Usage**
   - Monitor Chrome processes
   - Implement session cleanup
   - Consider reducing max sessions

4. **Rate Limiting Issues**
   - Check Redis connection
   - Adjust rate limit settings
   - Monitor API usage patterns

### Debug Mode

Enable debug logging:

```env
DEBUG=true
LOG_LEVEL=debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

## 🔄 Updates

To update the service:

```bash
git pull origin main
npm install
npm run build
pm2 restart whatsapp-api  # if using PM2
```

---

**Note**: This service is for educational and legitimate business purposes only. Ensure compliance with WhatsApp's Terms of Service and local regulations.
#   w h a t s a p p - a p i - m e s s i n g  
 