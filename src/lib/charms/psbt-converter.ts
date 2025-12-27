/**
 * PSBT Conversion Utilities
 * Converts raw Bitcoin transaction hex to PSBT format for wallet signing
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/signing/
 */

import * as bitcoin from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';

const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';

// Testnet4 network configuration
const testnet4 = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

/**
 * Get Bitcoin network object based on network string
 */
function getNetwork(): bitcoin.Network {
  if (NETWORK === 'testnet4' || NETWORK === 'testnet') {
    return testnet4 as bitcoin.Network;
  }
  return bitcoin.networks.bitcoin;
}

/**
 * Fetch UTXO details from memepool.space
 * Note: This may fail due to CORS in browser - that's okay, wallet can provide info during signing
 */
async function fetchUtxoDetails(
  txid: string,
  vout: number
): Promise<{ value: number; scriptPubKey: Buffer } | null> {
  try {
    const explorerUrl = NETWORK === 'testnet4'
      ? `https://memepool.space/testnet4/api/tx/${txid}`
      : `https://memepool.space/api/tx/${txid}`;
    
    const response = await fetch(explorerUrl, { cache: 'no-store' });
    if (!response.ok) {
      // CORS or other error - return null, wallet will provide info during signing
      return null;
    }
    
    const tx = await response.json();
    if (!tx.vout || vout >= tx.vout.length) {
      return null;
    }
    
    const output = tx.vout[vout];
    return {
      value: output.value || 0,
      scriptPubKey: Buffer.from(output.scriptpubkey, 'hex'),
    };
  } catch (error) {
    // CORS or network error - that's okay, wallet can provide UTXO info during signing
    console.warn('Failed to fetch UTXO details (CORS may be blocking):', error);
    return null;
  }
}

/**
 * Convert raw transaction hex to PSBT format
 * This is required for wallet signing as wallets expect PSBT format
 */
