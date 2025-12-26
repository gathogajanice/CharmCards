/**
 * Taproot Address Utilities
 * 
 * Utilities to get and validate Taproot addresses from Bitcoin wallets.
 * Charms requires Taproot addresses (tb1p... for testnet, bc1p... for mainnet).
 */

const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';

/**
 * Check if an address is a Taproot address
 */
export function isTaprootAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  
  if (NETWORK === 'testnet4' || NETWORK === 'testnet') {
    return trimmed.startsWith('tb1p') && trimmed.length === 62;
  } else {
    return trimmed.startsWith('bc1p') && trimmed.length === 62;
  }
}

/**
 * Attempt to switch wallet to Taproot address type programmatically
 * Returns true if switch was successful, false otherwise
 */
export async function trySwitchToTaproot(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Try Unisat
  if ((window as any).unisat) {
    try {
      const unisat = (window as any).unisat;
      
      // Try switchAddressType method
      if (typeof unisat.switchAddressType === 'function') {
        try {
          await unisat.switchAddressType('taproot');
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for switch
          const accounts = await unisat.getAccounts();
          if (accounts && accounts.length > 0 && isTaprootAddress(accounts[0])) {
            return true;
          }
        } catch (e) {
          // Method not supported
        }
      }
    } catch (error) {
      // Continue
    }
  }

  // Xverse and Leather don't typically support programmatic switching
  // They require manual account selection
  
  return false;
}

/**
 * Get Taproot address from wallet
 * 
 * Tries multiple methods to get a Taproot address from the connected wallet.
 * Returns the Taproot address if found, or throws an error with helpful message.
 */
