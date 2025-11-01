# Vercel Deployment Guide

## Prerequisites

1. **Vercel CLI installed** ✅ (Already done)
2. **Vercel account** ✅ (Already logged in)
3. **MongoDB Atlas account** (for production database)
4. **Redis Cloud account** (for production caching)

## Environment Variables Setup

Before deploying, you need to set up the following environment variables in Vercel:

### Required Environment Variables

```bash
# Production Environment
NODE_ENV=production

# Database (Use MongoDB Atlas for production)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp_api
MONGODB_DB_NAME=whatsapp_api

# Redis (Use Redis Cloud for production)
REDIS_URL=redis://username:password@host:port

# JWT Secrets (Generate strong secrets)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-minimum-32-characters-long
JWT_REFRESH_EXPIRES_IN=30d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@whatsapp-api.com
SMTP_SECURE=false

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=/tmp/sessions
WHATSAPP_MAX_SESSIONS=5
WHATSAPP_SESSION_TIMEOUT=300000

# Security
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true
HELMET_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: Payment Gateways
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
```

## Deployment Steps

### Method 1: Using Vercel CLI (Recommended)

1. **Set Environment Variables**:
   ```bash
   # Set each environment variable
   vercel env add NODE_ENV
   vercel env add MONGODB_URI
   vercel env add JWT_SECRET
   # ... continue for all required variables
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

### Method 2: Using Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Import your project from Git
3. Set environment variables in the dashboard
4. Deploy

## Important Notes

### Database Setup
- **MongoDB Atlas**: Create a cluster and get connection string
- **Whitelist Vercel IPs**: Add `0.0.0.0/0` to MongoDB Atlas IP whitelist

### Redis Setup
- **Redis Cloud**: Create a database and get connection URL
- **Alternative**: Use Vercel KV for simple caching needs

### File Storage
- WhatsApp sessions will be stored in `/tmp` (ephemeral)
- For persistent storage, consider using AWS S3 or Vercel Blob

### Limitations on Vercel
- **Function timeout**: 30 seconds max (configured in vercel.json)
- **Memory**: 1GB max
- **File system**: Read-only except `/tmp`
- **Cold starts**: Functions may have cold start delays

## Post-Deployment

1. **Test the deployment**:
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Monitor logs**:
   ```bash
   vercel logs
   ```

3. **Set up custom domain** (optional):
   ```bash
   vercel domains add yourdomain.com
   ```

## Troubleshooting

### Common Issues

1. **Environment variables not set**: Check Vercel dashboard
2. **Database connection failed**: Verify MongoDB URI and IP whitelist
3. **Function timeout**: Optimize code or increase timeout in vercel.json
4. **Memory issues**: Optimize memory usage or upgrade plan

### Debugging

```bash
# View function logs
vercel logs --follow

# Check environment variables
vercel env ls
```

## Security Checklist

- [ ] Strong JWT secrets set
- [ ] Database credentials secured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Sensitive data not in logs