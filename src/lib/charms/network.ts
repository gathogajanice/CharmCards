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
 * Attempt to detect wallet name from window object
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
  if ((window as any).hiroWalletProvider) {
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
 * Attempt to switch network programmatically (if wallet supports it)
 * This will trigger the wallet's network switcher UI
 */
export async function attemptNetworkSwitch(walletName?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const detectedWallet = walletName || detectWalletName();
  
  try {
    // Unisat network switching
    if (detectedWallet === 'unisat' && (window as any).unisat) {
      try {
        const unisat = (window as any).unisat;
        
        console.log('Unisat API available:', {
          switchNetwork: typeof unisat.switchNetwork,
          request: typeof unisat.request,
          requestAccounts: typeof unisat.requestAccounts,
          getNetwork: typeof unisat.getNetwork,
        });
        
        // Method 1: Try switchNetwork with different network names
        if (typeof unisat.switchNetwork === 'function') {
          try {
            // Try 'testnet4' first
            await unisat.switchNetwork('testnet4');
            console.log('Switched to testnet4');
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
          } catch (error: any) {
            console.log('testnet4 failed, trying testnet:', error);
            // Try 'testnet' as alternative name
            try {
              await unisat.switchNetwork('testnet');
              console.log('Switched to testnet');
              await new Promise(resolve => setTimeout(resolve, 2000));
              return true;
            } catch (e: any) {
              console.log('testnet also failed:', e);
              // If user rejects, that's okay - wallet UI was shown
              if (e?.message?.includes('user') || e?.message?.includes('reject') || e?.code === 4001) {
                return false; // User cancelled, but UI was shown
              }
            }
          }
        }
        
        // Method 2: Try request method with different formats
        if (typeof unisat.request === 'function') {
          const methods = [
            { method: 'switchNetwork', params: { network: 'testnet4' } },
            { method: 'switchNetwork', params: { network: 'testnet' } },
            { method: 'wallet_switchNetwork', params: { network: 'testnet4' } },
            { method: 'wallet_switchNetwork', params: { network: 'testnet' } },
          ];
          
          for (const requestParams of methods) {
            try {
              await unisat.request(requestParams);
              console.log('Network switched via request:', requestParams);
              await new Promise(resolve => setTimeout(resolve, 2000));
              return true;
            } catch (error: any) {
              console.log('Request method failed:', requestParams, error);
              if (error?.code === 4001) {
                return false; // User cancelled
              }
              // Continue to next method
            }
          }
        }
        
        // Method 3: Check if there's a getNetwork method and try to set it
        if (typeof unisat.getNetwork === 'function') {
          try {
            const currentNetwork = await unisat.getNetwork();
            console.log('Current Unisat network:', currentNetwork);
            // If we can get network, maybe we can set it differently
          } catch (error) {
            console.log('getNetwork failed:', error);
          }
        }
        
        // Method 4: Try to trigger network selector by disconnecting/reconnecting
        // This is a fallback - might show network selector
        console.log('All automatic methods failed, user needs to switch manually');
        return false;
      } catch (error: any) {
        console.error('Failed to switch Unisat network:', error);
        return false;
      }
    }
    
    // Xverse network switching - uses wallet_changeNetwork method
    if (detectedWallet === 'xverse' && (window as any).XverseProviders) {
      try {
        const xverse = (window as any).XverseProviders?.BitcoinProvider;
        if (xverse && typeof xverse.request === 'function') {
          try {
            // Xverse uses wallet_changeNetwork method
            await xverse.request({
              method: 'wallet_changeNetwork',
              params: { network: 'testnet4' }
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
          } catch (error: any) {
            if (error?.code === 4001) {
              return false; // User cancelled
            }
            // Try alternative method
            if (typeof xverse.switchNetwork === 'function') {
              await xverse.switchNetwork('testnet4');
              await new Promise(resolve => setTimeout(resolve, 2000));
              return true;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to switch Xverse network:', error);
      }
      return false;
    }
    
    // Leather network switching
    if (detectedWallet === 'leather' && (window as any).btc) {
      try {
        const leather = (window as any).btc;
        if (leather && typeof leather.request === 'function') {
          try {
            await leather.request({
              method: 'switchNetwork',
              params: { network: 'testnet4' }
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
          } catch (error: any) {
            if (error?.code === 4001) {
              return false; // User cancelled
            }
          }
        }
        if (leather && typeof leather.switchNetwork === 'function') {
          await leather.switchNetwork('testnet4');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true;
        }
      } catch (error) {
        console.warn('Failed to switch Leather network:', error);
      }
      return false;
    }
  } catch (error) {
    console.warn('Network switch attempt failed:', error);
    return false;
  }
  
  return false;
}

