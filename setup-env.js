#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');


// Generate secure JWT secrets
const jwtSecret = crypto.randomBytes(32).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(32).toString('hex');

const envContent = `# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/whatsapp_api
MONGODB_DB_NAME=whatsapp_api

# JWT Configuration
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=${jwtRefreshSecret}
JWT_REFRESH_EXPIRES_IN=30d

# Email Configuration (Optional - leave empty to disable email)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
FROM_NAME=WhatsApp API Service

# Frontend URL
FRONTEND_URL=http://localhost:3000

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./sessions
WHATSAPP_MAX_SESSIONS=10
WHATSAPP_SESSION_TIMEOUT=300000
WHATSAPP_MAX_RETRY=3

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MESSAGE=Too many requests, please try again later

# Security
CORS_ORIGIN=*
CORS_CREDENTIALS=false
HELMET_ENABLED=true
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=5
LOG_FILE_NAME=app.log

# Monitoring & Analytics
ANALYTICS_ENABLED=true
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# Webhook Configuration
WEBHOOK_TIMEOUT=10000
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_RETRY_DELAY=1000

# API Configuration
API_VERSION=v1
API_PREFIX=/api
API_DOCS_ENABLED=true

# Performance
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6
CACHE_TTL=3600

# Development
DEBUG=false
MOCK_WHATSAPP=false
`;

try {
  fs.writeFileSync('.env', envContent);
} catch (error) {
}
