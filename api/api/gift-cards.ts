// Gift cards API endpoint for Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CharmsService } from '../src/services/charms-service';
import {
  validateUTXOExists,
  validateUTXOFormat,
  validateBitcoinAddress,
  validateBrand,
  validateImageUrl,
  validateInitialAmount,
  validateExpirationDate,
} from '../src/utils/utxo-validator';

// Initialize service (will be reused across invocations)
let charmsService: CharmsService | null = null;

function getCharmsService(): CharmsService {
  if (!charmsService) {
    charmsService = new CharmsService();
  }
  return charmsService;
}

const BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const IS_TESTNET = BITCOIN_NETWORK === 'testnet4' || BITCOIN_NETWORK === 'testnet';
const MIN_FEE_BUFFER_SATS = IS_TESTNET ? 500 : 5000;

// Handle all gift-cards routes
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '';
  const service = getCharmsService();
  
  // Route: POST /api/gift-cards/mint
  if (req.method === 'POST' && (path.endsWith('/mint') || path.includes('/mint'))) {
    try {
      const {
        inUtxo,
        recipientAddress,
        brand,
        image,
        initialAmount,
        expirationDate,
      } = req.body;

      // Validate required fields
      if (!inUtxo || !recipientAddress || !brand || !initialAmount) {
        return res.status(400).json({
          error: 'Missing required fields: inUtxo, recipientAddress, brand, initialAmount',
        });
      }

      // Validate recipient address format (must be Taproot for Charms)
      const addressValidation = validateBitcoinAddress(recipientAddress, BITCOIN_NETWORK);
      if (!addressValidation.valid) {
        return res.status(400).json({
          error: `Invalid recipient address: ${addressValidation.error}`,
        });
      }

      // Validate UTXO format
      const utxoValidation = validateUTXOFormat(inUtxo);
      if (!utxoValidation.valid) {
        return res.status(400).json({
          error: `Invalid UTXO format: ${utxoValidation.error}`,
        });
      }

      // Validate brand
      const brandValidation = validateBrand(brand);
      if (!brandValidation.valid) {
        return res.status(400).json({
          error: `Invalid brand: ${brandValidation.error}`,
        });
      }

      // Validate image URL
      if (image) {
        const imageValidation = validateImageUrl(image);
        if (!imageValidation.valid) {
          return res.status(400).json({
            error: `Invalid image URL: ${imageValidation.error}`,
          });
        }
      }

      // Validate initial amount
      const amountValidation = validateInitialAmount(initialAmount);
      if (!amountValidation.valid) {
        return res.status(400).json({
          error: `Invalid initial amount: ${amountValidation.error}`,
        });
      }

      // Validate expiration date if provided
      if (expirationDate) {
        const dateValidation = validateExpirationDate(expirationDate);
        if (!dateValidation.valid) {
          return res.status(400).json({
            error: `Invalid expiration date: ${dateValidation.error}`,
          });
        }
      }

      // Validate UTXO exists and has sufficient value
      const utxoExists = await validateUTXOExists(inUtxo);
      if (!utxoExists.exists) {
        return res.status(400).json({
          error: `UTXO not found: ${inUtxo}`,
        });
      }

      const utxoValue = utxoExists.value || 0;
      const requiredAmount = amountValidation.amount! + MIN_FEE_BUFFER_SATS;
      
      if (utxoValue < requiredAmount) {
        return res.status(400).json({
          error: `Insufficient UTXO value: ${utxoValue} sats. Required: ${requiredAmount} sats (${amountValidation.amount} + ${MIN_FEE_BUFFER_SATS} fee buffer)`,
        });
      }

      // Mint the gift card
      const result = await service.mintGiftCard({
        inUtxo,
        recipientAddress,
        brand,
        image: image || '',
        initialAmount: amountValidation.amount!,
        expirationDate: expirationDate || null,
      });

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Mint gift card error:', error);
      return res.status(500).json({
        error: 'Failed to mint gift card',
        message: error.message || 'Unknown error',
      });
    }
  }

  // Default: Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

