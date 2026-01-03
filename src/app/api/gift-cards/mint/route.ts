import { NextRequest, NextResponse } from 'next/server';

/**
 * Mint gift card endpoint
 * 
 * NOTE: This is a placeholder for Vercel deployment.
 * The full implementation requires the Express API services.
 * 
 * For production, either:
 * 1. Deploy the Express API separately and point NEXT_PUBLIC_API_URL to it
 * 2. Copy the service files into src/lib/api/ and update imports
 * 3. Use a monorepo structure that allows cross-directory imports
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    error: 'API endpoint not fully configured for serverless deployment',
    message: 'Please use the Express API server or configure the service imports',
    suggestion: 'Set NEXT_PUBLIC_API_URL to your Express API server URL',
  }, { status: 501 });
}