export async function hexToPsbt(
  txHex: string,
  utxos?: Array<{ txid: string; vout: number; value: number; scriptPubKey?: string }>
): Promise<string> {
  try {
    const network = getNetwork();
    
    // Parse the raw transaction
    const tx = bitcoin.Transaction.fromHex(txHex);
    
    // Create a new PSBT
    const psbt = new Psbt({ network });
    
    // Add inputs with UTXO data
    for (let i = 0; i < tx.ins.length; i++) {
      const input = tx.ins[i];
      // Bitcoin transaction hashes in Transaction object are in internal byte order (reversed)
      // We need the normal txid for fetching UTXO details
      const hashBuffer = Buffer.from(input.hash);
      const txid = hashBuffer.reverse().toString('hex'); // Reverse to get normal txid for API calls
      const vout = input.index;
      
      // Try to get UTXO info from provided utxos array
      let utxoInfo: { value: number; scriptPubKey: Buffer } | null = null;
      
      if (utxos && utxos[i]) {
        const utxo = utxos[i];
        utxoInfo = {
          value: utxo.value,
          scriptPubKey: utxo.scriptPubKey 
            ? Buffer.from(utxo.scriptPubKey, 'hex')
            : Buffer.alloc(0),
        };
      } else {
        // Try to fetch from server-side proxy first (bypasses CORS)
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const txUrl = `${API_URL}/api/utxo/tx/${txid}`;
          const response = await fetch(txUrl, { cache: 'no-store' });
          if (response.ok) {
            const tx = await response.json();
            if (tx.vout && vout < tx.vout.length) {
              const output = tx.vout[vout];
              utxoInfo = {
                value: output.value || 0,
                scriptPubKey: Buffer.from(output.scriptpubkey, 'hex'),
              };
            }
          }
        } catch (proxyError) {
          console.warn('Server-side proxy failed, trying direct fetch:', proxyError);
        }
        
        // Fallback to direct fetch (may fail due to CORS)
        if (!utxoInfo) {
          utxoInfo = await fetchUtxoDetails(txid, vout);
        }
      }
      
      // If we can't get UTXO info, we can still create PSBT with minimal info
      // The wallet will fill in the missing details during signing
      if (!utxoInfo) {
        console.warn(`Could not fetch UTXO details for input ${i} (txid: ${txid}, vout: ${vout}). Wallet will provide info during signing.`);
        // Create minimal UTXO info - wallet will fill in the rest
        utxoInfo = {
          value: 0, // Will be filled by wallet
          scriptPubKey: Buffer.alloc(0), // Will be filled by wallet
        };
      }
      
      // Determine if this is a SegWit/Taproot transaction
      // For SegWit/Taproot, we should use witnessUtxo, not nonWitnessUtxo
      const isSegWit = input.witness && input.witness.length > 0;
      
      // Check if the output script is Taproot (P2TR) - starts with 0x51 (OP_1) followed by 32 bytes
      const isTaproot = utxoInfo.scriptPubKey.length === 34 && utxoInfo.scriptPubKey[0] === 0x51;
      
      // For Taproot and SegWit transactions, use witnessUtxo only
      // nonWitnessUtxo can cause hash mismatch errors for SegWit/Taproot transactions
      if (isTaproot || isSegWit) {
        console.log(`ℹ️ Using witnessUtxo for input ${i} (txid: ${txid}) - Taproot/SegWit transaction`);
        psbt.addInput({
          hash: hashBuffer, // Use internal byte order hash
          index: vout,
          witnessUtxo: {
            script: utxoInfo.scriptPubKey.length > 0 ? utxoInfo.scriptPubKey : Buffer.alloc(0),
            value: utxoInfo.value || 0,
          },
        });
      } else {
        // For non-SegWit transactions, try to use nonWitnessUtxo if available
        // This provides better verification for the wallet
        let prevTxHex: string | null = null;
        
        // Try server-side proxy first (bypasses CORS)
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const txHexUrl = `${API_URL}/api/utxo/tx/${txid}/hex`;
          const response = await fetch(txHexUrl, { cache: 'no-store' });
          if (response.ok) {
            prevTxHex = await response.text();
            // Validate it looks like hex
            if (prevTxHex && /^[0-9a-fA-F]+$/.test(prevTxHex.trim())) {
              prevTxHex = prevTxHex.trim();
              console.log(`✅ Fetched full transaction hex for input ${i} (txid: ${txid}) via server proxy`);
            } else {
              prevTxHex = null;
              console.warn(`⚠️ Invalid hex format from server proxy for txid: ${txid}`);
            }
          }
        } catch (proxyError) {
          console.warn(`⚠️ Server-side proxy failed for txid ${txid}, trying direct fetch:`, proxyError);
        }
        
        // Fallback to direct fetch (may fail due to CORS)
        if (!prevTxHex) {
          try {
            const explorerUrl = NETWORK === 'testnet4'
              ? `https://memepool.space/testnet4/api/tx/${txid}/hex`
              : `https://memepool.space/api/tx/${txid}/hex`;
            
            const response = await fetch(explorerUrl, { cache: 'no-store' });
            if (response.ok) {
              prevTxHex = await response.text();
              if (prevTxHex && /^[0-9a-fA-F]+$/.test(prevTxHex.trim())) {
                prevTxHex = prevTxHex.trim();
                console.log(`✅ Fetched full transaction hex for input ${i} (txid: ${txid}) via direct fetch`);
              } else {
                prevTxHex = null;
              }
            }
          } catch (error) {
            console.warn(`⚠️ Could not fetch full transaction hex for txid ${txid} (CORS may block):`, error);
          }
        }
        
        // For non-SegWit, try nonWitnessUtxo if available, otherwise use witnessUtxo
        if (prevTxHex && prevTxHex.length > 0) {
          try {
            // Verify the transaction hash matches before adding
            const prevTx = bitcoin.Transaction.fromHex(prevTxHex);
            const prevTxHash = prevTx.getHash();
            const expectedHash = Buffer.from(input.hash);
            
            // Compare hashes (both should be in internal byte order)
            if (prevTxHash.equals(expectedHash)) {
              psbt.addInput({
                hash: hashBuffer, // Use internal byte order hash
                index: vout,
                nonWitnessUtxo: Buffer.from(prevTxHex, 'hex'),
              });
              console.log(`✅ Added input ${i} with nonWitnessUtxo (txid: ${txid}, vout: ${vout})`);
            } else {
              console.warn(`⚠️ Transaction hash mismatch for input ${i}, using witnessUtxo instead`);
              throw new Error('Hash mismatch');
            }
          } catch (error: any) {
            // If nonWitnessUtxo fails (e.g., hash mismatch), fall back to witnessUtxo
            console.warn(`⚠️ Failed to add nonWitnessUtxo for input ${i}, falling back to witnessUtxo:`, error.message);
            psbt.addInput({
              hash: hashBuffer,
              index: vout,
              witnessUtxo: {
                script: utxoInfo.scriptPubKey.length > 0 ? utxoInfo.scriptPubKey : Buffer.alloc(0),
                value: utxoInfo.value || 0,
              },
            });
          }
        } else {
          // Fallback to witnessUtxo if we can't get full transaction hex
          console.log(`ℹ️ Using witnessUtxo for input ${i} (txid: ${txid}) - full transaction hex not available`);
          psbt.addInput({
            hash: hashBuffer, // Use internal byte order hash
            index: vout,
            witnessUtxo: {
              script: utxoInfo.scriptPubKey.length > 0 ? utxoInfo.scriptPubKey : Buffer.alloc(0),
              value: utxoInfo.value || 0,
            },
          });
        }
      }
    }
    
    // Add outputs
    for (let i = 0; i < tx.outs.length; i++) {
      const output = tx.outs[i];
      psbt.addOutput({
        script: output.script,
        value: output.value,
      });
    }
    
    // Validate PSBT before returning
    try {
      // Try to serialize and deserialize to ensure it's valid
      const psbtBase64 = psbt.toBase64();
      const network = getNetwork();
      const validatedPsbt = Psbt.fromBase64(psbtBase64, { network });
      console.log(`✅ PSBT validated: ${validatedPsbt.inputCount} input(s), ${validatedPsbt.outputCount} output(s)`);
      return psbtBase64;
    } catch (validateError: any) {
      console.error('❌ PSBT validation failed:', validateError);
      throw new Error(`PSBT validation failed: ${validateError.message}`);
    }
  } catch (error: any) {
    console.error('Failed to convert hex to PSBT:', error);
    throw new Error(`PSBT conversion failed: ${error.message}`);
  }
}

