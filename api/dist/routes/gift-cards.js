"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const charms_service_1 = require("../services/charms-service");
const utxo_validator_1 = require("../utils/utxo-validator");
const router = (0, express_1.Router)();
const charmsService = new charms_service_1.CharmsService();
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
router.post('/mint', async (req, res) => {
    try {
        const { inUtxo, recipientAddress, brand, image, initialAmount, expirationDate, } = req.body;
        // Validate required fields
        if (!inUtxo || !recipientAddress || !brand || !initialAmount) {
            return res.status(400).json({
                error: 'Missing required fields: inUtxo, recipientAddress, brand, initialAmount',
            });
        }
        // Validate recipient address format (must be Taproot for Charms)
        const addressValidation = (0, utxo_validator_1.validateBitcoinAddress)(recipientAddress, BITCOIN_NETWORK);
        if (!addressValidation.valid) {
            return res.status(400).json({
                error: `Invalid recipient address: ${addressValidation.error}`,
            });
        }
        // Validate and sanitize brand
        const brandValidation = (0, utxo_validator_1.validateBrand)(brand);
        if (!brandValidation.valid) {
            return res.status(400).json({
                error: `Invalid brand: ${brandValidation.error}`,
            });
        }
        const sanitizedBrand = brandValidation.sanitized;
        // Validate and sanitize image URL
        const imageValidation = (0, utxo_validator_1.validateImageUrl)(image);
        if (!imageValidation.valid) {
            return res.status(400).json({
                error: `Invalid image URL: ${imageValidation.error}`,
            });
        }
        const sanitizedImage = imageValidation.sanitized || '';
        // Validate initial amount
        const amountValidation = (0, utxo_validator_1.validateInitialAmount)(initialAmount);
        if (!amountValidation.valid) {
            return res.status(400).json({
                error: `Invalid initial amount: ${amountValidation.error}`,
            });
        }
        const validatedAmount = amountValidation.value;
        // Validate expiration date
        const expirationValidation = (0, utxo_validator_1.validateExpirationDate)(expirationDate, Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 // Default: 1 year
        );
        if (!expirationValidation.valid) {
            return res.status(400).json({
                error: `Invalid expiration date: ${expirationValidation.error}`,
            });
        }
        const validatedExpiration = expirationValidation.value;
        // Validate UTXO format
        const formatCheck = (0, utxo_validator_1.validateUTXOFormat)(inUtxo);
        if (!formatCheck.valid) {
            return res.status(400).json({
                error: `Invalid UTXO format: ${formatCheck.error}`,
            });
        }
        // Validate UTXO exists and is spendable
        console.log(`⏳ Step 1/5: Validating UTXO ${inUtxo}...`);
        const utxoValidation = await (0, utxo_validator_1.validateUTXOExists)(inUtxo);
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
            ? validatedAmount * 1 // Testnet: 1 cent = 1 sat (affordable testing)
            : validatedAmount * 1000; // Mainnet: 1 cent = 1000 sats (conservative)
        const requiredSats = giftCardAmountSats + MIN_FEE_BUFFER_SATS;
        const valueCheck = (0, utxo_validator_1.validateUTXOValue)(utxoValidation.utxo.value, requiredSats);
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
            }
            else {
                console.log(`✅ Step 3/5: Spell validation passed`);
            }
        }
        catch (validationError) {
            console.warn('⚠️ Spell validation error (skipping):', validationError.message);
            console.warn('   Proceeding anyway - Prover API will validate the spell');
            console.log(`⏭️  Step 3/5: Skipped (will be validated by Prover API)`);
        }
        // Generate proof with app binary and optional mock mode
        // Note: If build fails, we'll try without app_bins (Prover API may work in mock mode)
        console.log(`⏳ Step 4/5: Building app binary (if needed)...`);
        let appBin;
        try {
            appBin = await charmsService.buildApp();
            console.log(`✅ Step 4/5: App binary built`);
        }
        catch (buildError) {
            const mockMode = process.env.MOCK_MODE === 'true';
            if (mockMode) {
                console.warn('⚠️ App build failed, but MOCK_MODE is enabled - proceeding without app_bins');
            }
            else {
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
        let prevTxHex;
        try {
            const formatCheck = (0, utxo_validator_1.validateUTXOFormat)(inUtxo);
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
            let lastError = null;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        const delay = 2000 * attempt; // 2s, 4s delays
                        console.log(`   Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    const txHexResponse = await axios_1.default.get(txHexUrl, {
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
                    }
                    else {
                        throw new Error('Empty transaction hex response');
                    }
                }
                catch (fetchError) {
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
        }
        catch (prevTxError) {
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
        const proof = await charmsService.generateProof(spellYaml, appBin, prevTxHex, // Pass previous transaction hex
        mockMode, fundingUtxo, fundingUtxoValue, changeAddress, feeRate);
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
    }
    catch (error) {
        console.error('❌ Error minting gift card:', error);
        // Provide detailed error messages for common issues
        let errorMessage = error.message || 'Failed to mint gift card';
        let statusCode = 500;
        // Handle specific error types with improved messages
        if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
            statusCode = 504; // Gateway timeout
            errorMessage = `Operation timed out: ${error.message}. Proof generation may be taking longer than expected. Please try again.`;
        }
        else if (error.message?.includes('UTXO')) {
            statusCode = 400; // Bad request for UTXO issues
            errorMessage = `UTXO validation failed: ${error.message}`;
        }
        else if (error.message?.includes('Invalid') || error.message?.includes('Missing')) {
            statusCode = 400;
            errorMessage = `Validation error: ${error.message}`;
        }
        else if (error.message?.includes('Prover API') || error.message?.includes('proof generation')) {
            statusCode = 502; // Bad gateway for Prover API issues
            errorMessage = `Proof generation failed: ${error.message}. The Prover API may be experiencing issues. Please try again in a few moments.`;
        }
        else if (error.message?.includes('previous transaction hex')) {
            statusCode = 502; // Bad gateway - external API issue
            errorMessage = `Failed to fetch transaction data: ${error.message}. The memepool.space API may be slow or unavailable. Please try again.`;
        }
        else if (error.response?.status) {
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
router.post('/redeem', async (req, res) => {
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
        // Validate that spell has at least one input
        if (!spell.ins || spell.ins.length === 0) {
            return res.status(400).json({
                error: 'Invalid spell: must have at least one input UTXO',
            });
        }
        // Extract and validate funding UTXO from spell
        const fundingUtxo = spell.ins[0]?.utxo_id;
        if (!fundingUtxo) {
            return res.status(400).json({
                error: 'Invalid spell: first input must have utxo_id',
            });
        }
        // Validate UTXO format
        const formatCheck = (0, utxo_validator_1.validateUTXOFormat)(fundingUtxo);
        if (!formatCheck.valid) {
            return res.status(400).json({
                error: `Invalid UTXO format in spell: ${formatCheck.error}`,
            });
        }
        // Validate UTXO exists and is spendable
        const utxoValidation = await (0, utxo_validator_1.validateUTXOExists)(fundingUtxo);
        if (!utxoValidation.valid || !utxoValidation.utxo) {
            return res.status(400).json({
                error: utxoValidation.error || 'Funding UTXO validation failed',
            });
        }
        // Validate UTXO has sufficient value for fees
        const requiredSats = MIN_FEE_BUFFER_SATS;
        const valueCheck = (0, utxo_validator_1.validateUTXOValue)(utxoValidation.utxo.value, requiredSats);
        if (!valueCheck.sufficient) {
            return res.status(400).json({
                error: `Insufficient UTXO value for fees. Required: ${requiredSats} sats, Available: ${utxoValidation.utxo.value} sats, Shortfall: ${valueCheck.shortfall} sats`,
                utxoValue: utxoValidation.utxo.value,
                requiredValue: requiredSats,
                shortfall: valueCheck.shortfall,
            });
        }
        // Fetch previous transaction hex for the input UTXO
        // Prover API requires prev_txs to contain the transaction that created the input UTXO
        let prevTxHex;
        try {
            const { txid } = formatCheck;
            const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
            const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
                ? 'https://memepool.space/testnet4'
                : 'https://memepool.space';
            const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
            console.log(`📥 Fetching previous transaction hex for redeem: ${txHexUrl}`);
            const txHexResponse = await axios_1.default.get(txHexUrl, {
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
            }
            else {
                throw new Error('Empty transaction hex response');
            }
        }
        catch (prevTxError) {
            console.error('❌ Failed to fetch previous transaction hex for redeem:', prevTxError.message);
            throw new Error(`Failed to fetch previous transaction hex for UTXO ${fundingUtxo}: ${prevTxError.message}. The Prover API requires prev_txs to contain the transaction that created each input UTXO.`);
        }
        // Ensure we have prevTxHex before proceeding
        if (!prevTxHex || prevTxHex.length === 0) {
            throw new Error(`No previous transaction hex available for UTXO ${fundingUtxo}. Cannot proceed without prev_txs.`);
        }
        // Fix app_vk in spell if it's incorrect (using tokenId instead of actual VK)
        // The frontend may send tokenId for both app_id and app_vk, but app_vk must be the actual VK
        const actualAppVk = await charmsService.getAppVk();
        if (spell.apps && typeof spell.apps === 'object') {
            let appVkFixed = false;
            Object.entries(spell.apps).forEach(([key, appIdValue]) => {
                const appIdStr = String(appIdValue);
                const parts = appIdStr.split('/');
                if (parts.length >= 3) {
                    const appId = parts[1];
                    const appVk = parts[2];
                    // If app_vk matches app_id, it's wrong - replace with actual VK
                    if (appVk === appId) {
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
        }
        catch (validationError) {
            console.warn('⚠️ Spell validation error (skipping):', validationError.message);
            console.warn('   Proceeding anyway - Prover API will validate the spell');
        }
        // Generate proof with app binary
        // IMPORTANT: Redeem operations ALWAYS require the binary - no mock mode allowed
        // Redeem must execute app logic to validate redemption rules and update state
        let appBin;
        try {
            appBin = await charmsService.buildApp();
            console.log(`✅ App binary built for redeem operation`);
        }
        catch (buildError) {
            // Redeem ALWAYS requires binary - no mock mode allowed
            console.error('❌ App build failed for redeem:', buildError.message);
            throw new Error(`Redeem operation requires app binary. Failed to build: ${buildError.message}. ` +
                `Redeem cannot work in mock mode - it needs to execute app logic to update state. ` +
                `Please ensure the gift-cards app builds successfully. Run: cd gift-cards && cargo build --release --target wasm32-wasip1`);
        }
        // Ensure we have binary before proceeding
        if (!appBin) {
            throw new Error('App binary is required for redeem operations but was not built. ' +
                'Redeem must execute app logic to validate and update state. ' +
                'Please ensure the gift-cards app builds successfully.');
        }
        // Redeem always requires binary - do not use mock mode
        const mockMode = false;
        // Extract funding info from validated UTXO
        const fundingUtxoValue = utxoValidation.utxo.value;
        const changeAddress = spell.outs?.[0]?.address; // Use first output as change address
        const feeRate = 2.0;
        const proof = await charmsService.generateProof(spellYaml, appBin, prevTxHex, // Pass previous transaction hex
        mockMode, fundingUtxo, fundingUtxoValue, changeAddress, feeRate);
        res.json({
            success: true,
            spell: spellYaml,
            proof,
            message: 'Redemption spell created successfully. Sign and broadcast to complete redemption.',
        });
    }
    catch (error) {
        console.error('Error redeeming gift card:', error);
        // Provide detailed error messages for common issues
        let errorMessage = error.message || 'Failed to redeem gift card';
        let statusCode = 500;
        // Handle specific error types
        if (error.message?.includes('UTXO') || error.message?.includes('Invalid spell') || error.message?.includes('Missing')) {
            statusCode = 400; // Bad request for validation issues
        }
        else if (error.message?.includes('Prover API')) {
            statusCode = 502; // Bad gateway for Prover API issues
            // Enhance Prover API error messages for binary-related issues
            if (error.message?.includes('app binary not found') || error.message?.includes('binary')) {
                errorMessage = `${errorMessage}. Redeem operations require the app binary to execute logic. ` +
                    `Please ensure the gift-cards app is built: cd gift-cards && cargo build --release --target wasm32-wasip1`;
            }
        }
        else if (error.message?.includes('binary') || error.message?.includes('build')) {
            statusCode = 500;
            errorMessage = `${errorMessage}. Redeem operations require the app binary to execute app logic and update state. ` +
                `This is different from minting which can work in mock mode. ` +
                `Please ensure the gift-cards app builds successfully.`;
        }
        else if (error.response?.status) {
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
router.post('/transfer', async (req, res) => {
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
        // Validate that spell has at least one input
        if (!spell.ins || spell.ins.length === 0) {
            return res.status(400).json({
                error: 'Invalid spell: must have at least one input UTXO',
            });
        }
        // Extract and validate funding UTXO from spell
        const fundingUtxo = spell.ins[0]?.utxo_id;
        if (!fundingUtxo) {
            return res.status(400).json({
                error: 'Invalid spell: first input must have utxo_id',
            });
        }
        // Validate UTXO format
        const formatCheck = (0, utxo_validator_1.validateUTXOFormat)(fundingUtxo);
        if (!formatCheck.valid) {
            return res.status(400).json({
                error: `Invalid UTXO format in spell: ${formatCheck.error}`,
            });
        }
        // Validate UTXO exists and is spendable
        const utxoValidation = await (0, utxo_validator_1.validateUTXOExists)(fundingUtxo);
        if (!utxoValidation.valid || !utxoValidation.utxo) {
            return res.status(400).json({
                error: utxoValidation.error || 'Funding UTXO validation failed',
            });
        }
        // Validate UTXO has sufficient value for fees
        const requiredSats = MIN_FEE_BUFFER_SATS;
        const valueCheck = (0, utxo_validator_1.validateUTXOValue)(utxoValidation.utxo.value, requiredSats);
        if (!valueCheck.sufficient) {
            return res.status(400).json({
                error: `Insufficient UTXO value for fees. Required: ${requiredSats} sats, Available: ${utxoValidation.utxo.value} sats, Shortfall: ${valueCheck.shortfall} sats`,
                utxoValue: utxoValidation.utxo.value,
                requiredValue: requiredSats,
                shortfall: valueCheck.shortfall,
            });
        }
        // Fetch previous transaction hex for the input UTXO
        // Prover API requires prev_txs to contain the transaction that created the input UTXO
        let prevTxHex;
        try {
            const { txid } = formatCheck;
            const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
            const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
                ? 'https://memepool.space/testnet4'
                : 'https://memepool.space';
            const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
            console.log(`📥 Fetching previous transaction hex for transfer: ${txHexUrl}`);
            const txHexResponse = await axios_1.default.get(txHexUrl, {
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
            }
            else {
                throw new Error('Empty transaction hex response');
            }
        }
        catch (prevTxError) {
            console.error('❌ Failed to fetch previous transaction hex for transfer:', prevTxError.message);
            throw new Error(`Failed to fetch previous transaction hex for UTXO ${fundingUtxo}: ${prevTxError.message}. The Prover API requires prev_txs to contain the transaction that created each input UTXO.`);
        }
        // Ensure we have prevTxHex before proceeding
        if (!prevTxHex || prevTxHex.length === 0) {
            throw new Error(`No previous transaction hex available for UTXO ${fundingUtxo}. Cannot proceed without prev_txs.`);
        }
        // Fix app_vk in spell if it's incorrect (using tokenId instead of actual VK)
        // The frontend may send tokenId for both app_id and app_vk, but app_vk must be the actual VK
        const actualAppVk = await charmsService.getAppVk();
        if (spell.apps && typeof spell.apps === 'object') {
            let appVkFixed = false;
            Object.entries(spell.apps).forEach(([key, appIdValue]) => {
                const appIdStr = String(appIdValue);
                const parts = appIdStr.split('/');
                if (parts.length >= 3) {
                    const appId = parts[1];
                    const appVk = parts[2];
                    // If app_vk matches app_id, it's wrong - replace with actual VK
                    if (appVk === appId) {
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
        }
        catch (validationError) {
            console.warn('⚠️ Spell validation error (skipping):', validationError.message);
            console.warn('   Proceeding anyway - Prover API will validate the spell');
        }
        // Generate proof with app binary
        // IMPORTANT: Transfer operations ALWAYS require the binary - no mock mode allowed
        // Transfer must execute app logic to move NFT and tokens to new address
        let appBin;
        try {
            appBin = await charmsService.buildApp();
            console.log(`✅ App binary built for transfer operation`);
        }
        catch (buildError) {
            // Transfer ALWAYS requires binary - no mock mode allowed
            console.error('❌ App build failed for transfer:', buildError.message);
            throw new Error(`Transfer operation requires app binary. Failed to build: ${buildError.message}. ` +
                `Transfer cannot work in mock mode - it needs to execute app logic to move NFT and tokens. ` +
                `Please ensure the gift-cards app builds successfully. Run: cd gift-cards && cargo build --release --target wasm32-wasip1`);
        }
        // Ensure we have binary before proceeding
        if (!appBin) {
            throw new Error('App binary is required for transfer operations but was not built. ' +
                'Transfer must execute app logic to move NFT and tokens. ' +
                'Please ensure the gift-cards app builds successfully.');
        }
        // Transfer always requires binary - do not use mock mode
        const mockMode = false;
        // Extract funding info from validated UTXO
        const fundingUtxoValue = utxoValidation.utxo.value;
        const changeAddress = spell.outs?.[0]?.address; // Use first output as change address
        const feeRate = 2.0;
        const proof = await charmsService.generateProof(spellYaml, appBin, prevTxHex, // Pass previous transaction hex
        mockMode, fundingUtxo, fundingUtxoValue, changeAddress, feeRate);
        res.json({
            success: true,
            spell: spellYaml,
            proof,
            message: 'Transfer spell created successfully. Sign and broadcast to complete transfer.',
        });
    }
    catch (error) {
        console.error('Error transferring gift card:', error);
        // Provide detailed error messages for common issues
        let errorMessage = error.message || 'Failed to transfer gift card';
        let statusCode = 500;
        // Handle specific error types
        if (error.message?.includes('UTXO') || error.message?.includes('Invalid spell') || error.message?.includes('Missing')) {
            statusCode = 400; // Bad request for validation issues
        }
        else if (error.message?.includes('Prover API')) {
            statusCode = 502; // Bad gateway for Prover API issues
            // Enhance Prover API error messages for binary-related issues
            if (error.message?.includes('app binary not found') || error.message?.includes('binary')) {
                errorMessage = `${errorMessage}. Transfer operations require the app binary to execute logic. ` +
                    `Please ensure the gift-cards app is built: cd gift-cards && cargo build --release --target wasm32-wasip1`;
            }
        }
        else if (error.message?.includes('binary') || error.message?.includes('build')) {
            statusCode = 500;
            errorMessage = `${errorMessage}. Transfer operations require the app binary to execute app logic and move NFT/tokens. ` +
                `This is different from minting which can work in mock mode. ` +
                `Please ensure the gift-cards app builds successfully.`;
        }
        else if (error.response?.status) {
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
router.get('/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        // TODO: Implement fetching gift card details from blockchain/indexer
        res.json({
            tokenId,
            message: 'Gift card details endpoint - to be implemented with indexer',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to get gift card' });
    }
});
exports.default = router;
