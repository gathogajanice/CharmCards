import { Router, Request, Response } from 'express';
import axios from 'axios';
import { CharmsService } from '../services/charms-service';
import {
  validateUTXOExists,
  validateUTXOFormat,
  validateUTXOValue,
  validateBitcoinAddress,
  validateBrand,
  validateImageUrl,
  validateInitialAmount,
  validateExpirationDate,
} from '../utils/utxo-validator';

const router = Router();
const charmsService = new CharmsService();

// Network-aware fee buffer
// Testnet: Lower fees (500 sats buffer)
// Mainnet: Higher fees (5000 sats buffer) for safety
const BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const IS_TESTNET = BITCOIN_NETWORK === 'testnet4' || BITCOIN_NETWORK === 'testnet';
const MIN_FEE_BUFFER_SATS = IS_TESTNET ? 500 : 5000;

/**
 * POST /api/gift-cards/mint
 * Mint a new gift card (NFT + tokens)
 */
router.post('/mint', async (req: Request, res: Response) => {
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

    // Validate UTXO format
    const formatCheck = validateUTXOFormat(inUtxo);
    if (!formatCheck.valid) {
      return res.status(400).json({
        error: `Invalid UTXO format: ${formatCheck.error}`,
      });
    }

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
    // For testnet: Use 1 cent = 1 sat (affordable for testing, testnet coins have no real value)
    // For mainnet: Use 1 cent = 1000 sats (conservative rate to protect real value)
    // Note: The actual gift card value is stored in cents in the spell metadata, not sats
    // This conversion only affects how much Bitcoin you need to have in your wallet
    const giftCardAmountSats = IS_TESTNET 
      ? validatedAmount * 1  // Testnet: 1 cent = 1 sat (affordable testing)
      : validatedAmount * 1000; // Mainnet: 1 cent = 1000 sats (conservative)
    const requiredSats = giftCardAmountSats + MIN_FEE_BUFFER_SATS;
    
    const valueCheck = validateUTXOValue(utxoValidation.utxo.value, requiredSats);
    if (!valueCheck.sufficient) {
      return res.status(400).json({
        error: `Insufficient UTXO value. Required: ${requiredSats} sats, Available: ${utxoValidation.utxo.value} sats, Shortfall: ${valueCheck.shortfall} sats`,
        utxoValue: utxoValidation.utxo.value,
        requiredValue: requiredSats,
        shortfall: valueCheck.shortfall,
      });
    }

    console.log(`⏳ Step 2/5: Creating spell YAML...`);
    const spellYaml = await charmsService.createMintSpell({
      inUtxo,
      recipientAddress,
      brand: sanitizedBrand,
      image: sanitizedImage,
      initialAmount: validatedAmount,
      expirationDate: validatedExpiration,
    });

    console.log(`✅ Step 2/5: Spell YAML created`);
    
    // Try to validate spell (optional - Prover API will also validate)
    // If validation fails, we'll still try to generate proof (Prover API will catch real issues)
    console.log(`⏳ Step 3/5: Validating spell structure...`);
    try {
      const isValid = await charmsService.checkSpell(spellYaml);
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
    // Note: If build fails, we'll try without app_bins (Prover API may work in mock mode)
    console.log(`⏳ Step 4/5: Building app binary (if needed)...`);
    let appBin: string | undefined;
    try {
      appBin = await charmsService.buildApp();
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
    // The prev_txs array must have one entry per input UTXO in the spell
    let prevTxHex: string | undefined;
    try {
      const formatCheck = validateUTXOFormat(inUtxo);
      if (!formatCheck.valid || !formatCheck.txid) {
        throw new Error(`Invalid UTXO format: ${formatCheck.error}`);
      }
      
      const { txid } = formatCheck;
      const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
      const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
        ? 'https://memepool.space/testnet4'
        : 'https://memepool.space';
      
      const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
      console.log(`⏳ Step 4.5/5: Fetching previous transaction hex from: ${txHexUrl}`);
      
      // Add retry logic for fetching previous transaction hex (can fail due to network issues)
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
            console.log(`✅ Step 4.5/5: Fetched previous transaction hex: ${prevTxHex.length} chars, starts with ${prevTxHex.substring(0, 16)}...${attempt > 0 ? ` (on retry ${attempt})` : ''}`);
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
          
          // If it's the last attempt or a non-retryable error, break
          break;
        }
      }
      
      // Check if we successfully fetched the hex
      if (!prevTxHex || prevTxHex.length === 0) {
        throw lastError || new Error('Failed to fetch previous transaction hex after retries');
      }
    } catch (prevTxError: any) {
      console.error('❌ Failed to fetch previous transaction hex:', prevTxError.message);
      if (prevTxError.response) {
        console.error(`   HTTP ${prevTxError.response.status}: ${JSON.stringify(prevTxError.response.data)}`);
      }
      // This is required - throw error instead of continuing
      throw new Error(`Failed to fetch previous transaction hex for UTXO ${inUtxo}: ${prevTxError.message}. The Prover API requires prev_txs to contain the transaction that created each input UTXO.`);
    }
    
    // Ensure we have prevTxHex before proceeding
    if (!prevTxHex || prevTxHex.length === 0) {
      throw new Error(`No previous transaction hex available for UTXO ${inUtxo}. Cannot proceed without prev_txs.`);
    }
    
    const proof = await charmsService.generateProof(
      spellYaml, 
      appBin, 
      prevTxHex, // Pass previous transaction hex
      mockMode,
      fundingUtxo,
      fundingUtxoValue,
      changeAddress,
      feeRate
    );

    // Check if Prover API already broadcast (indicated by broadcasted flag and TXIDs)
    const isAlreadyBroadcasted = proof.broadcasted === true && proof.commit_txid && proof.spell_txid;
    
    res.json({
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
    res.status(statusCode).json({
      error: errorMessage,
      success: false,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * POST /api/gift-cards/redeem
 * Redeem (spend) part of gift card balance
 * Based on: gift-cards/spells/redeem-balance.yaml
 */
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    const { spell, fundingUtxo, fundingUtxoValue, changeAddress } = req.body;

    if (!spell) {
      return res.status(400).json({
        error: 'Missing required field: spell',
      });
    }

    // Validate spell structure
    if (!spell.version || !spell.apps || !spell.ins || !spell.outs) {
      return res.status(400).json({
        error: 'Invalid spell structure. Required: version, apps, ins, outs',
      });
    }

    // Validate that spell has at least one input
    if (!spell.ins || spell.ins.length === 0) {
      return res.status(400).json({
        error: 'Invalid spell: must have at least one input UTXO',
      });
    }

    // Extract NFT/token UTXO from spell (this is the UTXO being spent, not funding)
    const nftUtxo = spell.ins[0]?.utxo_id;
    if (!nftUtxo) {
      return res.status(400).json({
        error: 'Invalid spell: first input must have utxo_id',
      });
    }

    // Funding UTXO must be a separate plain Bitcoin output (not containing charms)
    // Per documentation: "funding_utxo: The UTXO to use for funding the transaction. Must be a plain Bitcoin output"
    if (!fundingUtxo) {
      return res.status(400).json({
        error: 'Missing required field: fundingUtxo. The funding UTXO must be a separate plain Bitcoin output (not the NFT/token UTXO).',
      });
    }

    // Validate funding UTXO format
    const fundingFormatCheck = validateUTXOFormat(fundingUtxo);
    if (!fundingFormatCheck.valid) {
      return res.status(400).json({
        error: `Invalid funding UTXO format: ${fundingFormatCheck.error}`,
      });
    }

    // Validate funding UTXO exists and is spendable
    const fundingUtxoValidation = await validateUTXOExists(fundingUtxo);
    if (!fundingUtxoValidation.valid || !fundingUtxoValidation.utxo) {
      return res.status(400).json({
        error: fundingUtxoValidation.error || 'Funding UTXO validation failed',
      });
    }

    // Use provided value if available, otherwise use validated value
    // Prefer frontend value as it's from the wallet and more accurate
    let finalFundingUtxoValue: number;
    if (fundingUtxoValue !== undefined && fundingUtxoValue !== null && typeof fundingUtxoValue === 'number') {
      // Validate provided value is reasonable (within 10% of looked-up value)
      const lookedUpValue = fundingUtxoValidation.utxo.value;
      const difference = Math.abs(fundingUtxoValue - lookedUpValue);
      const percentDiff = (difference / lookedUpValue) * 100;
      
      if (percentDiff > 10) {
        console.warn(`⚠️ Funding UTXO value mismatch: provided=${fundingUtxoValue}, looked-up=${lookedUpValue} (${percentDiff.toFixed(1)}% difference)`);
        // Use looked-up value if difference is too large (safety check)
        finalFundingUtxoValue = lookedUpValue;
      } else {
        console.log(`✅ Using provided funding UTXO value: ${fundingUtxoValue} sats (looked-up: ${lookedUpValue} sats)`);
        finalFundingUtxoValue = fundingUtxoValue;
      }
    } else {
      // Fallback to looked-up value if not provided
      console.log(`ℹ️ Using looked-up funding UTXO value: ${fundingUtxoValidation.utxo.value} sats`);
      finalFundingUtxoValue = fundingUtxoValidation.utxo.value;
    }

    // Validate funding UTXO has sufficient value for fees
    const requiredSats = MIN_FEE_BUFFER_SATS;
    const valueCheck = validateUTXOValue(finalFundingUtxoValue, requiredSats);
    if (!valueCheck.sufficient) {
      return res.status(400).json({
        error: `Insufficient funding UTXO value. Required: ${requiredSats} sats, Available: ${finalFundingUtxoValue} sats, Shortfall: ${valueCheck.shortfall} sats`,
        utxoValue: finalFundingUtxoValue,
        requiredValue: requiredSats,
        shortfall: valueCheck.shortfall,
      });
    }

    // Validate change address
    if (!changeAddress) {
      return res.status(400).json({
        error: 'Missing required field: changeAddress. The change address is where remaining BTC from the funding UTXO will be sent after fees.',
      });
    }

    // Validate change address format
    const addressValidation = validateBitcoinAddress(changeAddress, BITCOIN_NETWORK);
    if (!addressValidation.valid) {
      return res.status(400).json({
        error: `Invalid change address: ${addressValidation.error}`,
      });
    }

    // Validate NFT/token UTXO format (for prev_txs)
    const nftFormatCheck = validateUTXOFormat(nftUtxo);
    if (!nftFormatCheck.valid) {
      return res.status(400).json({
        error: `Invalid NFT/token UTXO format in spell: ${nftFormatCheck.error}`,
      });
    }

    // Validate NFT/token UTXO exists (for prev_txs)
    const nftUtxoValidation = await validateUTXOExists(nftUtxo);
    if (!nftUtxoValidation.valid || !nftUtxoValidation.utxo) {
      return res.status(400).json({
        error: nftUtxoValidation.error || 'NFT/token UTXO validation failed',
      });
    }

    // Fetch previous transaction hex for the NFT/token UTXO (for prev_txs)
    // Prover API requires prev_txs to contain the transaction that created each input UTXO in the spell
    let prevTxHex: string | undefined;
    try {
      const { txid } = nftFormatCheck;
      const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
      const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
        ? 'https://memepool.space/testnet4'
        : 'https://memepool.space';
      
      const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
      console.log(`📥 Fetching previous transaction hex for redeem: ${txHexUrl}`);
      
      const txHexResponse = await axios.get(txHexUrl, { 
        timeout: 15000,
        headers: {
          'Accept': 'text/plain',
        }
      });
      
      prevTxHex = typeof txHexResponse.data === 'string' 
        ? txHexResponse.data.trim() 
        : String(txHexResponse.data).trim();
      
      if (prevTxHex && prevTxHex.length > 0) {
        if (!/^[0-9a-fA-F]+$/.test(prevTxHex)) {
          throw new Error(`Invalid hex format: ${prevTxHex.substring(0, 50)}...`);
        }
        console.log(`✅ Fetched previous transaction hex for redeem: ${prevTxHex.length} chars`);
      } else {
        throw new Error('Empty transaction hex response');
      }
    } catch (prevTxError: any) {
      console.error('❌ Failed to fetch previous transaction hex for redeem:', prevTxError.message);
      throw new Error(`Failed to fetch previous transaction hex for UTXO ${fundingUtxo}: ${prevTxError.message}. The Prover API requires prev_txs to contain the transaction that created each input UTXO.`);
    }

    // Ensure we have prevTxHex before proceeding
    if (!prevTxHex || prevTxHex.length === 0) {
      throw new Error(`No previous transaction hex available for UTXO ${fundingUtxo}. Cannot proceed without prev_txs.`);
    }

    // Fix app_vk in spell to always use the actual WASM VK
    // The frontend may send tokenId or an outdated VK, but app_vk must match the actual WASM binary VK
    const actualAppVk = await charmsService.getAppVk();
    if (spell.apps && typeof spell.apps === 'object') {
      let appVkFixed = false;
      Object.entries(spell.apps).forEach(([key, appIdValue]: [string, any]) => {
        const appIdStr = String(appIdValue);
        const parts = appIdStr.split('/');
        if (parts.length >= 3) {
          const appId = parts[1];
          const appVk = parts[2];
          // Always replace VK with actual WASM VK to ensure it matches the binary
          if (appVk !== actualAppVk) {
            spell.apps[key] = `${parts[0]}/${appId}/${actualAppVk}`;
            appVkFixed = true;
            console.log(`✅ Fixed app_vk for ${key}: replaced ${appVk.substring(0, 16)}... with ${actualAppVk.substring(0, 16)}...`);
          }
        }
      });
      
      if (appVkFixed) {
        console.log('✅ Corrected app_vk in spell to match actual WASM binary VK');
      }
    }

    // Convert spell object to YAML for validation
    const yaml = require('js-yaml');
    const spellYaml = yaml.dump(spell);

    // Check spell validity (optional - Prover API will also validate)
    try {
      const isValid = await charmsService.checkSpell(spellYaml, prevTxHex);
      if (!isValid) {
        console.warn('⚠️ Spell validation failed, but proceeding anyway (Prover API will validate)');
      }
    } catch (validationError: any) {
      console.warn('⚠️ Spell validation error (skipping):', validationError.message);
      console.warn('   Proceeding anyway - Prover API will validate the spell');
    }

    // Generate proof with app binary
    // IMPORTANT: Redeem operations ALWAYS require the binary - no mock mode allowed
    // Redeem must execute app logic to validate redemption rules and update state
    let appBin: string | undefined;
    try {
      appBin = await charmsService.buildApp();
      console.log(`✅ App binary built for redeem operation: ${appBin}`);
      
      // Get and log the actual WASM VK being used
      const wasmVk = await charmsService.getAppVk();
      console.log(`🔑 WASM VK being used: ${wasmVk.substring(0, 16)}... (full: ${wasmVk})`);
      console.log(`🔑 Spell app_vk values:`, Object.values(spell.apps || {}).map((v: any) => {
        const parts = String(v).split('/');
        return parts.length >= 3 ? parts[2].substring(0, 16) + '...' : 'invalid';
      }));
    } catch (buildError: any) {
      // Redeem ALWAYS requires binary - no mock mode allowed
      console.error('❌ App build failed for redeem:', buildError.message);
      throw new Error(
        `Redeem operation requires app binary. Failed to build: ${buildError.message}. ` +
        `Redeem cannot work in mock mode - it needs to execute app logic to update state. ` +
        `Please ensure the gift-cards app builds successfully. Run: cd gift-cards && cargo build --release --target wasm32-wasip1`
      );
    }
    
    // Ensure we have binary before proceeding
    if (!appBin) {
      throw new Error(
        'App binary is required for redeem operations but was not built. ' +
        'Redeem must execute app logic to validate and update state. ' +
        'Please ensure the gift-cards app builds successfully.'
      );
    }
    
    // Redeem always requires binary - do not use mock mode
    const mockMode = false;
    
    // Use final funding UTXO value (from frontend if provided, otherwise looked-up)
    const feeRate = 2.0;
    
    console.log('🚀 Calling generateProof with:');
    console.log('   Spell YAML length:', spellYaml.length);
    console.log('   App binary path:', appBin);
    console.log('   Mock mode:', mockMode);
    console.log('   Funding UTXO:', fundingUtxo);
    console.log('   Funding UTXO value:', finalFundingUtxoValue);
    
    const proof = await charmsService.generateProof(
      spellYaml, 
      appBin, 
      prevTxHex, // Pass previous transaction hex
      mockMode,
      fundingUtxo,
      finalFundingUtxoValue, // Use final value (prefers frontend value)
      changeAddress,
      feeRate
    );

    res.json({
      success: true,
      spell: spellYaml,
      proof,
      message: 'Redemption spell created successfully. Sign and broadcast to complete redemption.',
    });
  } catch (error: any) {
    console.error('Error redeeming gift card:', error);
    
    // Provide detailed error messages for common issues
    let errorMessage = error.message || 'Failed to redeem gift card';
    let statusCode = 500;
    
    // Handle specific error types
    if (error.message?.includes('UTXO') || error.message?.includes('Invalid spell') || error.message?.includes('Missing')) {
      statusCode = 400; // Bad request for validation issues
    } else if (error.message?.includes('timed out') || error.message?.includes('timeout') || error.message?.includes('Connection to Prover API timed out')) {
      // Timeout errors - provide helpful retry guidance
      statusCode = 504; // Gateway Timeout
      if (error.message?.includes('Connection to Prover API timed out')) {
        errorMessage = 'Connection to Prover API timed out. This may be due to network issues or the Prover API being unavailable. ' +
          'Please check your internet connection and try again. The system has already retried the request automatically.';
      } else if (error.message?.includes('request timed out')) {
        errorMessage = 'Prover API request timed out. The proof generation is taking longer than expected. ' +
          'The system has already retried the request automatically. Please try again in a few moments.';
      } else {
        errorMessage = 'Request timed out. The system has already retried the request automatically. Please try again.';
      }
    } else if (error.message?.includes('Unable to connect to Prover API') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      // Network connectivity errors
      statusCode = 502; // Bad Gateway
      errorMessage = 'Unable to connect to Prover API. This may indicate network issues or the Prover API being down. ' +
        'Please check your internet connection and try again.';
    } else if (error.message?.includes('Prover API')) {
      statusCode = 502; // Bad gateway for Prover API issues
      // Enhance Prover API error messages for binary-related issues
      if (error.message?.includes('app binary not found') || error.message?.includes('binary')) {
        errorMessage = `${errorMessage}. Redeem operations require the app binary to execute logic. ` +
          `Please ensure the gift-cards app is built: cd gift-cards && cargo build --release --target wasm32-wasip1`;
      }
    } else if (error.message?.includes('binary') || error.message?.includes('build')) {
      statusCode = 500;
      errorMessage = `${errorMessage}. Redeem operations require the app binary to execute app logic and update state. ` +
        `This is different from minting which can work in mock mode. ` +
        `Please ensure the gift-cards app builds successfully.`;
    } else if (error.response?.status) {
      statusCode = error.response.status;
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      success: false,
    });
  }
});

/**
 * POST /api/gift-cards/transfer
 * Transfer a gift card NFT to another address
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/nft/
 */
router.post('/transfer', async (req: Request, res: Response) => {
  try {
    const { spell, fundingUtxo, fundingUtxoValue, changeAddress } = req.body;

    if (!spell) {
      return res.status(400).json({
        error: 'Missing required field: spell',
      });
    }

    // Validate spell structure
    if (!spell.version || !spell.apps || !spell.ins || !spell.outs) {
      return res.status(400).json({
        error: 'Invalid spell structure. Required: version, apps, ins, outs',
      });
    }

    // Validate that spell has at least one input
    if (!spell.ins || spell.ins.length === 0) {
      return res.status(400).json({
        error: 'Invalid spell: must have at least one input UTXO',
      });
    }

    // Extract NFT/token UTXO from spell (this is the UTXO being transferred, not funding)
    const nftUtxo = spell.ins[0]?.utxo_id;
    if (!nftUtxo) {
      return res.status(400).json({
        error: 'Invalid spell: first input must have utxo_id',
      });
    }

    // Funding UTXO must be a separate plain Bitcoin output (not containing charms)
    // Per documentation: "funding_utxo: The UTXO to use for funding the transaction. Must be a plain Bitcoin output"
    if (!fundingUtxo) {
      return res.status(400).json({
        error: 'Missing required field: fundingUtxo. The funding UTXO must be a separate plain Bitcoin output (not the NFT/token UTXO).',
      });
    }

    // Validate funding UTXO format
    const fundingFormatCheck = validateUTXOFormat(fundingUtxo);
    if (!fundingFormatCheck.valid) {
      return res.status(400).json({
        error: `Invalid funding UTXO format: ${fundingFormatCheck.error}`,
      });
    }

    // Validate funding UTXO exists and is spendable
    const fundingUtxoValidation = await validateUTXOExists(fundingUtxo);
    if (!fundingUtxoValidation.valid || !fundingUtxoValidation.utxo) {
      return res.status(400).json({
        error: fundingUtxoValidation.error || 'Funding UTXO validation failed',
      });
    }

    // Use provided value if available, otherwise use validated value
    // Prefer frontend value as it's from the wallet and more accurate
    let finalFundingUtxoValue: number;
    if (fundingUtxoValue !== undefined && fundingUtxoValue !== null && typeof fundingUtxoValue === 'number') {
      // Validate provided value is reasonable (within 10% of looked-up value)
      const lookedUpValue = fundingUtxoValidation.utxo.value;
      const difference = Math.abs(fundingUtxoValue - lookedUpValue);
      const percentDiff = (difference / lookedUpValue) * 100;
      
      if (percentDiff > 10) {
        console.warn(`⚠️ Funding UTXO value mismatch: provided=${fundingUtxoValue}, looked-up=${lookedUpValue} (${percentDiff.toFixed(1)}% difference)`);
        // Use looked-up value if difference is too large (safety check)
        finalFundingUtxoValue = lookedUpValue;
      } else {
        console.log(`✅ Using provided funding UTXO value: ${fundingUtxoValue} sats (looked-up: ${lookedUpValue} sats)`);
        finalFundingUtxoValue = fundingUtxoValue;
      }
    } else {
      // Fallback to looked-up value if not provided
      console.log(`ℹ️ Using looked-up funding UTXO value: ${fundingUtxoValidation.utxo.value} sats`);
      finalFundingUtxoValue = fundingUtxoValidation.utxo.value;
    }

    // Validate funding UTXO has sufficient value for fees
    const requiredSats = MIN_FEE_BUFFER_SATS;
    const valueCheck = validateUTXOValue(finalFundingUtxoValue, requiredSats);
    if (!valueCheck.sufficient) {
      return res.status(400).json({
        error: `Insufficient funding UTXO value. Required: ${requiredSats} sats, Available: ${finalFundingUtxoValue} sats, Shortfall: ${valueCheck.shortfall} sats`,
        utxoValue: finalFundingUtxoValue,
        requiredValue: requiredSats,
        shortfall: valueCheck.shortfall,
      });
    }

    // Validate change address
    if (!changeAddress) {
      return res.status(400).json({
        error: 'Missing required field: changeAddress. The change address is where remaining BTC from the funding UTXO will be sent after fees.',
      });
    }

    // Validate change address format
    const addressValidation = validateBitcoinAddress(changeAddress, BITCOIN_NETWORK);
    if (!addressValidation.valid) {
      return res.status(400).json({
        error: `Invalid change address: ${addressValidation.error}`,
      });
    }

    // Validate NFT/token UTXO format (for prev_txs)
    const nftFormatCheck = validateUTXOFormat(nftUtxo);
    if (!nftFormatCheck.valid) {
      return res.status(400).json({
        error: `Invalid NFT/token UTXO format in spell: ${nftFormatCheck.error}`,
      });
    }

    // Validate NFT/token UTXO exists (for prev_txs)
    const nftUtxoValidation = await validateUTXOExists(nftUtxo);
    if (!nftUtxoValidation.valid || !nftUtxoValidation.utxo) {
      return res.status(400).json({
        error: nftUtxoValidation.error || 'NFT/token UTXO validation failed',
      });
    }

    // Fetch previous transaction hex for the NFT/token UTXO (for prev_txs)
    // Prover API requires prev_txs to contain the transaction that created each input UTXO in the spell
    let prevTxHex: string | undefined;
    try {
      const { txid } = nftFormatCheck;
      const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
      const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
        ? 'https://memepool.space/testnet4'
        : 'https://memepool.space';
      
      const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
      console.log(`📥 Fetching previous transaction hex for NFT/token UTXO: ${txHexUrl}`);
      
      const txHexResponse = await axios.get(txHexUrl, { 
        timeout: 15000,
        headers: {
          'Accept': 'text/plain',
        }
      });
      
      prevTxHex = typeof txHexResponse.data === 'string' 
        ? txHexResponse.data.trim() 
        : String(txHexResponse.data).trim();
      
      if (prevTxHex && prevTxHex.length > 0) {
        if (!/^[0-9a-fA-F]+$/.test(prevTxHex)) {
          throw new Error(`Invalid hex format: ${prevTxHex.substring(0, 50)}...`);
        }
        console.log(`✅ Fetched previous transaction hex for transfer: ${prevTxHex.length} chars`);
      } else {
        throw new Error('Empty transaction hex response');
      }
    } catch (prevTxError: any) {
      console.error('❌ Failed to fetch previous transaction hex for transfer:', prevTxError.message);
      throw new Error(`Failed to fetch previous transaction hex for NFT/token UTXO ${nftUtxo}: ${prevTxError.message}. The Prover API requires prev_txs to contain the transaction that created each input UTXO.`);
    }

    // Ensure we have prevTxHex before proceeding
    if (!prevTxHex || prevTxHex.length === 0) {
      throw new Error(`No previous transaction hex available for NFT/token UTXO ${nftUtxo}. Cannot proceed without prev_txs.`);
    }

    // Fix app_vk in spell to always use the actual WASM VK
    // The frontend may send tokenId or an outdated VK, but app_vk must match the actual WASM binary VK
    const actualAppVk = await charmsService.getAppVk();
    if (spell.apps && typeof spell.apps === 'object') {
      let appVkFixed = false;
      Object.entries(spell.apps).forEach(([key, appIdValue]: [string, any]) => {
        const appIdStr = String(appIdValue);
        const parts = appIdStr.split('/');
        if (parts.length >= 3) {
          const appId = parts[1];
          const appVk = parts[2];
          // Always replace VK with actual WASM VK to ensure it matches the binary
          if (appVk !== actualAppVk) {
            spell.apps[key] = `${parts[0]}/${appId}/${actualAppVk}`;
            appVkFixed = true;
            console.log(`✅ Fixed app_vk for ${key}: replaced ${appVk.substring(0, 16)}... with ${actualAppVk.substring(0, 16)}...`);
          }
        }
      });
      
      if (appVkFixed) {
        console.log('✅ Corrected app_vk in spell to match actual WASM binary VK');
      }
    }

    // Convert spell object to YAML for validation
    const yaml = require('js-yaml');
    const spellYaml = yaml.dump(spell);

    // Check spell validity (optional - Prover API will also validate)
    try {
      const isValid = await charmsService.checkSpell(spellYaml, prevTxHex);
      if (!isValid) {
        console.warn('⚠️ Spell validation failed, but proceeding anyway (Prover API will validate)');
      }
    } catch (validationError: any) {
      console.warn('⚠️ Spell validation error (skipping):', validationError.message);
      console.warn('   Proceeding anyway - Prover API will validate the spell');
    }

    // Generate proof WITHOUT app binary
    // IMPORTANT: NFT transfers are simple moves - no app logic executes
    // Per documentation: "binaries: empty for basic transfers"
    // Transfer does NOT need WASM - just move NFT from one UTXO to another
    const appBin: string | undefined = undefined; // No binary needed for transfer
    const mockMode = true; // Use empty binaries object {}
    
    console.log(`ℹ️ Transfer operation: Using empty binaries {} (no app logic execution needed)`);
    
    // Use final funding UTXO value (from frontend if provided, otherwise looked-up)
    const feeRate = 2.0;
    
    const proof = await charmsService.generateProof(
      spellYaml, 
      appBin, 
      prevTxHex, // Pass previous transaction hex
      mockMode,
      fundingUtxo,
      finalFundingUtxoValue, // Use final value (prefers frontend value)
      changeAddress,
      feeRate
    );

    res.json({
      success: true,
      spell: spellYaml,
      proof,
      message: 'Transfer spell created successfully. Sign and broadcast to complete transfer.',
    });
  } catch (error: any) {
    console.error('Error transferring gift card:', error);
    
    // Provide detailed error messages for common issues
    let errorMessage = error.message || 'Failed to transfer gift card';
    let statusCode = 500;
    
    // Handle specific error types
    if (error.message?.includes('UTXO') || error.message?.includes('Invalid spell') || error.message?.includes('Missing')) {
      statusCode = 400; // Bad request for validation issues
    } else if (error.message?.includes('Prover API')) {
      statusCode = 502; // Bad gateway for Prover API issues
      // Transfer uses empty binaries {} - binary errors shouldn't occur
      // But if they do, provide helpful context
      if (error.message?.includes('app binary not found') || error.message?.includes('binary')) {
        errorMessage = `${errorMessage}. Note: Transfer operations use empty binaries {} and should not require app binary. ` +
          `If this error persists, check spell structure and funding UTXO.`;
      }
    } else if (error.response?.status) {
      statusCode = error.response.status;
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      success: false,
    });
  }
});

/**
 * GET /api/gift-cards/:tokenId
 * Get gift card details by token ID
 */
router.get('/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    // TODO: Implement fetching gift card details from blockchain/indexer
    res.json({
      tokenId,
      message: 'Gift card details endpoint - to be implemented with indexer',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get gift card' });
  }
});

export default router;

