// Gift cards mint endpoint for Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { CharmsService } from '../../src/services/charms-service';
import {
  validateUTXOExists,
  validateUTXOFormat,
  validateUTXOValue,
  validateBitcoinAddress,
  validateBrand,
  validateImageUrl,
  validateInitialAmount,
  validateExpirationDate,
} from '../../src/utils/utxo-validator';

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

// Handle POST /api/gift-cards/mint
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // Validate and sanitize brand
    const brandValidation = validateBrand(brand);
    if (!brandValidation.valid) {
      return res.status(400).json({
        error: `Invalid brand: ${brandValidation.error}`,
      });
    }
    const sanitizedBrand = brandValidation.sanitized!;

    // Validate and sanitize image URL
    const imageValidation = validateImageUrl(image);
    if (!imageValidation.valid) {
      return res.status(400).json({
        error: `Invalid image URL: ${imageValidation.error}`,
      });
    }
    const sanitizedImage = imageValidation.sanitized || '';

    // Validate initial amount
    const amountValidation = validateInitialAmount(initialAmount);
    if (!amountValidation.valid) {
      return res.status(400).json({
        error: `Invalid initial amount: ${amountValidation.error}`,
      });
    }
    const validatedAmount = amountValidation.value!;

    // Validate expiration date
    const expirationValidation = validateExpirationDate(
      expirationDate,
      Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 // Default: 1 year
    );
    if (!expirationValidation.valid) {
      return res.status(400).json({
        error: `Invalid expiration date: ${expirationValidation.error}`,
      });
    }
    const validatedExpiration = expirationValidation.value!;

    // Validate UTXO exists and is spendable
    console.log(`⏳ Step 1/5: Validating UTXO ${inUtxo}...`);
    const utxoValidation = await validateUTXOExists(inUtxo);
    console.log(`✅ Step 1/5: UTXO validation complete`);
    if (!utxoValidation.valid || !utxoValidation.utxo) {
      return res.status(400).json({
        error: utxoValidation.error || 'UTXO validation failed',
      });
    }

    // Validate UTXO has sufficient value
    // Convert initialAmount (cents) to sats
    const giftCardAmountSats = IS_TESTNET 
      ? validatedAmount * 1  // Testnet: 1 cent = 1 sat
      : validatedAmount * 1000; // Mainnet: 1 cent = 1000 sats
    const requiredSats = giftCardAmountSats + MIN_FEE_BUFFER_SATS;
    
    if (utxoValidation.utxo.value < requiredSats) {
      const shortfall = requiredSats - utxoValidation.utxo.value;
      return res.status(400).json({
        error: `Insufficient UTXO value. Required: ${requiredSats} sats, Available: ${utxoValidation.utxo.value} sats, Shortfall: ${shortfall} sats`,
        utxoValue: utxoValidation.utxo.value,
        requiredValue: requiredSats,
        shortfall: shortfall,
      });
    }

    console.log(`⏳ Step 2/5: Creating spell YAML...`);
    const service = getCharmsService();
    const spellYaml = await service.createMintSpell({
      inUtxo,
      recipientAddress,
      brand: sanitizedBrand,
      image: sanitizedImage,
      initialAmount: validatedAmount,
      expirationDate: validatedExpiration,
    });

    console.log(`✅ Step 2/5: Spell YAML created`);
    
    // Try to validate spell (optional - Prover API will also validate)
    console.log(`⏳ Step 3/5: Validating spell structure...`);
    try {
      const isValid = await service.checkSpell(spellYaml);
      if (!isValid) {
        console.warn('⚠️ Spell validation failed, but proceeding anyway (Prover API will validate)');
      } else {
        console.log(`✅ Step 3/5: Spell validation passed`);
      }
    } catch (validationError: any) {
      console.warn('⚠️ Spell validation error (skipping):', validationError.message);
      console.warn('   Proceeding anyway - Prover API will validate the spell');
      console.log(`⏭️  Step 3/5: Skipped (will be validated by Prover API)`);
    }

    // Generate proof with app binary and optional mock mode
    console.log(`⏳ Step 4/5: Building app binary (if needed)...`);
    let appBin: string | undefined;
    try {
      appBin = await service.buildApp();
      console.log(`✅ Step 4/5: App binary built`);
    } catch (buildError: any) {
      const mockMode = process.env.MOCK_MODE === 'true';
      if (mockMode) {
        console.warn('⚠️ App build failed, but MOCK_MODE is enabled - proceeding without app_bins');
      } else {
        console.error('❌ App build failed:', buildError.message);
        throw new Error(`Failed to build app: ${buildError.message}. Set MOCK_MODE=true to skip building.`);
      }
    }
    const mockMode = process.env.MOCK_MODE === 'true';
    
    // Extract funding UTXO details from validation result
    const fundingUtxo = inUtxo; // Already in txid:vout format
    const fundingUtxoValue = utxoValidation.utxo?.value || 0;
    
    // Use recipient address as change address (remaining BTC goes back to recipient)
    const changeAddress = recipientAddress;
    
    // Default fee rate: 2.0 sats per vB (as per Charms docs)
    const feeRate = 2.0;
    
    // Fetch previous transaction hex for the input UTXO
    // Prover API requires prev_txs to contain the transaction that created the input UTXO
    let prevTxHex: string | undefined;
    try {
      const formatCheck = validateUTXOFormat(inUtxo);
      if (!formatCheck.valid || !formatCheck.txid) {
        throw new Error(`Invalid UTXO format: ${formatCheck.error}`);
      }
      
      const { txid } = formatCheck;
      const MEMEPOOL_BASE_URL = BITCOIN_NETWORK === 'testnet4'
        ? 'https://memepool.space/testnet4'
        : 'https://memepool.space';
      
      const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
      console.log(`⏳ Step 4.5/5: Fetching previous transaction hex from: ${txHexUrl}`);
      
      // Add retry logic for fetching previous transaction hex
      const maxRetries = 3;
      let lastError: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = 2000 * attempt; // 2s, 4s delays
            console.log(`   Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const txHexResponse = await axios.get(txHexUrl, { 
            timeout: 15000,
            headers: {
              'Accept': 'text/plain', // memepool.space returns hex as plain text
            }
          });
          
          // memepool.space returns hex as plain text (not JSON)
          prevTxHex = typeof txHexResponse.data === 'string' 
            ? txHexResponse.data.trim() 
            : String(txHexResponse.data).trim();
          
          if (prevTxHex && prevTxHex.length > 0) {
            // Validate it looks like hex
            if (!/^[0-9a-fA-F]+$/.test(prevTxHex)) {
              throw new Error(`Invalid hex format: ${prevTxHex.substring(0, 50)}...`);
            }
            console.log(`✅ Step 4.5/5: Fetched previous transaction hex: ${prevTxHex.length} chars`);
            break; // Success, exit retry loop
          } else {
            throw new Error('Empty transaction hex response');
          }
        } catch (fetchError: any) {
          lastError = fetchError;
          console.warn(`   Fetch attempt ${attempt + 1}/${maxRetries} failed: ${fetchError.message}`);
          
          // If it's a network error and not the last attempt, retry
          if (attempt < maxRetries - 1 && (fetchError.code === 'ECONNABORTED' || fetchError.code === 'ETIMEDOUT' || !fetchError.response)) {
            continue; // Retry
          }
          break;
        }
      }
      
      // Check if we successfully fetched the hex
      if (!prevTxHex || prevTxHex.length === 0) {
        throw lastError || new Error('Failed to fetch previous transaction hex after retries');
      }
    } catch (prevTxError: any) {
      console.error('❌ Failed to fetch previous transaction hex:', prevTxError.message);
      throw new Error(`Failed to fetch previous transaction hex for UTXO ${inUtxo}: ${prevTxError.message}. The Prover API requires prev_txs to contain the transaction that created each input UTXO.`);
    }
    
    // Ensure we have prevTxHex before proceeding
    if (!prevTxHex || prevTxHex.length === 0) {
      throw new Error(`No previous transaction hex available for UTXO ${inUtxo}. Cannot proceed without prev_txs.`);
    }
    
    // Generate proof
    console.log(`⏳ Step 5/5: Generating proof with Charms Prover API...`);
    const proof = await service.generateProof(
      spellYaml, 
      appBin, 
      prevTxHex, // Pass previous transaction hex
      mockMode,
      fundingUtxo,
      fundingUtxoValue,
      changeAddress,
      feeRate
    );
    console.log(`✅ Step 5/5: Proof generated successfully`);

    // Check if Prover API already broadcast (indicated by broadcasted flag and TXIDs)
    const isAlreadyBroadcasted = proof.broadcasted === true && proof.commit_txid && proof.spell_txid;
    
    return res.status(200).json({
      success: true,
      spell: spellYaml,
      proof,
      message: isAlreadyBroadcasted
        ? 'Gift card spell created and broadcasted successfully by Charms Prover API. Please sign transactions to complete minting.'
        : 'Gift card spell created successfully. Sign and broadcast to complete minting.',
    });
  } catch (error: any) {
    console.error('❌ Error minting gift card:', error);
    
    // Provide detailed error messages for common issues
    let errorMessage = error.message || 'Failed to mint gift card';
    let statusCode = 500;
    
    // Handle specific error types with improved messages
    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      statusCode = 504; // Gateway timeout
      errorMessage = `Operation timed out: ${error.message}. Proof generation may be taking longer than expected. Please try again.`;
    } else if (error.message?.includes('UTXO')) {
      statusCode = 400; // Bad request for UTXO issues
      errorMessage = `UTXO validation failed: ${error.message}`;
    } else if (error.message?.includes('Invalid') || error.message?.includes('Missing')) {
      statusCode = 400;
      errorMessage = `Validation error: ${error.message}`;
    } else if (error.message?.includes('Prover API') || error.message?.includes('proof generation')) {
      statusCode = 502; // Bad gateway for Prover API issues
      errorMessage = `Proof generation failed: ${error.message}. The Prover API may be experiencing issues. Please try again in a few moments.`;
    } else if (error.message?.includes('previous transaction hex')) {
      statusCode = 502; // Bad gateway - external API issue
      errorMessage = `Failed to fetch transaction data: ${error.message}. The memepool.space API may be slow or unavailable. Please try again.`;
    } else if (error.response?.status) {
      statusCode = error.response.status;
    }
    
    console.error(`   Status: ${statusCode}, Error: ${errorMessage}`);
    return res.status(statusCode).json({
      error: errorMessage,
      success: false,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

