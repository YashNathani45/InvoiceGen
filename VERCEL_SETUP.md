 # Vercel Deployment Setup Guide

## Issue Fixed
The push notifications weren't working on Vercel because:
1. **File persistence**: Vercel serverless functions use ephemeral filesystems - files don't persist between deployments
2. **Storage solution**: We've migrated from file-based storage to **Vercel KV** (Redis) for persistent storage

## Setup Steps

### 1. Install Vercel KV
The package `@vercel/kv` has already been added to `package.json`. Make sure to run:
```bash
npm install
```

### 2. Create Vercel KV Database
1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Click **Create Database**
4. Select **KV** (Redis)
5. Give it a name (e.g., "invoice-kv")
6. Choose a region close to your users
7. Click **Create**

### 3. Link KV to Your Project
After creating the KV database:
1. Vercel will automatically add the required environment variables:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

These are automatically available to your serverless functions.

### 4. Set VAPID Keys as Environment Variables
In your Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add these variables:

   **For Production, Preview, and Development:**
   - `NEXT_PUBLIC_VAPID_PUBLIC` = `BEBev2JJnGphDMc42AbL2k-GZ0PcEqff5bF2Lz7MUxokxuTexOxJbYiT6IbZDjNMJpS5gk-4N2w90Gv44nIiiKU`
   - `VAPID_PRIVATE` = `wfzWBBz_qAm_ThSKNK6sYwP8Y8XxDsW8NUf820lXcUw`

   **Note:** For production, you should generate your own VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```

### 5. Set Email Configuration (if not already done)
Add your SMTP settings:
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_PORT`
- `SMTP_FROM`

### 6. Redeploy
After setting up KV and environment variables:
1. Push your changes to trigger a new deployment, OR
2. Go to **Deployments** tab and click **Redeploy** on the latest deployment

## Testing

1. Visit your deployed site: `https://your-app.vercel.app/admin-notifications`
2. Click **Enable Notifications**
3. Allow notifications when prompted
4. Try generating an invoice - you should receive a push notification!

## Troubleshooting

### Notifications still not working?
1. **Check browser console** for errors
2. **Verify VAPID keys** match between client and server
3. **Check Vercel logs** (Deployments → View Function Logs)
4. **Ensure KV is linked** - check Storage tab shows your KV database
5. **Verify environment variables** are set correctly in Vercel dashboard

### Common Issues

**"Failed to subscribe" error:**
- Check that `NEXT_PUBLIC_VAPID_PUBLIC` is set in Vercel environment variables
- Ensure the service worker (`/sw.js`) is accessible

**"No admin subscribed" error:**
- Make sure you've visited `/admin-notifications` and clicked "Enable Notifications"
- Check KV database has subscriptions stored (you can view this in Vercel KV dashboard)

**Notifications work locally but not on Vercel:**
- This was the exact issue we fixed! Make sure KV is set up and linked to your project
- Verify environment variables are set in Vercel (not just locally)

## Security Note

⚠️ **Important**: The VAPID keys in the code are defaults. For production:
1. Generate new keys: `npx web-push generate-vapid-keys`
2. Update environment variables in Vercel
3. Never commit private keys to git


