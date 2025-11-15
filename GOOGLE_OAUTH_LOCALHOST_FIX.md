# Fixing Google OAuth redirect_uri_mismatch on localhost:3000

## Problem
Getting `Error 400: redirect_uri_mismatch` when trying to sign in with Google on localhost:3000.

## Quick Fix Steps

### 1. Check What URL Is Being Sent

Visit this debug endpoint to see what callback URL your app is using:
```
http://localhost:3000/debug/oauth-config
```

This will show you:
- The exact callback URL being used
- Environment variables
- What should be configured in Google Console

### 2. Verify Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Click **Edit**
5. Under **Authorized redirect URIs**, make sure you have EXACTLY:
   ```
   http://localhost:3000/auth/google/callback
   ```
   
   **Important:**
   - No trailing slash
   - Must be `http://` (not `https://`)
   - Must be `localhost` (not `127.0.0.1`)
   - Port must be `3000`
   - Path must be exactly `/auth/google/callback`

6. Click **Save**

### 3. Check Your Environment Variables

Make sure you don't have these set in your `.env` file (they would override localhost):
- `GOOGLE_CALLBACK_URL` - Remove this for localhost
- `PRODUCTION_URL` - Remove this for localhost
- `NODE_ENV=production` - Should be `development` or not set

### 4. Restart Your Server

After making changes:
```bash
# Stop your server (Ctrl+C)
# Then restart
npm run dev
```

Check the console output - you should see:
```
🔐 Google OAuth Configuration:
  - Environment: development
  - Is Production: false
  - Callback URL: http://localhost:3000/auth/google/callback
```

### 5. Clear Browser Cache

Sometimes browsers cache OAuth redirects. Try:
- Incognito/Private mode
- Clear browser cache
- Or use a different browser

## Common Issues

### Issue 1: NODE_ENV is set to production
**Solution:** Make sure `NODE_ENV` is `development` or not set in your `.env` file.

### Issue 2: Environment variable override
**Solution:** Check if you have `GOOGLE_CALLBACK_URL` or `PRODUCTION_URL` set in your `.env` file. Remove them for localhost testing.

### Issue 3: URL doesn't match exactly
**Solution:** Google is very strict. The URL must match EXACTLY:
- ✅ `http://localhost:3000/auth/google/callback`
- ❌ `http://localhost:3000/auth/google/callback/` (trailing slash)
- ❌ `https://localhost:3000/auth/google/callback` (https)
- ❌ `http://127.0.0.1:3000/auth/google/callback` (127.0.0.1 instead of localhost)

### Issue 4: Wrong port
**Solution:** Make sure your server is running on port 3000, or update both:
- The callback URL in code (should auto-detect from PORT env var)
- The authorized redirect URI in Google Console

## Testing

1. Start your server: `npm run dev`
2. Visit: `http://localhost:3000/debug/oauth-config`
3. Verify the callback URL matches what's in Google Console
4. Try signing in with Google
5. If it still fails, check the exact error message in the browser

## Still Not Working?

1. **Check the debug endpoint output** - Compare it with Google Console
2. **Check server logs** - Look for the OAuth configuration log
3. **Try a different browser** - Sometimes browser extensions interfere
4. **Wait a few minutes** - Google Console changes can take 5 minutes to propagate

