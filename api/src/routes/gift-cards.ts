import { Router, Request, Response } from 'express';
import { CharmsService } from '../services/charms-service';
import { validateUTXOExists, validateUTXOFormat, validateUTXOValue } from '../utils/utxo-validator';

const router = Router();
const charmsService = new CharmsService();

// Minimum fee buffer (in sats) - covers both commit and spell transactions
const MIN_FEE_BUFFER_SATS = 5000;

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

    // Check spell validity
    const isValid = await charmsService.checkSpell(spellYaml);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid spell' });
    }

    // Generate proof with app binary and optional mock mode
    const appBin = await charmsService.buildApp();
    const mockMode = process.env.MOCK_MODE === 'true';
    const proof = await charmsService.generateProof(spellYaml, appBin, undefined, mockMode);

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
    const proof = await charmsService.generateProof(spellYaml, appBin, undefined, mockMode);

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
    const proof = await charmsService.generateProof(spellYaml, appBin, undefined, mockMode);

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

