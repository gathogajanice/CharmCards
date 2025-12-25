/**
 * Direct Wallet Connection Utilities
 * Provides direct connection methods for Bitcoin wallets
 */

/**
 * Connect directly to Xverse wallet
 * Works the same way as Unisat - triggers popup for user approval
 */
export async function connectXverseDirectly(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check for Xverse in multiple possible locations
  const xverse = (window as any).XverseProviders?.BitcoinProvider || 
                 (window as any).XverseProviders ||
                 (window as any).xverse;
  
  if (!xverse) {
    throw new Error('Xverse wallet not detected. Please install the Xverse extension.');
  }

  try {
    // First check if already connected (non-blocking)
    let accounts: string[] = [];
    try {
      if (typeof xverse.getAccounts === 'function') {
        accounts = await xverse.getAccounts();
      }
    } catch (e) {
      // Not connected yet, will request below
    }
    
    // If already connected, return address
    if (accounts && accounts.length > 0) {
      console.log('Xverse already connected:', accounts[0]);
      return accounts[0];
    }
    
    // Request connection - this triggers Xverse popup (same as Unisat requestAccounts)
    // This explicitly authorizes the origin for signing transactions
    console.log('🔐 Requesting Xverse authorization for this origin...');
    console.log('Requesting Xverse connection - popup should appear...');
    
    // Method 1: Try request with getAccounts (most common - triggers popup)
    if (typeof xverse.request === 'function') {
      try {
        const response = await xverse.request('getAccounts', {});
        accounts = Array.isArray(response) ? response : (response?.accounts || []);
        if (accounts && accounts.length > 0) {
          console.log('✅ Xverse connected and authorized via request:', accounts[0]);
          return accounts[0];
        }
      } catch (reqError: any) {
        // If request fails, try other methods
        console.log('Xverse request method:', reqError);
        if (reqError?.code === 4001) {
          throw new Error('Connection rejected. Please approve the connection request in Xverse.');
        }
      }
    }
    
    // Method 2: Try getAccounts directly (might also trigger popup)
    if (accounts.length === 0 && typeof xverse.getAccounts === 'function') {
      try {
        accounts = await xverse.getAccounts();
        if (accounts && accounts.length > 0) {
          console.log('Xverse connected via getAccounts:', accounts[0]);
          return accounts[0];
        }
      } catch (getError: any) {
        console.log('Xverse getAccounts method:', getError);
        if (getError?.code === 4001) {
          throw new Error('Connection rejected. Please approve the connection request in Xverse.');
        }
      }
    }
    
    // Method 3: Try requestAccounts (similar to Unisat)
    if (accounts.length === 0 && typeof xverse.requestAccounts === 'function') {
      try {
        accounts = await xverse.requestAccounts();
        if (accounts && accounts.length > 0) {
          console.log('Xverse connected via requestAccounts:', accounts[0]);
          return accounts[0];
        }
      } catch (reqAccError: any) {
        console.log('Xverse requestAccounts method:', reqAccError);
        if (reqAccError?.code === 4001) {
          throw new Error('Connection rejected. Please approve the connection request in Xverse.');
        }
      }
    }
    
    if (accounts.length === 0) {
      throw new Error('No accounts found in Xverse wallet. Please ensure Xverse is unlocked.');
    }
    
    return accounts[0];
  } catch (error: any) {
    console.error('Failed to connect to Xverse:', error);
    
    // Provide helpful error messages (same format as Unisat)
    if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('denied') || error.message?.includes('User rejected')) {
      throw new Error('Connection rejected. Please approve the connection request in Xverse.');
    }
    
    if (error.message?.includes('not installed') || error.message?.includes('not found') || error.message?.includes('not detected')) {
      throw new Error('Xverse wallet not found. Please install the Xverse extension.');
    }
    
    throw new Error(`Failed to connect to Xverse: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Connect directly to Leather wallet
 * Works the same way as Unisat - triggers popup for user approval
 */
export async function connectLeatherDirectly(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const leather = (window as any).btc || (window as any).hiroWalletProvider;
  
  if (!leather) {
    throw new Error('Leather wallet not detected. Please install the Leather extension.');
  }

  try {
    // First check if already connected (non-blocking)
    let accounts: string[] = [];
    try {
      if (typeof leather.getAccounts === 'function') {
        accounts = await leather.getAccounts();
      }
    } catch (e) {
      // Not connected yet, will request below
    }
    
    // If already connected, return address
    if (accounts && accounts.length > 0) {
      console.log('Leather already connected:', accounts[0]);
      return accounts[0];
    }
    
    // Request connection - this triggers Leather popup (same as Unisat requestAccounts)
    // This explicitly authorizes the origin for signing transactions
    console.log('🔐 Requesting Leather authorization for this origin...');
    console.log('Requesting Leather connection - popup should appear...');
    
    // Method 1: Try request with getAccounts (triggers popup)
    if (typeof leather.request === 'function') {
      try {
        const response = await leather.request('getAccounts', {});
        accounts = Array.isArray(response) ? response : (response?.accounts || []);
        if (accounts && accounts.length > 0) {
          console.log('✅ Leather connected and authorized via request:', accounts[0]);
          return accounts[0];
        }
      } catch (reqError: any) {
        console.log('Leather request method:', reqError);
        if (reqError?.code === 4001) {
          throw new Error('Connection rejected. Please approve the connection request in Leather.');
        }
      }
    }
    
    // Method 2: Try getAccounts directly (might also trigger popup)
    if (accounts.length === 0 && typeof leather.getAccounts === 'function') {
      try {
        accounts = await leather.getAccounts();
        if (accounts && accounts.length > 0) {
          console.log('Leather connected via getAccounts:', accounts[0]);
          return accounts[0];
        }
      } catch (getError: any) {
        console.log('Leather getAccounts method:', getError);
        if (getError?.code === 4001) {
          throw new Error('Connection rejected. Please approve the connection request in Leather.');
        }
      }
    }
    
    // Method 3: Try requestAccounts if available
    if (accounts.length === 0 && typeof leather.requestAccounts === 'function') {
      try {
        accounts = await leather.requestAccounts();
        if (accounts && accounts.length > 0) {
          console.log('Leather connected via requestAccounts:', accounts[0]);
          return accounts[0];
        }
      } catch (reqAccError: any) {
        console.log('Leather requestAccounts method:', reqAccError);
        if (reqAccError?.code === 4001) {
          throw new Error('Connection rejected. Please approve the connection request in Leather.');
        }
      }
    }
    
    if (accounts.length === 0) {
      throw new Error('No accounts found in Leather wallet. Please ensure Leather is unlocked.');
    }
    
    return accounts[0];
  } catch (error: any) {
    console.error('Failed to connect to Leather:', error);
    
    // Provide helpful error messages (same format as Unisat)
    if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('denied') || error.message?.includes('User rejected')) {
      throw new Error('Connection rejected. Please approve the connection request in Leather.');
    }
    
    if (error.message?.includes('not installed') || error.message?.includes('not found') || error.message?.includes('not detected')) {
      throw new Error('Leather wallet not found. Please install the Leather extension.');
    }
    
    throw new Error(`Failed to connect to Leather: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Connect directly to Unisat wallet
 * Returns the connected address or null if connection fails
 */
export async function connectUnisatDirectly(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const unisat = (window as any).unisat;
  
  if (!unisat) {
    throw new Error('Unisat wallet not detected. Please install the Unisat extension.');
  }

  try {
    // Request account access - this explicitly authorizes the origin
    // This is the key step that grants authorization for signing transactions
    console.log('🔐 Requesting Unisat authorization for this origin...');
    const accounts = await unisat.requestAccounts();
    
    if (accounts && accounts.length > 0) {
      const address = accounts[0];
      console.log('✅ Unisat connected and authorized:', address);
      return address;
    }
    
    return null;
  } catch (error: any) {
    console.error('Failed to connect to Unisat:', error);
    
    // Provide helpful error messages
    if (error.code === 4001) {
      throw new Error('Connection rejected. Please approve the connection request in Unisat.');
    }
    
    if (error.message?.includes('not installed') || error.message?.includes('not found')) {
      throw new Error('Unisat wallet not found. Please install the Unisat extension.');
    }
    
    throw new Error(`Failed to connect: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Check if Unisat is installed and available
 */
export function isUnisatAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).unisat;
}

/**
 * Get current Unisat account if already connected
 */
export async function getUnisatAccount(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  const unisat = (window as any).unisat;
  if (!unisat) return null;

  try {
    const accounts = await unisat.getAccounts();
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    return null;
  } catch (error) {
    console.warn('Failed to get Unisat account:', error);
    return null;
  }
}

/**
 * Check if Xverse is installed and available
 */
export function isXverseAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).XverseProviders?.BitcoinProvider;
}

/**
 * Check if Leather is installed and available
 */
export function isLeatherAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).btc;
}

