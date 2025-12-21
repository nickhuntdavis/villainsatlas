# Security Guide

This document outlines security measures and required manual steps to secure the application.

## ✅ Automated Fixes Applied

The following security issues have been automatically fixed:

1. **Removed hardcoded API token** - The hardcoded Baserow API token fallback has been removed from `services/baserowService.ts`
2. **Added input validation** - All Netlify functions now validate and sanitize user inputs
3. **CORS restrictions** - CORS is now configurable via `ALLOWED_ORIGIN` environment variable
4. **Better error handling** - Missing environment variables now throw clear errors instead of silently failing

## 🔴 CRITICAL: Manual Steps Required

### 1. Rotate Exposed API Keys (IMMEDIATE)

**Baserow API Token:**
- The hardcoded token `FhAvq74hSan4hSyyYB012Vp5eQmoOaGR` was exposed in the codebase
- **Action Required:**
  1. Log into your Baserow account
  2. Go to Settings → API Tokens
  3. Revoke/delete the exposed token
  4. Generate a new API token
  5. Update `VITE_BASEROW_API_TOKEN` in your environment variables (local `.env.local` and Netlify)

**Gemini API Key:**
- Check if your Gemini API key was exposed in the client bundle
- **Action Required:**
  1. Go to Google Cloud Console → APIs & Services → Credentials
  2. Find your Gemini API key
  3. If it was exposed, delete it and create a new one
  4. Update `VITE_GEMINI_API_KEY` in your environment variables

**Google Maps API Key:**
- Check if your Google Maps API key was exposed
- **Action Required:**
  1. Go to Google Cloud Console → APIs & Services → Credentials
  2. Find your Google Maps API key
  3. If it was exposed, delete it and create a new one
  4. Update `VITE_GOOGLE_MAPS_API_KEY` in your environment variables

### 2. Restrict Google Maps API Key (HIGH PRIORITY)

**Why:** Even if the key is exposed, you can limit damage by restricting it.

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your Google Maps API key
4. Under **API restrictions**, select **Restrict key**
5. Select only these APIs:
   - Places API
   - Place Photos API
   - Geocoding API (if used)
6. Under **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add your production domain: `https://yourdomain.com/*`
   - Add your Netlify domain: `https://*.netlify.app/*` (for previews)
   - Add `http://localhost:*` (for local development)
7. Click **Save**

### 3. Set CORS Origin in Netlify (HIGH PRIORITY)

**Why:** Currently CORS allows all origins (`*`). Restrict it to your domain.

**Steps:**
1. Go to Netlify Dashboard → Your Site → Site Settings → Environment Variables
2. Add a new environment variable:
   - **Key:** `ALLOWED_ORIGIN`
   - **Value:** `https://yourdomain.com` (replace with your actual domain)
3. For multiple domains, you can use: `https://yourdomain.com,https://www.yourdomain.com`
4. **Note:** The functions will fall back to `*` if this variable is not set, but you should set it for production

### 4. Set API Quotas and Limits (MEDIUM PRIORITY)

**Google Maps API:**
1. Go to Google Cloud Console → APIs & Services → Dashboard
2. Select **Places API**
3. Go to **Quotas** tab
4. Set daily quotas to prevent unexpected costs
5. Enable billing alerts

**Gemini API:**
1. Go to Google Cloud Console → APIs & Services → Dashboard
2. Select **Generative Language API** (Gemini)
3. Go to **Quotas** tab
4. Set rate limits and quotas
5. Enable billing alerts

### 5. Review and Secure Environment Variables

**Local Development:**
- Ensure `.env.local` is in `.gitignore` (it should be)
- Never commit API keys to git
- Use different API keys for development vs production

**Netlify Production:**
1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Verify all required variables are set:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
   - `VITE_BASEROW_API_TOKEN`
   - `VITE_BASEROW_TABLE_ID`
   - `ALLOWED_ORIGIN` (new - for CORS)
3. Ensure no sensitive values are visible in build logs

### 6. Monitor API Usage

**Set up monitoring:**
1. Enable Google Cloud billing alerts
2. Set up usage alerts for each API
3. Regularly review API usage in Google Cloud Console
4. Check for unusual spikes that might indicate key theft

## ⚠️ Known Security Limitations

### Client-Side API Keys

**Current State:**
- Gemini API key is embedded in the client bundle (via Vite's `define`)
- Baserow API token is embedded in the client bundle
- Google Maps API key is embedded in the client bundle

**Why This Is a Problem:**
- Anyone can view the source code and extract these keys
- Keys can be used by malicious actors, leading to quota abuse and unexpected costs

**Long-Term Solution:**
- Move all sensitive API calls to server-side (Netlify functions or backend API)
- Only expose keys that must be client-side (like Google Maps with proper restrictions)
- Implement rate limiting on server-side endpoints

**Short-Term Mitigation:**
- Restrict API keys as described above
- Set quotas and billing alerts
- Monitor usage regularly

## 🔒 Security Best Practices

1. **Never commit API keys** - Always use environment variables
2. **Rotate keys regularly** - Especially if they may have been exposed
3. **Use different keys for dev/staging/prod** - Isolate environments
4. **Monitor usage** - Set up alerts for unusual activity
5. **Restrict API keys** - Always apply domain and API restrictions
6. **Set quotas** - Prevent unexpected costs from key theft
7. **Review access logs** - Regularly check who is using your APIs

## 📝 Checklist

- [ ] Rotate Baserow API token
- [ ] Rotate Gemini API key (if exposed)
- [ ] Rotate Google Maps API key (if exposed)
- [ ] Restrict Google Maps API key (domain + API restrictions)
- [ ] Set `ALLOWED_ORIGIN` in Netlify environment variables
- [ ] Set API quotas and billing alerts
- [ ] Verify `.env.local` is in `.gitignore`
- [ ] Review Netlify environment variables
- [ ] Set up usage monitoring

## 🆘 If Your Keys Are Compromised

1. **Immediately revoke** the compromised keys
2. **Generate new keys** and update environment variables
3. **Review usage logs** to see if there was any abuse
4. **Check billing** for unexpected charges
5. **Contact support** if you see suspicious activity:
   - Google Cloud Support (for Maps/Gemini)
   - Baserow Support (for Baserow token)

## 📚 Additional Resources

- [Google Cloud API Key Security](https://cloud.google.com/docs/authentication/api-keys)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

