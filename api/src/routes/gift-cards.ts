import { Router, Request, Response } from 'express';
import axios from 'axios';
import { CharmsService } from '../services/charms-service';
import { validateUTXOExists, validateUTXOFormat, validateUTXOValue } from '../utils/utxo-validator';

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

    // Validate UTXO format
    const formatCheck = validateUTXOFormat(inUtxo);
    if (!formatCheck.valid) {
      return res.status(400).json({
        error: `Invalid UTXO format: ${formatCheck.error}`,
      });
    }

    // Validate UTXO exists and is spendable
    const utxoValidation = await validateUTXOExists(inUtxo);
    if (!utxoValidation.valid || !utxoValidation.utxo) {
      return res.status(400).json({
        error: utxoValidation.error || 'UTXO validation failed',
      });
    }

    // Validate UTXO has sufficient value
    // Convert initialAmount (cents) to sats: 1 cent = 1000 sats (conservative for testnet)
    const giftCardAmountSats = parseInt(initialAmount) * 1000;
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

    const spellYaml = await charmsService.createMintSpell({
      inUtxo,
      recipientAddress,
      brand,
      image: image || '',
      initialAmount: parseInt(initialAmount),
      expirationDate: expirationDate || Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year default
    });

    // Try to validate spell (optional - Prover API will also validate)
    // If validation fails, we'll still try to generate proof (Prover API will catch real issues)
    try {
      const isValid = await charmsService.checkSpell(spellYaml);
      if (!isValid) {
        console.warn('⚠️ Spell validation failed, but proceeding anyway (Prover API will validate)');
      }
    } catch (validationError: any) {
      console.warn('⚠️ Spell validation error (skipping):', validationError.message);
      console.warn('   Proceeding anyway - Prover API will validate the spell');
    }

    // Generate proof with app binary and optional mock mode
    // Note: If build fails, we'll try without app_bins (Prover API may work in mock mode)
    let appBin: string | undefined;
    try {
      appBin = await charmsService.buildApp();
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
      console.log(`📥 Fetching previous transaction hex from: ${txHexUrl}`);
      
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
        console.log(`✅ Fetched previous transaction hex: ${prevTxHex.length} chars, starts with ${prevTxHex.substring(0, 16)}...`);
      } else {
        throw new Error('Empty transaction hex response');
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

    res.json({
      success: true,
      spell: spellYaml,
      proof,
      message: 'Gift card spell created successfully. Sign and broadcast to complete minting.',
    });
  } catch (error: any) {
    console.error('Error minting gift card:', error);
    res.status(500).json({ error: error.message || 'Failed to mint gift card' });
  }
});

/**
 * POST /api/gift-cards/redeem
 * Redeem (spend) part of gift card balance
 * Based on: gift-cards/spells/redeem-balance.yaml
 */
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    const { spell } = req.body;

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

    // Convert spell object to YAML for validation
    const yaml = require('js-yaml');
    const spellYaml = yaml.dump(spell);

    // Check spell validity
    const isValid = await charmsService.checkSpell(spellYaml);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid redemption spell' });
    }

    // Generate proof with app binary
    const appBin = await charmsService.buildApp();
    const mockMode = process.env.MOCK_MODE === 'true';
    
    // Extract funding info from spell (first input UTXO)
    // For redeem/transfer, the funding UTXO should be in spell.ins[0]
    const fundingUtxo = spell.ins?.[0]?.utxo_id;
    const fundingUtxoValue = undefined; // Will need to be provided or fetched
    const changeAddress = spell.outs?.[0]?.address; // Use first output as change address
    const feeRate = 2.0;
    
    const proof = await charmsService.generateProof(
      spellYaml, 
      appBin, 
      undefined, 
      mockMode,
      fundingUtxo,
      fundingUtxoValue,
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
    res.status(500).json({ error: error.message || 'Failed to redeem gift card' });
  }
});

/**
 * POST /api/gift-cards/transfer
 * Transfer a gift card NFT to another address
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/nft/
 */
router.post('/transfer', async (req: Request, res: Response) => {
  try {
    const { spell } = req.body;

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

    // Convert spell object to YAML for validation
    const yaml = require('js-yaml');
    const spellYaml = yaml.dump(spell);

    // Check spell validity
    const isValid = await charmsService.checkSpell(spellYaml);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid transfer spell' });
    }

    // Generate proof with app binary
    const appBin = await charmsService.buildApp();
    const mockMode = process.env.MOCK_MODE === 'true';
    
    // Extract funding info from spell (first input UTXO)
    // For transfer, the funding UTXO should be in spell.ins[0]
    const fundingUtxo = spell.ins?.[0]?.utxo_id;
    const fundingUtxoValue = undefined; // Will need to be provided or fetched
    const changeAddress = spell.outs?.[0]?.address; // Use first output as change address
    const feeRate = 2.0;
    
    const proof = await charmsService.generateProof(
      spellYaml, 
      appBin, 
      undefined, 
      mockMode,
      fundingUtxo,
      fundingUtxoValue,
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
    res.status(500).json({ error: error.message || 'Failed to transfer gift card' });
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

