/**
 * Network Detection and Switching Utilities
 * Automatically detects Bitcoin network and prompts user to switch to Testnet4
 */

const REQUIRED_NETWORK = 'testnet4';

/**
 * Detect Bitcoin network from address format
 * Testnet4 addresses typically start with 'tb1' (Taproot) or 'tb1p' (P2TR)
 * Mainnet addresses start with 'bc1' or 'bc1p'
 */
export function detectNetworkFromAddress(address: string): 'mainnet' | 'testnet' | 'testnet4' | 'unknown' {
  if (!address) return 'unknown';
  
  // Testnet4 Taproot addresses
  if (address.startsWith('tb1p')) {
    return 'testnet4';
  }
  
  // Testnet addresses (including testnet4)
  if (address.startsWith('tb1')) {
    // Could be testnet or testnet4, default to testnet4 for Charms
    return 'testnet4';
  }
  
  // Mainnet Taproot addresses
  if (address.startsWith('bc1p')) {
    return 'mainnet';
  }
  
  // Mainnet addresses
  if (address.startsWith('bc1')) {
    return 'mainnet';
  }
  
  // Legacy addresses - try to detect from prefix
  if (address.startsWith('1') || address.startsWith('3')) {
    // Could be either, but more likely mainnet
    return 'mainnet';
  }
  
  if (address.startsWith('m') || address.startsWith('n') || address.startsWith('2')) {
    return 'testnet4';
  }
  
  return 'unknown';
}

/**
 * Check if address is on the required network (Testnet4)
 * Also accepts 'testnet' as valid since Unisat reports testnet4 as 'testnet'
 */
export function isOnRequiredNetwork(address: string): boolean {
  const network = detectNetworkFromAddress(address);
  // Unisat reports testnet4 as 'testnet', so accept both
  return network === REQUIRED_NETWORK || (network === 'testnet' && REQUIRED_NETWORK === 'testnet4');
}

/**
 * Get network switching instructions for different wallets
 */
export function getNetworkSwitchInstructions(walletName?: string): {
  title: string;
  steps: string[];
  walletSpecific?: Record<string, string[]>;
} {
  const baseSteps = [
    'Open your Bitcoin wallet extension',
    'Look for network settings or network switcher',
    'Select "Testnet4" or "Bitcoin Testnet4"',
    'Confirm the network switch',
    'Return to this app and reconnect your wallet',
  ];

  const walletSpecific: Record<string, string[]> = {
    'unisat': [
      'Click the network indicator in Unisat wallet',
      'Select "Bitcoin Testnet4 Beta" (this is Testnet4) from the network list',
      'Confirm the switch',
    ],
    'xverse': [
      'Click the settings icon in Xverse wallet',
      'Go to "Network" settings',
      'Select "Testnet4"',
      'Save and reconnect',
    ],
    'leather': [
      'Click the network dropdown in Leather wallet',
      'Select "Testnet4"',
      'Confirm the network change',
    ],
  };

  return {
    title: `Switch to Bitcoin Testnet4`,
    steps: baseSteps,
    walletSpecific,
  };
}

/**
 * Detect which wallet is actually connected (has accounts)
 * This checks which wallet has active accounts, not just which is installed
 */
export async function detectConnectedWallet(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // Check Unisat - see if it has accounts
  if ((window as any).unisat) {
    try {
      const accounts = await (window as any).unisat.getAccounts();
      if (accounts && accounts.length > 0) {
        return 'unisat';
      }
    } catch (e) {
      // Not connected via Unisat
    }
  }
  
  // Check Xverse - see if it has accounts
  if ((window as any).XverseProviders) {
    try {
      const xverse = (window as any).XverseProviders?.BitcoinProvider;
      if (xverse) {
        // Try to get accounts
        if (typeof xverse.getAccounts === 'function') {
          const accounts = await xverse.getAccounts();
          if (accounts && accounts.length > 0) {
            return 'xverse';
          }
        } else if (typeof xverse.request === 'function') {
          const response = await xverse.request('getAccounts', {});
          const accounts = Array.isArray(response) ? response : (response?.accounts || []);
          if (accounts && accounts.length > 0) {
            return 'xverse';
          }
        }
      }
    } catch (e) {
      // Not connected via Xverse
    }
  }
  
  // Check Leather - see if it has accounts (same pattern as Unisat and Xverse)
  const leather = (window as any).btc || (window as any).hiroWalletProvider;
  if (leather) {
    try {
      // Method 1: Try getAccounts directly
      if (typeof leather.getAccounts === 'function') {
        const accounts = await leather.getAccounts();
        if (accounts && accounts.length > 0) {
          return 'leather';
        }
      }
      // Method 2: Try request method
      if (typeof leather.request === 'function') {
        const response = await leather.request('getAccounts', {});
        const accounts = Array.isArray(response) ? response : (response?.accounts || []);
        if (accounts && accounts.length > 0) {
          return 'leather';
        }
      }
    } catch (e) {
      // Not connected via Leather
    }
  }
  
  return null;
}

