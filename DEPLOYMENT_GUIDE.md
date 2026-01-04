# Charm Cards API Deployment Guide for Vercel

This guide walks you through deploying the Charm Cards API to Vercel and connecting it to your frontend.

## Prerequisites

- ✅ Frontend already deployed on Vercel
- ✅ Vercel account
- ✅ Vercel CLI installed (`npm install -g vercel`)
- ✅ Git repository set up

---

## Step 1: Prepare the API for Vercel Deployment

### 1.1 Install Vercel Node.js Package

```bash
cd api
npm install @vercel/node --save
```

### 1.2 Build the API

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

---

## Step 2: Deploy API to Vercel

### 2.1 Navigate to API Directory

```bash
cd api
```

### 2.2 Login to Vercel (if not already logged in)

```bash
vercel login
```

### 2.3 Initialize Vercel Project

```bash
vercel
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No (create new)
- **Project name?** → `charm-cards-api` (or your preferred name)
- **Directory?** → `./` (current directory)
- **Override settings?** → No

### 2.4 Deploy to Production

```bash
vercel --prod
```

**Save the deployment URL!** It will look like:
```
https://charm-cards-api-xxxxx.vercel.app
```

---

## Step 3: Configure Environment Variables in Vercel

### 3.1 Set Environment Variables via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `charm-cards-api` project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

#### Required Environment Variables:

```env
BITCOIN_NETWORK=testnet4
CHARMS_APP_PATH=../gift-cards
CHARMS_APP_VK=<your_app_verification_key>
PROVER_API_URL=https://v8.charms.dev/spells/prove
PORT=3001
NODE_ENV=production
```

#### How to Get CHARMS_APP_VK:

```bash
cd gift-cards
charms app vk target/wasm32-wasip1/release/gift-cards.wasm
```

Copy the output and use it as `CHARMS_APP_VK`.

### 3.2 Set Environment Variables via CLI (Alternative)

```bash
cd api
vercel env add BITCOIN_NETWORK
# Enter: testnet4

vercel env add CHARMS_APP_PATH
# Enter: ../gift-cards

vercel env add CHARMS_APP_VK
# Enter: <your_app_vk>

vercel env add PROVER_API_URL
# Enter: https://v8.charms.dev/spells/prove

vercel env add PORT
# Enter: 3001

vercel env add NODE_ENV
# Enter: production
```

### 3.3 Redeploy After Adding Environment Variables

```bash
vercel --prod
```

---

## Step 4: Handle WASM Binary (Important!)

The API needs access to the compiled WASM binary. You have two options:

### Option A: Include WASM in Deployment (Recommended for Testnet)

1. Copy the WASM binary to the API directory:

```bash
# From the api directory
mkdir -p wasm
cp ../gift-cards/target/wasm32-wasip1/release/gift-cards.wasm wasm/
```

2. Update `CHARMS_APP_PATH` in Vercel to point to `./wasm`:

```bash
vercel env rm CHARMS_APP_PATH
vercel env add CHARMS_APP_PATH
# Enter: ./wasm
```

3. Redeploy:

```bash
vercel --prod
```

### Option B: Use External Storage (Recommended for Production)

1. Upload WASM to a CDN or storage service (e.g., AWS S3, Cloudflare R2)
2. Update `CHARMS_APP_PATH` to the URL
3. Modify `charms-service.ts` to fetch from URL if needed

---

## Step 5: Update Frontend to Use Deployed API

### 5.1 Get Your API URL

Your API URL will be:
```
https://charm-cards-api-xxxxx.vercel.app
```

### 5.2 Update Frontend Environment Variables

1. Go to your **Frontend Vercel Project** → **Settings** → **Environment Variables**
2. Update or add:

```env
NEXT_PUBLIC_API_URL=https://charm-cards-api-xxxxx.vercel.app
```

**Important:** The URL should NOT have a trailing slash!

### 5.3 Redeploy Frontend

```bash
cd ..  # Back to frontend root
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard.

---

## Step 6: Verify Deployment

### 6.1 Test API Health Endpoint

```bash
curl https://charm-cards-api-xxxxx.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "charm-cards-api",
  "timestamp": "2025-01-03T..."
}
```

### 6.2 Test API Root

```bash
curl https://charm-cards-api-xxxxx.vercel.app/
```

### 6.3 Test from Frontend

1. Open your deployed frontend
2. Open browser DevTools → Network tab
3. Try to mint a gift card
4. Check that API calls go to your Vercel API URL

---

## Step 7: Sync Both Projects (Optional but Recommended)

### 7.1 Link Both Projects in Same Vercel Team

1. Ensure both projects are in the same Vercel team/account
2. This makes it easier to manage environment variables

### 7.2 Use Vercel Environment Variables Sharing

You can share environment variables between projects if needed.

---

## Troubleshooting

### Issue: API returns 404

**Solution:**
- Check that routes in `vercel.json` match your API structure
- Ensure files are in the `api/` folder
- Redeploy: `vercel --prod`

### Issue: Environment variables not working

**Solution:**
- Ensure variables are set for **Production** environment
- Redeploy after adding variables: `vercel --prod`
- Check variable names match exactly (case-sensitive)

### Issue: WASM binary not found

**Solution:**
- Ensure `CHARMS_APP_PATH` points to correct location
- Check that WASM file is included in deployment
- Verify file path in `charms-service.ts`

### Issue: CORS errors

**Solution:**
- CORS is already configured in the API endpoints
- Ensure frontend URL is allowed (or use `*` for development)

### Issue: Timeout errors

**Solution:**
- Increase `maxDuration` in `vercel.json` (up to 60s on Pro plan)
- Optimize API calls if possible

---

## API Endpoints

After deployment, your API will have these endpoints:

- `GET /` - API status
- `GET /health` - Health check
- `POST /api/gift-cards/mint` - Mint gift card
- `GET /api/utxo/:address` - Get UTXOs for address
- `POST /api/broadcast` - Broadcast transaction (handled by Charms Prover)

---

## Next Steps

1. ✅ API deployed to Vercel
2. ✅ Frontend connected to API
3. ✅ Environment variables configured
4. ✅ Test the full flow

## Monitoring

- Check Vercel Dashboard → **Deployments** for deployment status
- Check **Functions** tab for serverless function logs
- Use Vercel Analytics for API usage metrics

---

## Quick Reference Commands

```bash
# Deploy API
cd api
vercel --prod

# Add environment variable
vercel env add VARIABLE_NAME

# View environment variables
vercel env ls

# View deployment logs
vercel logs

# Redeploy frontend
cd ..
vercel --prod
```

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for frontend errors
3. Verify all environment variables are set
4. Ensure API URL is correct in frontend

