"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { getTaprootAddress, isTaprootAddress } from '@/lib/charms/taproot-address';

interface TaprootAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress: string;
  onAddressSwitched: (taprootAddress: string) => void;
}

export default function TaprootAddressModal({
  isOpen,
  onClose,
  currentAddress,
  onAddressSwitched,
}: TaprootAddressModalProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [detectedTaproot, setDetectedTaproot] = useState<string | null>(null);

  // Detect which wallet is being used
  const getWalletInfo = () => {
    if (typeof window === 'undefined') return { name: 'your wallet', instructions: [] };
    
    if ((window as any).unisat) {
      return {
        name: 'Unisat',
        instructions: [
          '1. Click the Unisat extension icon in your browser',
          '2. Click the Settings icon (gear)',
          '3. Find "Address Type" or "Address Format"',
          '4. Select "Taproot" or "P2TR"',
          '5. Save the settings',
          '6. Click "I\'ve Switched" below',
        ],
      };
    } else if ((window as any).XverseProviders?.BitcoinProvider) {
      return {
        name: 'Xverse',
        instructions: [
          '1. Open Xverse wallet extension',
          '2. Go to Account Settings',
          '3. Create or switch to a Taproot account',
          '4. Ensure the address starts with "tb1p"',
          '5. Click "I\'ve Switched" below',
        ],
      };
    } else if ((window as any).btc) {
      return {
        name: 'Leather',
        instructions: [
          '1. Open Leather wallet extension',
          '2. Go to Settings',
          '3. Enable Taproot addresses',
          '4. Switch to Taproot account if available',
          '5. Click "I\'ve Switched" below',
        ],
      };
    }
    
    return {
      name: 'your wallet',
      instructions: [
        '1. Open your wallet settings',
        '2. Find address type or format options',
        '3. Switch to Taproot (tb1p... format)',
        '4. Click "I\'ve Switched" below',
      ],
    };
  };

  const walletInfo = getWalletInfo();
  const network = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
  const expectedPrefix = network === 'testnet4' || network === 'testnet' ? 'tb1p' : 'bc1p';

  // Auto-check for Taproot address periodically
  // Check the actual wallet address directly, not the prop
  useEffect(() => {
    if (!isOpen || detectedTaproot) return;

    let checkInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const performCheck = async () => {
      if (isRetrying || !isMounted) return;
      
      try {
        setIsChecking(true);
        
        // Get the actual current address from wallet, not the prop
        let actualAddress: string | null = null;
        
        // Try to get address from wallet directly - check all wallet types
        if (typeof window !== 'undefined') {
          // Try Unisat first
          if ((window as any).unisat) {
            try {
              const accounts = await (window as any).unisat.getAccounts();
              if (accounts && accounts.length > 0) {
                actualAddress = accounts[0];
              }
            } catch (e) {
              console.log('Error getting Unisat accounts in auto-check:', e);
            }
          }
          
          // Try Xverse if Unisat didn't work
          if (!actualAddress) {
            const xverse = (window as any).XverseProviders?.BitcoinProvider || 
                           (window as any).XverseProviders ||
                           (window as any).xverse;
            if (xverse) {
              try {
                let accounts: string[] = [];
                if (typeof xverse.getAccounts === 'function') {
                  accounts = await xverse.getAccounts();
                } else if (typeof xverse.request === 'function') {
                  const response = await xverse.request('getAccounts', {});
                  accounts = Array.isArray(response) ? response : (response?.accounts || []);
                }
                if (accounts.length > 0) {
                  actualAddress = accounts[0];
                }
              } catch (e) {
                console.log('Error getting Xverse accounts in auto-check:', e);
              }
            }
          }
          
          // Try Leather if others didn't work
          if (!actualAddress) {
            const leather = (window as any).btc || (window as any).hiroWalletProvider;
            if (leather) {
              try {
                let accounts: string[] = [];
                if (typeof leather.getAccounts === 'function') {
                  accounts = await leather.getAccounts();
                } else if (typeof leather.request === 'function') {
                  const response = await leather.request('getAccounts', {});
                  accounts = Array.isArray(response) ? response : (response?.accounts || []);
                }
                if (accounts.length > 0) {
                  actualAddress = accounts[0];
                }
              } catch (e) {
                console.log('Error getting Leather accounts in auto-check:', e);
              }
            }
          }
          
          // Fallback to prop address if wallet methods fail
          if (!actualAddress) {
            actualAddress = currentAddress;
          }
        }
        
        if (!actualAddress) {
          setIsChecking(false);
          return;
        }
        
        console.log('Auto-checking address:', actualAddress.substring(0, 15) + '...', 'Is Taproot:', isTaprootAddress(actualAddress));
        
        // Check if it's Taproot
        if (isTaprootAddress(actualAddress)) {
          console.log('✅ Taproot address detected in auto-check!');
          if (isMounted) {
            setDetectedTaproot(actualAddress);
            setIsChecking(false);
            if (checkInterval) clearInterval(checkInterval);
          }
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        // Not switched yet, continue checking
        console.log('Auto-check error:', error);
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      performCheck();
    }, 500);
    
    // Then check every 2 seconds
    checkInterval = setInterval(performCheck, 2000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isOpen, currentAddress, isRetrying, detectedTaproot]);

  // Auto-close and notify when Taproot address is detected
  useEffect(() => {
    if (detectedTaproot) {
      // Wait a moment then notify parent
      setTimeout(() => {
        onAddressSwitched(detectedTaproot);
        onClose();
      }, 500);
    }
  }, [detectedTaproot, onAddressSwitched, onClose]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // Get actual address from wallet directly - this ensures we get the latest address
      let actualAddress: string | null = null;
      
      if (typeof window !== 'undefined') {
        // Try Unisat first
        if ((window as any).unisat) {
          try {
            const accounts = await (window as any).unisat.getAccounts();
            if (accounts && accounts.length > 0) {
              actualAddress = accounts[0];
            }
          } catch (e) {
            console.log('Error getting Unisat accounts:', e);
          }
        }
        
        // Try Xverse
        if (!actualAddress) {
          const xverse = (window as any).XverseProviders?.BitcoinProvider || 
                         (window as any).XverseProviders ||
                         (window as any).xverse;
          if (xverse) {
            try {
              let accounts: string[] = [];
              if (typeof xverse.getAccounts === 'function') {
                accounts = await xverse.getAccounts();
              } else if (typeof xverse.request === 'function') {
                const response = await xverse.request('getAccounts', {});
                accounts = Array.isArray(response) ? response : (response?.accounts || []);
              }
              if (accounts.length > 0) {
                actualAddress = accounts[0];
              }
            } catch (e) {
              console.log('Error getting Xverse accounts:', e);
            }
          }
        }
        
        // Try Leather
        if (!actualAddress) {
          const leather = (window as any).btc || (window as any).hiroWalletProvider;
          if (leather) {
            try {
              let accounts: string[] = [];
              if (typeof leather.getAccounts === 'function') {
                accounts = await leather.getAccounts();
              } else if (typeof leather.request === 'function') {
                const response = await leather.request('getAccounts', {});
                accounts = Array.isArray(response) ? response : (response?.accounts || []);
              }
              if (accounts.length > 0) {
                actualAddress = accounts[0];
              }
            } catch (e) {
              console.log('Error getting Leather accounts:', e);
            }
          }
        }
        
        // Fallback to prop address if wallet methods fail
        if (!actualAddress) {
          actualAddress = currentAddress;
        }
      }
      
      if (!actualAddress) {
        alert('Unable to get wallet address. Please ensure your wallet is connected and unlocked.');
        setIsRetrying(false);
        return;
      }
      
      console.log('Checking address:', actualAddress.substring(0, 15) + '...');
      
      // Check if it's Taproot
      if (isTaprootAddress(actualAddress)) {
        console.log('✅ Taproot address detected!');
        setDetectedTaproot(actualAddress);
        // Small delay to show success message
        setTimeout(() => {
          onAddressSwitched(actualAddress!);
          onClose();
        }, 300);
      } else {
        // Still not Taproot, show helpful message
        alert(
          `Current address (${actualAddress.substring(0, 15)}...) is still not Taproot.\n\n` +
          `Please ensure you have:\n` +
          `1. Switched to Taproot in your wallet settings\n` +
          `2. Saved the settings\n` +
          `3. The address now starts with "${expectedPrefix}"\n\n` +
          `Then click "I've Switched" again.`
        );
        setIsRetrying(false);
      }
    } catch (error: any) {
      console.error('Error checking Taproot address:', error);
      alert(
        `Unable to detect Taproot address: ${error.message || 'Unknown error'}\n\n` +
        `Please ensure:\n` +
        `1. Your wallet is unlocked\n` +
        `2. You have switched to Taproot address type\n` +
        `3. Try clicking "I've Switched" again`
      );
      setIsRetrying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Prevent closing while checking or when Taproot is detected
      if (!open && !detectedTaproot && !isChecking && !isRetrying) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => {
        // Prevent closing when clicking outside while checking
        if (isChecking || isRetrying || detectedTaproot) {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Taproot Address Required
          </DialogTitle>
          <DialogDescription>
            Charms requires a Taproot address to mint gift cards. Your current address is not a Taproot address.
            <br />
            <span className="text-xs text-muted-foreground mt-1 block">
              Switch to Taproot in your wallet settings below. The app will automatically detect when you've switched.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Current Address:</p>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {currentAddress}
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  Required format: <code className="bg-muted px-1 rounded">{expectedPrefix}...</code> (62 characters)
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-2">How to switch to Taproot in {walletInfo.name}:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {walletInfo.instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {isChecking && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Automatically checking for Taproot address...
              </AlertDescription>
            </Alert>
          )}

          {detectedTaproot && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Taproot address detected! Switching automatically...
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleRetry}
              disabled={isRetrying || isChecking || !!detectedTaproot}
              className="flex-1"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "I've Switched"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={!!detectedTaproot}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