/**
 * Extract signed transaction hex from signed PSBT or transaction hex
 * Some wallets return the signed transaction hex directly instead of a PSBT
 */
export function psbtToHex(signedPsbtOrHex: string): string {
  try {
    // Handle non-string input
    if (typeof signedPsbtOrHex !== 'string') {
      throw new Error(`Expected string but got ${typeof signedPsbtOrHex}`);
    }
    
    // First, check if it's already a transaction hex
    // Bitcoin transaction hex typically starts with version bytes (01, 02, etc.)
    // and is much longer than a typical base64 PSBT string
    const trimmed = signedPsbtOrHex.trim();
    
    if (!trimmed || trimmed.length === 0) {
      throw new Error('Empty PSBT or transaction hex string');
    }
    
    // Check if it looks like hex (only 0-9, a-f, A-F)
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
    
    // Check if it looks like base64 (contains A-Z, a-z, 0-9, +, /, =)
    const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(trimmed);
    
    // Check if it's a PSBT in hex format (starts with "psbt" magic: 70736274ff)
    // Make it case-insensitive
    const lowerTrimmed = trimmed.toLowerCase();
    const isPsbtHex = isHex && (lowerTrimmed.startsWith('70736274ff') || lowerTrimmed.startsWith('0x70736274ff'));
    
    console.log(`🔍 Parsing response: length=${trimmed.length}, isHex=${isHex}, isBase64=${isBase64}, isPsbtHex=${isPsbtHex}, firstChars=${trimmed.substring(0, 20)}`);
    
    // If it's a PSBT in hex format, convert to Buffer and parse
    if (isPsbtHex) {
      try {
        console.log('ℹ️ Detected PSBT in hex format (starts with "psbt" magic bytes)');
        console.log(`   Hex length: ${trimmed.length}, first 50 chars: ${trimmed.substring(0, 50)}`);
        const network = getNetwork();
        
        // Remove 0x prefix if present
        const cleanHex = lowerTrimmed.startsWith('0x') ? trimmed.substring(2) : trimmed;
        
        // According to PSBT spec: Hex is NOT an official format
        // Unisat returns binary PSBT encoded as hex, so we need to:
        // 1. Convert hex string → Buffer (binary)
        // 2. Parse PSBT from binary buffer
        console.log('   Converting hex-encoded binary PSBT to Buffer...');
        const psbtBuffer = Buffer.from(cleanHex, 'hex');
        console.log(`   Buffer length: ${psbtBuffer.length} bytes`);
        console.log(`   First 20 bytes (hex): ${psbtBuffer.slice(0, 20).toString('hex')}`);
        
        // Verify PSBT magic bytes: "psbt" (0x70736274) followed by 0xff separator
        const magicBytes = psbtBuffer.slice(0, 5);
        const expectedMagic = Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]);
        if (!magicBytes.equals(expectedMagic)) {
          console.error(`   ❌ Invalid PSBT magic bytes. Expected: ${expectedMagic.toString('hex')}, Got: ${magicBytes.toString('hex')}`);
          throw new Error(`Invalid PSBT magic bytes. This doesn't appear to be a valid PSBT.`);
        }
        console.log('   ✅ PSBT magic bytes verified');
        
        // Parse PSBT from buffer (this is the correct way per PSBT spec)
        console.log('   Parsing PSBT from binary buffer...');
        let psbt: Psbt;
        try {
          psbt = Psbt.fromBuffer(psbtBuffer, { network });
          console.log('   ✅ PSBT parsed successfully from binary buffer');
        } catch (parseError: any) {
          console.error('   ❌ Failed to parse PSBT from buffer:', parseError.message);
          console.error('   Error details:', {
            name: parseError.name,
            message: parseError.message,
            stack: parseError.stack?.split('\n').slice(0, 3)
          });
          throw new Error(`Failed to parse PSBT from binary buffer: ${parseError.message}`);
        }
        
        // Check PSBT structure
        console.log(`   PSBT structure: ${psbt.inputCount} input(s), ${psbt.outputCount} output(s)`);
        
        // Check if inputs have signatures (partial or final)
        for (let i = 0; i < psbt.inputCount; i++) {
          const input = psbt.data.inputs[i];
          const hasPartialSig = input.partialSig && input.partialSig.length > 0;
          const hasFinalScriptSig = !!input.finalScriptSig;
          const hasFinalScriptWitness = !!input.finalScriptWitness;
          const hasTaprootKeyPath = !!input.tapKeySig;
          const hasTaprootScriptPath = !!input.tapScriptSig;
          
          console.log(`   Input ${i} details:`);
          console.log(`     - partialSig: ${hasPartialSig} (${input.partialSig?.length || 0} signatures)`);
          console.log(`     - finalScriptSig: ${hasFinalScriptSig}`);
          console.log(`     - finalScriptWitness: ${hasFinalScriptWitness}`);
          console.log(`     - tapKeySig: ${hasTaprootKeyPath}`);
          console.log(`     - tapScriptSig: ${hasTaprootScriptPath ? 'present' : 'none'}`);
          
          // Log partial signature details if present
          if (hasPartialSig && input.partialSig) {
            input.partialSig.forEach((sig, idx) => {
              console.log(`     - partialSig[${idx}]: pubkey=${sig.pubkey.toString('hex').substring(0, 16)}..., signature length=${sig.signature.length}`);
            });
          }
        }
        
        // Check if PSBT is already finalized by checking for finalScriptWitness
        // If all inputs have finalScriptWitness, we can extract directly
        const allInputsFinalized = Array.from({ length: psbt.inputCount }, (_, i) => {
          const input = psbt.data.inputs[i];
          return !!(input.finalScriptWitness || input.finalScriptSig);
        }).every(finalized => finalized);
        
        let txHex: string;
        if (allInputsFinalized) {
          console.log('   ✅ All inputs have finalScriptWitness/finalScriptSig - PSBT is finalized');
          console.log('   Attempting direct extraction from finalized PSBT...');
          try {
            // Try to extract - if it fails, we'll do manual construction
            txHex = psbt.extractTransaction().toHex();
            console.log('   ✅ Transaction extracted directly (PSBT was already finalized)');
            return txHex;
          } catch (extractError: any) {
            console.warn(`   ⚠️ Direct extraction failed despite finalized inputs: ${extractError.message}`);
            console.warn('   Falling back to manual construction...');
            // Fall through to manual construction below
          }
        } else {
          console.log('   ℹ️ Not all inputs are finalized - will attempt finalization');
        }
        
        // Try standard extraction
        try {
          console.log('   Attempting to extract transaction (may already be finalized)...');
          txHex = psbt.extractTransaction().toHex();
          console.log('   ✅ Transaction extracted (PSBT was already finalized)');
        } catch (extractError: any) {
          // If extraction fails, try finalizing first
          console.log('   ℹ️ Extraction failed, attempting to finalize inputs...');
          console.log(`   Error: ${extractError.message}`);
          
          // Check if we can finalize individual inputs
          try {
            // Try to finalize each input individually to see which one fails
            for (let i = 0; i < psbt.inputCount; i++) {
              try {
                console.log(`   Attempting to finalize input ${i}...`);
                psbt.finalizeInput(i);
                console.log(`   ✅ Input ${i} finalized successfully`);
              } catch (inputError: any) {
                console.error(`   ❌ Failed to finalize input ${i}:`, inputError.message);
                const input = psbt.data.inputs[i];
                console.error(`   Input ${i} state:`, {
                  hasPartialSig: !!(input.partialSig && input.partialSig.length > 0),
                  hasFinalScriptSig: !!input.finalScriptSig,
                  hasFinalScriptWitness: !!input.finalScriptWitness,
                  hasTapKeySig: !!input.tapKeySig,
                  hasWitnessUtxo: !!input.witnessUtxo,
                  hasNonWitnessUtxo: !!input.nonWitnessUtxo,
                });
                throw inputError;
              }
            }
            
            console.log('   ✅ All inputs finalized');
            txHex = psbt.extractTransaction().toHex();
            console.log('   ✅ Transaction extracted after finalization');
          } catch (finalizeError: any) {
            console.error('   ❌ Finalization failed:', finalizeError.message);
            console.error('   Finalization error details:', {
              name: finalizeError.name,
              message: finalizeError.message,
              stack: finalizeError.stack?.split('\n').slice(0, 5)
            });
            
            // If finalization fails, try to manually construct the transaction
            // This can happen if Unisat signed but bitcoinjs-lib can't finalize due to format differences
            console.log('   ⚠️ Standard finalization failed, attempting manual transaction construction...');
            
            try {
              // Get the unsigned transaction from PSBT
              // The unsignedTx in globalMap is a PsbtTransaction which wraps a Transaction
              console.log('   Attempting to extract unsigned transaction from PSBT...');
              
              let unsignedTx: bitcoin.Transaction;
              const txData = psbt.data.globalMap.unsignedTx;
              
              if (!txData) {
                throw new Error('No unsigned transaction in PSBT global map');
              }
              
              // PsbtTransaction has a 'tx' property that contains the actual Transaction
              const txDataAny = txData as any;
              if (txDataAny.tx && txDataAny.tx instanceof bitcoin.Transaction) {
                // Access the underlying Transaction object
                unsignedTx = txDataAny.tx;
                console.log('   ✅ Got Transaction from PsbtTransaction.tx property');
              } else if (txData instanceof bitcoin.Transaction) {
                // It's already a Transaction
                unsignedTx = txData;
                console.log('   ✅ Got Transaction object directly');
              } else if (typeof txDataAny.toHex === 'function') {
                // Try toHex method
                const txHex = txDataAny.toHex();
                unsignedTx = bitcoin.Transaction.fromHex(txHex);
                console.log('   ✅ Serialized and parsed Transaction (via toHex)');
              } else if (typeof txDataAny.toBuffer === 'function') {
                // Try toBuffer method
                const txBuffer = txDataAny.toBuffer();
                unsignedTx = bitcoin.Transaction.fromBuffer(txBuffer);
                console.log('   ✅ Serialized and parsed Transaction (via toBuffer)');
              } else {
                // Log the actual type to help debug
                console.error('   ❌ Unknown transaction type:', {
                  type: typeof txData,
                  constructor: txData?.constructor?.name,
                  keys: txData ? Object.keys(txData) : [],
                  hasTx: !!(txDataAny as any).tx,
                  hasToHex: typeof txDataAny.toHex === 'function',
                  hasToBuffer: typeof txDataAny.toBuffer === 'function',
                });
                throw new Error(`Cannot extract transaction from PSBT - unsupported type: ${txData?.constructor?.name || typeof txData}`);
              }
              
              // Check if we have tapKeySig (Taproot key path signature)
              // This is what Unisat typically provides for Taproot
              const input0 = psbt.data.inputs[0];
              if (input0.tapKeySig) {
                console.log('   ✅ Found tapKeySig - constructing Taproot witness manually...');
                console.log(`   tapKeySig length: ${input0.tapKeySig.length} bytes`);
                
                // For Taproot key path, the witness is just the signature
                // Format: [signature] (1 element)
                const taprootSig = input0.tapKeySig;
                const witness = [taprootSig];
                
                // Clone the transaction and add witness
                const signedTx = unsignedTx.clone();
                signedTx.ins[0].witness = witness;
                
                console.log('   ✅ Manually constructed Taproot witness');
                txHex = signedTx.toHex();
                console.log('   ✅ Transaction extracted with manual witness construction');
                return txHex;
              } else if (input0.partialSig && input0.partialSig.length > 0) {
                // Try to use partial signatures to construct witness
                console.log('   ✅ Found partial signatures - attempting to construct witness...');
                console.log(`   partialSig count: ${input0.partialSig.length}`);
                
                // For Taproot, if we have partial sigs, we might need to construct the witness
                // This is a fallback - ideally tapKeySig should be present
                const partialSig = input0.partialSig[0];
                console.log(`   Using partialSig[0], signature length: ${partialSig.signature.length}`);
                
                const witness = [partialSig.signature];
                
                const signedTx = unsignedTx.clone();
                signedTx.ins[0].witness = witness;
                
                console.log('   ✅ Manually constructed witness from partial signature');
                txHex = signedTx.toHex();
                console.log('   ✅ Transaction extracted with manual witness from partial sig');
                return txHex;
              } else if (input0.finalScriptWitness) {
                // If finalScriptWitness exists, use it directly
                // IMPORTANT: finalScriptWitness is a Buffer containing the serialized witness stack
                // We need to decompile it to get the array of Buffers
                console.log('   ✅ Found finalScriptWitness - decompiling witness stack...');
                console.log(`   finalScriptWitness type: ${typeof input0.finalScriptWitness}, isBuffer: ${Buffer.isBuffer(input0.finalScriptWitness)}, length: ${Buffer.isBuffer(input0.finalScriptWitness) ? input0.finalScriptWitness.length : 'N/A'}`);
                
                const witnessBuffer = input0.finalScriptWitness;
                
                // Clone the transaction to avoid modifying the original
                const signedTx = unsignedTx.clone();
                
                // Decompile the witness stack from the serialized Buffer
                // finalScriptWitness is a Buffer containing the serialized witness stack
                // We need to use bitcoin.script.decompile() to convert it to an array of Buffers
                let witnessBuffers: Buffer[];
                if (Buffer.isBuffer(witnessBuffer)) {
                  // Decompile the serialized witness stack
                  const decompiled = bitcoin.script.decompile(witnessBuffer);
                  if (!decompiled || decompiled.length === 0) {
                    throw new Error('Failed to decompile finalScriptWitness - empty result');
                  }
                  
                  // Convert all elements to Buffers
                  witnessBuffers = decompiled.map((item: any, idx: number) => {
                    if (Buffer.isBuffer(item)) {
                      return item;
                    } else if (typeof item === 'number') {
                      // Script opcodes - should not happen in witness, but handle gracefully
                      throw new Error(`Unexpected opcode ${item} in witness at index ${idx}`);
                    } else if (typeof item === 'string') {
                      try {
                        return Buffer.from(item, 'hex');
                      } catch (e) {
                        throw new Error(`Failed to convert witness element ${idx} from hex: ${e}`);
                      }
                    } else if (item && typeof item === 'object' && item.length !== undefined) {
                      // Might be a Uint8Array or similar
                      return Buffer.from(item);
                    } else {
                      throw new Error(`Invalid witness element ${idx} type: ${typeof item}`);
                    }
                  });
                  console.log(`   ✅ Decompiled witness: ${witnessBuffers.length} elements, sizes: ${witnessBuffers.map(b => b.length).join(', ')}`);
                } else if (Array.isArray(witnessBuffer)) {
                  // If it's already an array (shouldn't happen, but handle it)
                  console.log('   ⚠️ finalScriptWitness is already an array (unexpected)');
                  witnessBuffers = witnessBuffer.map((item: any) => {
                    if (Buffer.isBuffer(item)) return item;
                    if (typeof item === 'string') return Buffer.from(item, 'hex');
                    return Buffer.from(item);
                  });
                } else {
                  throw new Error(`Invalid finalScriptWitness format: expected Buffer, got ${typeof witnessBuffer}, constructor: ${witnessBuffer?.constructor?.name}`);
                }
                
                // Validate witness before assigning
                if (witnessBuffers.length === 0) {
                  throw new Error('Witness array is empty after decompilation');
                }
                
                // Assign witness to the transaction input
                // Make sure the input index is valid
                if (signedTx.ins.length === 0) {
                  throw new Error('Transaction has no inputs');
                }
                
                signedTx.ins[0].witness = witnessBuffers;
                console.log(`   ✅ Added witness to transaction input 0 (${witnessBuffers.length} elements)`);
                
                // Validate the transaction before converting to hex
                try {
                  // Try to get the transaction hash to validate it's well-formed
                  const txHash = signedTx.getHash();
                  console.log(`   ✅ Transaction hash computed: ${txHash.toString('hex').substring(0, 16)}...`);
                } catch (hashError: any) {
                  console.warn(`   ⚠️ Transaction hash computation failed (might still be valid): ${hashError.message}`);
                }
                
                txHex = signedTx.toHex();
                console.log(`   ✅ Transaction hex generated (length: ${txHex.length})`);
                return txHex;
              } else {
                throw new Error('No Taproot signature found (no tapKeySig, no partialSig, no finalScriptWitness)');
              }
            } catch (manualError: any) {
              console.error('   ❌ Manual construction also failed:', manualError.message);
              console.error('   Manual construction error details:', {
                name: manualError.name,
                message: manualError.message,
                stack: manualError.stack?.split('\n').slice(0, 5)
              });
              
              // If manual construction fails, provide detailed error
              const missingFields: string[] = [];
              for (let i = 0; i < psbt.inputCount; i++) {
                const input = psbt.data.inputs[i];
                if (!input.finalScriptWitness && !input.finalScriptSig) {
                  if (!input.partialSig || input.partialSig.length === 0) {
                    if (!input.tapKeySig) {
                      missingFields.push(`Input ${i}: No signatures found (no partialSig, no tapKeySig, no finalScriptWitness)`);
                    } else {
                      missingFields.push(`Input ${i}: Has tapKeySig but manual construction failed`);
                    }
                  } else {
                    missingFields.push(`Input ${i}: Has partial signatures but cannot finalize or construct`);
                  }
                }
              }
              
              if (missingFields.length > 0) {
                console.error('   Missing fields:', missingFields);
                throw new Error(`Failed to finalize or construct transaction. ${missingFields.join('; ')}. Finalization error: ${finalizeError.message}, Manual construction error: ${manualError.message}`);
              }
              
              throw new Error(`Failed to finalize or extract transaction: ${finalizeError.message}. Manual construction also failed: ${manualError.message}`);
            }
          }
        }
        
        console.log(`✅ Successfully extracted transaction from hex-encoded PSBT (length: ${txHex.length})`);
        return txHex;
      } catch (psbtHexError: any) {
        console.error('❌ Failed to parse hex-encoded PSBT:', psbtHexError);
        console.error('   Error details:', {
          message: psbtHexError.message,
          stack: psbtHexError.stack,
          name: psbtHexError.name
        });
        throw new Error(`Failed to parse hex-encoded PSBT: ${psbtHexError.message}`);
      }
    }
    
    if (isHex && trimmed.length > 200 && !isPsbtHex) {
      // Likely a transaction hex - try to parse it to verify
      try {
        const network = getNetwork();
        const tx = bitcoin.Transaction.fromHex(trimmed);
        // If parsing succeeds, it's a valid transaction hex
        console.log('ℹ️ Wallet returned signed transaction hex directly (not PSBT)');
        return trimmed;
      } catch (hexError) {
        // Not a valid transaction hex, continue to PSBT parsing
        console.log('ℹ️ Input is hex but not a valid transaction, trying PSBT format...');
      }
    }
    
    // Try to parse as PSBT (base64)
    try {
      const network = getNetwork();
      const psbt = Psbt.fromBase64(signedPsbtOrHex, { network });
      
      // Finalize all inputs
      psbt.finalizeAllInputs();
      
      // Extract the signed transaction
      const tx = psbt.extractTransaction();
      
      // Return as hex
      return tx.toHex();
    } catch (psbtError: any) {
      // If PSBT parsing fails, check if it might be hex after all
      if (isHex && trimmed.length > 100) {
        console.warn('⚠️ PSBT parsing failed, but input looks like hex. Attempting to use as transaction hex...');
        try {
          const network = getNetwork();
          const tx = bitcoin.Transaction.fromHex(trimmed);
          console.log('✅ Successfully parsed as transaction hex');
          return trimmed;
        } catch (hexParseError) {
          // Neither PSBT nor valid hex
          throw new Error(`Invalid format: not a valid PSBT (${psbtError.message}) and not a valid transaction hex (${hexParseError.message})`);
        }
      }
      throw psbtError;
    }
  } catch (error: any) {
    console.error('❌ Failed to extract hex from PSBT or transaction:', error);
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('   Input was:', {
      type: typeof signedPsbtOrHex,
      length: signedPsbtOrHex?.length,
      firstChars: signedPsbtOrHex?.substring(0, 100)
    });
    throw new Error(`PSBT extraction failed: ${error.message}`);
  }
}

