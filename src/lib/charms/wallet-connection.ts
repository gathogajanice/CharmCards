/**
 * Direct Wallet Connection Utilities
 * Provides direct connection methods for Bitcoin wallets
 */

/**
 * Connect directly to Xverse wallet
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
    // Try different Xverse API methods
    let accounts: string[] = [];
    
    // Method 1: Try getAccounts if available
    if (typeof xverse.getAccounts === 'function') {
      accounts = await xverse.getAccounts();
    }
    // Method 2: Try request with getAccounts
    else if (typeof xverse.request === 'function') {
      const response = await xverse.request('getAccounts', {});
      accounts = Array.isArray(response) ? response : (response?.accounts || []);
    }
    // Method 3: Try requestAccounts (similar to Unisat)
    else if (typeof xverse.requestAccounts === 'function') {
      accounts = await xverse.requestAccounts();
    }
    else {
      throw new Error('Xverse API not available. Please ensure Xverse extension is installed and enabled.');
    }
    
    if (accounts && accounts.length > 0) {
      const address = accounts[0];
      console.log('Xverse connected directly:', address);
      return address;
    }
    
    throw new Error('No accounts found in Xverse wallet.');
  } catch (error: any) {
    console.error('Failed to connect to Xverse:', error);
    
    if (error.code === 4001 || error.message?.includes('rejected') || error.message?.includes('denied')) {
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
 */
export async function connectLeatherDirectly(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const leather = (window as any).btc;
  
  if (!leather) {
    throw new Error('Leather wallet not detected. Please install the Leather extension.');
  }

  try {
    // Request account access
    const response = await leather.request('getAccounts', {});
    
    if (response && response.length > 0) {
      const address = response[0];
      console.log('Leather connected directly:', address);
      return address;
    }
    
    return null;
  } catch (error: any) {
    console.error('Failed to connect to Leather:', error);
    
    if (error.code === 4001) {
      throw new Error('Connection rejected. Please approve the connection request in Leather.');
    }
    
    throw new Error(`Failed to connect: ${error.message || 'Unknown error'}`);
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
    // Request account access
    const accounts = await unisat.requestAccounts();
    
    if (accounts && accounts.length > 0) {
      const address = accounts[0];
      console.log('Unisat connected directly:', address);
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