/**
 * Attempt to detect wallet name from window object (installed wallets)
 * This is a fallback that just checks if wallets are installed
 */
export function detectWalletName(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Check for Unisat
  if ((window as any).unisat) {
    return 'unisat';
  }
  
  // Check for Xverse
  if ((window as any).XverseProviders) {
    return 'xverse';
  }
  
  // Check for Leather (Hiro)
  if ((window as any).btc || (window as any).hiroWalletProvider) {
    return 'leather';
  }
  
  return null;
}

/**
 * Get network directly from wallet (if supported)
 * This is more reliable than address-based detection
 * Unisat returns 'livenet' for mainnet and 'testnet' for testnet4
 */
export async function getNetworkFromWallet(walletName?: string): Promise<'mainnet' | 'testnet' | 'testnet4' | 'unknown' | null> {
  if (typeof window === 'undefined') return null;
  
  const detectedWallet = walletName || detectWalletName();
  
  try {
    // Unisat network detection
    if (detectedWallet === 'unisat' && (window as any).unisat) {
      const unisat = (window as any).unisat;
      if (typeof unisat.getNetwork === 'function') {
        try {
          const network = await unisat.getNetwork();
          console.log('Unisat network from wallet API:', network);
          // Unisat returns: 'livenet' (mainnet) or 'testnet' (which is actually testnet4)
          // Map to our network names
          if (network === 'testnet' || network === 'testnet4') {
            return 'testnet4';
          }
          if (network === 'livenet' || network === 'mainnet') {
            return 'mainnet';
          }
          return 'unknown';
        } catch (error) {
          console.warn('Failed to get network from Unisat:', error);
        }
      }
    }
    
    // Xverse network detection
    if (detectedWallet === 'xverse' && (window as any).XverseProviders) {
      const xverse = (window as any).XverseProviders?.BitcoinProvider;
      if (xverse && typeof xverse.getNetwork === 'function') {
        try {
          const network = await xverse.getNetwork();
          // Map Xverse network names
          if (network === 'testnet' || network === 'testnet4') {
            return 'testnet4';
          }
          if (network === 'mainnet' || network === 'livenet') {
            return 'mainnet';
          }
          return 'unknown';
        } catch (error) {
          console.warn('Failed to get network from Xverse:', error);
        }
      }
    }
    
    // Leather network detection
    if (detectedWallet === 'leather' && (window as any).btc) {
      const leather = (window as any).btc;
      if (leather && typeof leather.getNetwork === 'function') {
        try {
          const network = await leather.getNetwork();
          // Map Leather network names
          if (network === 'testnet' || network === 'testnet4') {
            return 'testnet4';
          }
          if (network === 'mainnet' || network === 'livenet') {
            return 'mainnet';
          }
          return 'unknown';
        } catch (error) {
          console.warn('Failed to get network from Leather:', error);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to get network from wallet:', error);
  }
  
  return null;
}

/**
 * Connect and switch network automatically for a wallet
 * First connects if not connected, then switches network
 */
export async function connectAndSwitchNetwork(walletName?: string): Promise<{ connected: boolean; switched: boolean; wallet: string | null }> {
  if (typeof window === 'undefined') return { connected: false, switched: false, wallet: null };
  
  const detectedWallet = walletName || (await detectConnectedWallet()) || detectWalletName();
  
  if (!detectedWallet) {
    return { connected: false, switched: false, wallet: null };
  }
  
  try {
    // First, ensure wallet is connected - this will trigger the popup
    let isConnected = false;
    
    if (detectedWallet === 'unisat' && (window as any).unisat) {
      try {
        const unisat = (window as any).unisat;
        // Check if already connected
        const existingAccounts = await unisat.getAccounts();
        if (existingAccounts && existingAccounts.length > 0) {
          isConnected = true;
        } else {
          // Connect - this will trigger Unisat popup
          console.log('Requesting Unisat connection...');
          const newAccounts = await unisat.requestAccounts();
          if (newAccounts && newAccounts.length > 0) {
            isConnected = true;
            console.log('Unisat connected:', newAccounts[0]);
          }
        }
      } catch (e: any) {
        console.log('Unisat connection failed:', e);
        // If user rejected, that's okay - popup was shown
        if (e?.code === 4001) {
          return { connected: false, switched: false, wallet: detectedWallet };
        }
      }
    } else if (detectedWallet === 'xverse' && (window as any).XverseProviders) {
      try {
        // Use the direct connection function which properly triggers Xverse popup
        const { connectXverseDirectly } = await import('@/lib/charms/wallet-connection');
        console.log('Requesting Xverse connection - popup should appear...');
        
        const address = await connectXverseDirectly();
        if (address) {
          isConnected = true;
          console.log('Xverse connected:', address);
        } else {
          throw new Error('Xverse connection returned no address');
        }
      } catch (e: any) {
        console.log('Xverse connection failed:', e);
        // If user rejected, that's okay - popup was shown
        if (e?.code === 4001 || e?.message?.includes('reject') || e?.message?.includes('denied') || e?.message?.includes('User rejected')) {
          return { connected: false, switched: false, wallet: detectedWallet };
        }
        // Re-throw other errors
        throw e;
      }
    } else if (detectedWallet === 'leather') {
      const leather = (window as any).btc || (window as any).hiroWalletProvider;
      if (leather) {
        try {
          // Use the direct connection function which properly triggers Leather popup (same as Unisat/Xverse)
          const { connectLeatherDirectly } = await import('@/lib/charms/wallet-connection');
          console.log('Requesting Leather connection - popup should appear...');
          
          const address = await connectLeatherDirectly();
          if (address) {
            isConnected = true;
            console.log('Leather connected:', address);
          } else {
            throw new Error('Leather connection returned no address');
          }
        } catch (e: any) {
          console.log('Leather connection failed:', e);
          // If user rejected, that's okay - popup was shown (same as Unisat/Xverse)
          if (e?.code === 4001 || e?.message?.includes('reject') || e?.message?.includes('denied') || e?.message?.includes('User rejected')) {
            return { connected: false, switched: false, wallet: detectedWallet };
          }
          throw e;
        }
      }
    }
    
    // Now attempt network switch - this may also trigger a popup
    console.log(`Attempting to switch ${detectedWallet} to Testnet4...`);
    const switched = await attemptNetworkSwitch(detectedWallet);
    
    return { connected: isConnected, switched, wallet: detectedWallet };
  } catch (error) {
    console.error('Connect and switch failed:', error);
    return { connected: false, switched: false, wallet: detectedWallet };
  }
}

/**
 * Attempt to switch network programmatically (if wallet supports it)
 * This will trigger the wallet's network switcher UI
 */
export async function attemptNetworkSwitch(walletName?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const detectedWallet = walletName || detectWalletName();
  
  if (!detectedWallet) {
    console.warn('No wallet detected for network switch');
    return false;
  }
  
  try {
    // Unisat network switching
    if (detectedWallet === 'unisat' && (window as any).unisat) {
      try {
        const unisat = (window as any).unisat;
        
        console.log('Attempting Unisat network switch...');
        
        // Method 1: Try switchNetwork (most common)
        if (typeof unisat.switchNetwork === 'function') {
          try {
            // Unisat uses 'testnet' for Testnet4
            const result = await unisat.switchNetwork('testnet');
            console.log('Unisat switchNetwork result:', result);
            // Wait for network to actually switch
            await new Promise(resolve => setTimeout(resolve, 1500));
            return true;
          } catch (error: any) {
            console.log('switchNetwork failed:', error);
            // If user rejected, return false
            if (error?.code === 4001 || error?.message?.includes('reject') || error?.message?.includes('user')) {
              return false;
            }
          }
        }
        
        // Method 2: Try request method
        if (typeof unisat.request === 'function') {
          try {
            await unisat.request({ method: 'switchNetwork', params: { network: 'testnet' } });
            await new Promise(resolve => setTimeout(resolve, 1500));
            return true;
          } catch (error: any) {
            console.log('request method failed:', error);
            if (error?.code === 4001) {
              return false;
            }
          }
        }
        
        console.log('Unisat network switch methods failed');
        return false;
      } catch (error: any) {
        console.error('Failed to switch Unisat network:', error);
        return false;
      }
    }
    
    // Xverse network switching - same pattern as Unisat
    if (detectedWallet === 'xverse' && (window as any).XverseProviders) {
      try {
        const xverse = (window as any).XverseProviders?.BitcoinProvider;
        if (!xverse) {
          console.warn('Xverse provider not found');
          return false;
        }
        
        console.log('Attempting Xverse network switch...');
        
        // Method 1: Try switchNetwork (most common, same as Unisat)
        if (typeof xverse.switchNetwork === 'function') {
          try {
            // Xverse uses 'testnet' for Testnet4 (same as Unisat)
            await xverse.switchNetwork('testnet');
            console.log('Xverse switched to testnet');
            await new Promise(resolve => setTimeout(resolve, 1500));
            return true;
          } catch (error: any) {
            console.log('Xverse switchNetwork failed, trying testnet4:', error);
            // Try 'testnet4' as alternative
            try {
              await xverse.switchNetwork('testnet4');
              console.log('Xverse switched to testnet4');
              await new Promise(resolve => setTimeout(resolve, 1500));
              return true;
            } catch (e: any) {
              console.log('Xverse testnet4 also failed:', e);
              if (e?.code === 4001 || e?.message?.includes('reject') || e?.message?.includes('user')) {
                return false; // User cancelled
              }
            }
          }
        }
        
        // Method 2: Try request method (same pattern as Unisat)
        if (typeof xverse.request === 'function') {
          const methods = [
            { method: 'switchNetwork', params: { network: 'testnet' } },
            { method: 'switchNetwork', params: { network: 'testnet4' } },
            { method: 'wallet_changeNetwork', params: { network: 'testnet4' } },
            { method: 'wallet_changeNetwork', params: { network: 'testnet' } },
          ];
          
          for (const requestParams of methods) {
            try {
              await xverse.request(requestParams);
              console.log('Xverse network switched via request:', requestParams);
              await new Promise(resolve => setTimeout(resolve, 1500));
              return true;
            } catch (error: any) {
              console.log('Xverse request method failed:', requestParams, error);
              if (error?.code === 4001) {
                return false; // User cancelled
              }
              // Continue to next method
            }
          }
        }
        
        console.log('Xverse network switch methods failed');
        return false;
      } catch (error) {
        console.warn('Failed to switch Xverse network:', error);
        return false;
      }
    }
    
    // Leather network switching - same pattern as Unisat
    if (detectedWallet === 'leather') {
      const leather = (window as any).btc || (window as any).hiroWalletProvider;
      if (!leather) {
        console.warn('Leather provider not found');
        return false;
      }
      
      try {
        console.log('Attempting Leather network switch...');
        
        // Method 1: Try switchNetwork (same as Unisat)
        if (typeof leather.switchNetwork === 'function') {
          try {
            // Leather uses 'testnet' for Testnet4 (same as Unisat)
            await leather.switchNetwork('testnet');
            console.log('Leather switched to testnet');
            await new Promise(resolve => setTimeout(resolve, 1500));
            return true;
          } catch (error: any) {
            console.log('Leather switchNetwork failed, trying testnet4:', error);
            // Try 'testnet4' as alternative
            try {
              await leather.switchNetwork('testnet4');
              console.log('Leather switched to testnet4');
              await new Promise(resolve => setTimeout(resolve, 1500));
              return true;
            } catch (e: any) {
              console.log('Leather testnet4 also failed:', e);
              if (e?.code === 4001 || e?.message?.includes('reject') || e?.message?.includes('user')) {
                return false; // User cancelled
              }
            }
          }
        }
        
        // Method 2: Try request method (same pattern as Unisat)
        if (typeof leather.request === 'function') {
          const methods = [
            { method: 'switchNetwork', params: { network: 'testnet' } },
            { method: 'switchNetwork', params: { network: 'testnet4' } },
          ];
          
          for (const requestParams of methods) {
            try {
              await leather.request(requestParams);
              console.log('Leather network switched via request:', requestParams);
              await new Promise(resolve => setTimeout(resolve, 1500));
              return true;
            } catch (error: any) {
              console.log('Leather request method failed:', requestParams, error);
              if (error?.code === 4001) {
                return false; // User cancelled
              }
              // Continue to next method
            }
          }
        }
        
        console.log('Leather network switch methods failed');
        return false;
      } catch (error) {
        console.warn('Failed to switch Leather network:', error);
        return false;
      }
    }
  } catch (error) {
    console.warn('Network switch attempt failed:', error);
    return false;
  }
  
  return false;
}