/**
 * Convert hex to PSBT with UTXO info from wallet
 * This version tries to get UTXO info from the wallet first
 */
export async function hexToPsbtWithWalletUtxos(
  txHex: string,
  address: string
): Promise<string> {
  try {
    // Try to get UTXOs from wallet first
    let utxos: Array<{ txid: string; vout: number; value: number }> = [];
    
    if (typeof window !== 'undefined') {
      // Try Unisat
      if ((window as any).unisat && typeof (window as any).unisat.listUnspent === 'function') {
        try {
          const walletUtxos = await (window as any).unisat.listUnspent();
          if (walletUtxos && Array.isArray(walletUtxos)) {
            utxos = walletUtxos.map((utxo: any) => ({
              txid: utxo.txid || utxo.txId || utxo.tx_hash,
              vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
              value: utxo.value || utxo.satoshis || utxo.amount || 0,
            }));
          }
        } catch (error) {
          console.warn('Failed to get UTXOs from Unisat:', error);
        }
      }
      
      // Try Xverse
      if (!utxos.length && (window as any).XverseProviders?.BitcoinProvider) {
        try {
          const xverse = (window as any).XverseProviders.BitcoinProvider;
          if (typeof xverse.getUtxos === 'function') {
            const walletUtxos = await xverse.getUtxos();
            if (walletUtxos && Array.isArray(walletUtxos)) {
              utxos = walletUtxos.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId || utxo.tx_hash,
                vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                value: utxo.value || utxo.satoshis || utxo.amount || 0,
              }));
            }
          }
        } catch (error) {
          console.warn('Failed to get UTXOs from Xverse:', error);
        }
      }
      
      // Try Leather
      if (!utxos.length) {
        const leather = (window as any).btc || (window as any).hiroWalletProvider;
        if (leather) {
          try {
            if (typeof leather.getUtxos === 'function') {
              const walletUtxos = await leather.getUtxos();
              if (walletUtxos && Array.isArray(walletUtxos)) {
                utxos = walletUtxos.map((utxo: any) => ({
                  txid: utxo.txid || utxo.txId || utxo.tx_hash,
                  vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                  value: utxo.value || utxo.satoshis || utxo.amount || 0,
                }));
              }
            } else if (typeof leather.request === 'function') {
              const response = await leather.request('getUtxos', {});
              if (response && Array.isArray(response)) {
                utxos = response.map((utxo: any) => ({
                  txid: utxo.txid || utxo.txId || utxo.tx_hash,
                  vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                  value: utxo.value || utxo.satoshis || utxo.amount || 0,
                }));
              }
            }
          } catch (error) {
            console.warn('Failed to get UTXOs from Leather:', error);
          }
        }
      }
    }
    
    // Convert to PSBT (will fetch UTXO details if not provided)
    return await hexToPsbt(txHex, utxos);
  } catch (error: any) {
    console.error('Failed to convert hex to PSBT with wallet UTXOs:', error);
    throw error;
  }
}

