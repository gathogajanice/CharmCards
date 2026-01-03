import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'charm-cards-api',
    version: '1.0.0',
    network: process.env.BITCOIN_NETWORK || 'testnet4',
  });
}

