# Vercel Deployment Guide for CharmCards

This project has been configured for deployment to Vercel as "charmcards" with minimal changes.

## Changes Made

1. **Package name updated**: Changed from "charm-cards" to "charmcards"
2. **Vercel configuration**: Updated `vercel.json` with project name
3. **API routes**: Created Next.js API routes in `src/app/api/` that reuse existing service logic
4. **API URL configuration**: Updated to use relative paths (`/api`) for Vercel compatibility

## Environment Variables for Vercel

Set these environment variables in your Vercel project settings:

### Required Variables:
- `NEXT_PUBLIC_API_URL` - Set to `/api` (or leave empty to use relative paths)
- `NEXT_PUBLIC_BITCOIN_NETWORK` - Set to `testnet4` (or `mainnet` for production)
- `NEXT_PUBLIC_CHARMS_EXPLORER_URL` - Set to `https://memepool.space/testnet4` (or mainnet URL)
- `NEXT_PUBLIC_PROVER_API_URL` - Set to `https://v8.charms.dev/spells/prove`

### API Server Variables (for serverless functions):
- `CHARMS_APP_PATH` - Path to gift-cards directory (relative to project root)
- `CHARMS_APP_VK` - Your app verification key (get from `charms app vk`)
- `BITCOIN_NETWORK` - Set to `testnet4` (or `mainnet`)
- `PROVER_API_URL` - Set to `https://v8.charms.dev/spells/prove`

## Deployment Steps

1. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Set the project name to "charmcards"

2. **Configure Root Directory**:
   - In Vercel project settings, set Root Directory to `Charms Frontend`

3. **Set Environment Variables**:
   - Add all required environment variables listed above
   - Make sure `NEXT_PUBLIC_API_URL` is set to `/api` for Vercel

4. **Deploy**:
   - Push to your main branch or trigger a manual deployment
   - Vercel will automatically build and deploy

## API Routes Status

The following API routes have been created as Next.js serverless functions:
- ✅ `/api/health` - Health check endpoint
- ✅ `/api/gift-cards/mint` - Mint gift card endpoint

**Note**: Additional routes (redeem, transfer, utxo) need to be created. You can:
1. Use the existing Express API server separately (not on Vercel)
2. Create additional Next.js API routes following the same pattern as `/api/gift-cards/mint`

## Local Development

For local development, the project still works with the Express API server:
1. Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env.local`
2. Run the API server: `cd api && npm run dev`
3. Run the frontend: `npm run dev`

## Important Notes

- The Rust/Charms app (`gift-cards/`) needs to be built before deployment
- The WASM binary should be included in the deployment or built during the build process
- For production, ensure all environment variables are properly set
- The API routes reuse existing service logic, so functionality remains the same

## Troubleshooting

- If API calls fail, check that `NEXT_PUBLIC_API_URL` is set correctly
- Ensure all environment variables are set in Vercel
- Check Vercel function logs for any errors
- Verify the root directory is set to `Charms Frontend` in Vercel settings

