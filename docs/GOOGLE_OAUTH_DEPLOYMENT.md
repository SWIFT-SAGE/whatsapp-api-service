# Google OAuth Production Deployment Fix

## Problem
Google OAuth redirects to `localhost:3000` instead of your production domain after deployment.

## Root Cause
The application needs to know your production URL to generate the correct OAuth callback URL. By default, it uses `localhost:3000` for development.

## Solution

### Step 1: Set Environment Variables in Production

Add these environment variables to your hosting platform (Vercel, Heroku, Railway, etc.):

```bash
# REQUIRED: Set to production
NODE_ENV=production

# REQUIRED: Your production domain (choose ONE of the following)

# Option A: Set explicit callback URL (RECOMMENDED)
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# Option B: Set production URL (callback auto-generated)
PRODUCTION_URL=https://yourdomain.com

# REQUIRED: Your Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Step 2: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add:
   ```
   https://yourdomain.com/auth/google/callback
   ```
4. Click "Save"

### Step 3: Restart Your Application

After setting the environment variables, restart your application for changes to take effect.

---

## Platform-Specific Instructions

### Vercel

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
   - `NODE_ENV` = `production`
   - `PRODUCTION_URL` = `https://yourdomain.com`
   - `GOOGLE_CLIENT_ID` = `your-client-id`
   - `GOOGLE_CLIENT_SECRET` = `your-client-secret`
4. Redeploy your application

### Heroku

```bash
heroku config:set NODE_ENV=production
heroku config:set PRODUCTION_URL=https://yourapp.herokuapp.com
heroku config:set GOOGLE_CLIENT_ID=your-client-id
heroku config:set GOOGLE_CLIENT_SECRET=your-client-secret
```

### Railway

1. Go to your project
2. Click on "Variables"
3. Add the environment variables listed above
4. Railway will automatically redeploy

### Docker / VPS

Add to your `.env` file or docker-compose.yml:

```bash
NODE_ENV=production
PRODUCTION_URL=https://yourdomain.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## How It Works

The application determines the callback URL in this priority order:

1. **`GOOGLE_CALLBACK_URL`** (if set) - Uses this exact URL
2. **Development mode** (`NODE_ENV != production`) - Uses `localhost:3000`
3. **`PRODUCTION_URL`** (if set) - Appends `/auth/google/callback`
4. **`VERCEL_URL`** (if on Vercel) - Auto-detected
5. **Default production** - Falls back to `https://apimessinging.com`
6. **Final fallback** - `localhost:3000`

---

## Verification

After deployment, check your server logs for:

```
🔐 Google OAuth Configuration:
  - Environment: production
  - Is Production: true
  - Callback URL: https://yourdomain.com/auth/google/callback
  - Client ID: 1025829993522-lfkiif8iju1jl49r...
  - PRODUCTION_URL env var: https://yourdomain.com
```

If you see `localhost:3000` in the logs, the environment variables are not set correctly.

---

## Troubleshooting

### Issue: Still redirecting to localhost

**Solution:**
1. Verify `NODE_ENV=production` is set
2. Verify `PRODUCTION_URL` or `GOOGLE_CALLBACK_URL` is set
3. Restart the application
4. Check server logs for the actual callback URL being used

### Issue: "redirect_uri_mismatch" error

**Solution:**
1. The callback URL in your code doesn't match Google Console
2. Copy the exact URL from server logs
3. Add it to Google Console "Authorized redirect URIs"
4. Wait a few minutes for Google to update

### Issue: Environment variables not working

**Solution:**
1. Check if your hosting platform requires a specific format
2. Ensure no trailing slashes in URLs
3. Restart/redeploy after setting variables
4. Check platform-specific documentation

---

## Quick Fix Commands

### Check current configuration (in production)
```bash
# SSH into your server or check logs
# Look for "Google OAuth Configuration" output
```

### Set variables (example for Vercel)
```bash
vercel env add PRODUCTION_URL
# Enter: https://yourdomain.com

vercel env add NODE_ENV
# Enter: production

vercel --prod
```

---

## Security Notes

- Never commit `.env` file with real credentials to git
- Use environment variables in production (never hardcode)
- Rotate OAuth credentials if accidentally exposed
- Use different OAuth credentials for development and production

---

## Need Help?

If you're still having issues:

1. Check server logs for the actual callback URL
2. Verify Google Console has the correct redirect URI
3. Ensure `NODE_ENV=production` is set
4. Try setting `GOOGLE_CALLBACK_URL` explicitly instead of `PRODUCTION_URL`