export async function getTaprootAddress(currentAddress?: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Wallet not available in server environment');
  }

  // If current address is already Taproot, return it
  if (currentAddress && isTaprootAddress(currentAddress)) {
    return currentAddress;
  }

  // Try to get Taproot address from Unisat
  if ((window as any).unisat) {
    try {
      const unisat = (window as any).unisat;
      
      // Method 1: Try getAccounts first (might return Taproot if wallet is configured for it)
      const accounts = await unisat.getAccounts();
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        if (isTaprootAddress(address)) {
          return address;
        }
      }
      
      // Method 2: Try to switch address type programmatically
      if (typeof unisat.switchAddressType === 'function') {
        try {
          await unisat.switchAddressType('taproot');
          // Wait a bit for the switch to take effect
          await new Promise(resolve => setTimeout(resolve, 500));
          const switchedAccounts = await unisat.getAccounts();
          if (switchedAccounts && switchedAccounts.length > 0) {
            const switchedAddress = switchedAccounts[0];
            if (isTaprootAddress(switchedAddress)) {
              return switchedAddress;
            }
          }
        } catch (e) {
          // Method not supported, continue
        }
      }
      
      // Method 3: Try requesting Taproot address with addressType parameter
      if (typeof unisat.request === 'function') {
        try {
          const taprootResponse = await unisat.request('getAccounts', { 
            addressType: 'taproot' 
          });
          const taprootAccounts = Array.isArray(taprootResponse) 
            ? taprootResponse 
            : (taprootResponse?.accounts || []);
          if (taprootAccounts.length > 0 && isTaprootAddress(taprootAccounts[0])) {
            return taprootAccounts[0];
          }
        } catch (e) {
          // Method not supported, continue
        }
      }
      
      // Method 4: Try requestAccounts with addressType parameter
      if (typeof unisat.requestAccounts === 'function') {
        try {
          const taprootAccounts = await unisat.requestAccounts({ addressType: 'taproot' });
          if (taprootAccounts && taprootAccounts.length > 0 && isTaprootAddress(taprootAccounts[0])) {
            return taprootAccounts[0];
          }
        } catch (e) {
          // Method not supported, continue
        }
      }
      
      // Method 5: Check if wallet has multiple accounts and find Taproot one
      try {
        if (typeof unisat.getAccounts === 'function') {
          const allAccounts = await unisat.getAccounts();
          if (Array.isArray(allAccounts)) {
            for (const account of allAccounts) {
              if (isTaprootAddress(account)) {
                return account;
              }
            }
          }
        }
      } catch (e) {
        // Continue
      }
    } catch (error) {
      // Continue to other wallets
    }
  }

  // Try Xverse
  const xverse = (window as any).XverseProviders?.BitcoinProvider || 
                 (window as any).XverseProviders ||
                 (window as any).xverse;
  if (xverse) {
    try {
      let accounts: string[] = [];
      
      // Method 1: Try getAccounts
      if (typeof xverse.getAccounts === 'function') {
        accounts = await xverse.getAccounts();
      } else if (typeof xverse.request === 'function') {
        const response = await xverse.request('getAccounts', {});
        accounts = Array.isArray(response) ? response : (response?.accounts || []);
      }
      
      // Check if any account is Taproot
      for (const account of accounts) {
        if (isTaprootAddress(account)) {
          return account;
        }
      }
      
      // Method 2: Try requesting Taproot address specifically
      if (typeof xverse.request === 'function') {
        try {
          const taprootResponse = await xverse.request('getAccounts', { addressType: 'taproot' });
          const taprootAccounts = Array.isArray(taprootResponse) 
            ? taprootResponse 
            : (taprootResponse?.accounts || []);
          if (taprootAccounts.length > 0 && isTaprootAddress(taprootAccounts[0])) {
            return taprootAccounts[0];
          }
        } catch (e) {
          // Method not supported
        }
      }
    } catch (error) {
      // Continue to other wallets
    }
  }

  // Try Leather
  const leather = (window as any).btc || (window as any).hiroWalletProvider;
  if (leather) {
    try {
      let accounts: string[] = [];
      
      // Method 1: Try getAccounts
      if (typeof leather.getAccounts === 'function') {
        accounts = await leather.getAccounts();
      } else if (typeof leather.request === 'function') {
        const response = await leather.request('getAccounts', {});
        accounts = Array.isArray(response) ? response : (response?.accounts || []);
      }
      
      // Check if any account is Taproot
      for (const account of accounts) {
        if (isTaprootAddress(account)) {
          return account;
        }
      }
      
      // Method 2: Try requesting Taproot address specifically
      if (typeof leather.request === 'function') {
        try {
          const taprootResponse = await leather.request('getAccounts', { addressType: 'taproot' });
          const taprootAccounts = Array.isArray(taprootResponse) 
            ? taprootResponse 
            : (taprootResponse?.accounts || []);
          if (taprootAccounts.length > 0 && isTaprootAddress(taprootAccounts[0])) {
            return taprootAccounts[0];
          }
        } catch (e) {
          // Method not supported
        }
      }
    } catch (error) {
      // Continue
    }
  }

  // If we have a current address but it's not Taproot, provide helpful error
  if (currentAddress) {
    const networkName = NETWORK === 'testnet4' || NETWORK === 'testnet' ? 'testnet' : 'mainnet';
    const expectedPrefix = networkName === 'testnet' ? 'tb1p' : 'bc1p';
    
    // Detect which wallet is being used for more specific instructions
    let walletName = 'your wallet';
    let instructions = '';
    
    if ((window as any).unisat) {
      walletName = 'Unisat';
      instructions = 'In Unisat, go to Settings > Address Type and select "Taproot" or "P2TR".';
    } else if ((window as any).XverseProviders?.BitcoinProvider) {
      walletName = 'Xverse';
      instructions = 'In Xverse, ensure you are using a Taproot address. You may need to create a new account with Taproot address type.';
    } else if ((window as any).btc) {
      walletName = 'Leather';
      instructions = 'In Leather, go to Settings and ensure Taproot addresses are enabled.';
    }
    
    throw new Error(
      `Your ${walletName} address (${currentAddress.substring(0, 10)}...) is not a Taproot address. ` +
      `Charms requires a Taproot address (${expectedPrefix}... format, 62 characters). ` +
      `${instructions} ` +
      `After switching, reconnect your wallet.`
    );
  }

  // No wallet found or no Taproot address available
  throw new Error(
    `Unable to get Taproot address from wallet. ` +
    `Please ensure your wallet supports Taproot addresses and is configured to use them. ` +
    `Charms requires Taproot addresses (${NETWORK === 'testnet4' || NETWORK === 'testnet' ? 'tb1p' : 'bc1p'}... format).`
  );
}

