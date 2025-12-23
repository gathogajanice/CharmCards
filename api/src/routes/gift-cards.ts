import { Router, Request, Response } from 'express';
import { CharmsService } from '../services/charms-service';

const router = Router();
const charmsService = new CharmsService();

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

