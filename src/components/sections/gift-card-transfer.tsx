"use client";

import React, { useState } from 'react';
import { Send, Wallet, AlertCircle, CheckCircle, Loader, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GiftCardTransferProps {
  brand: string;
  currentBalance: number;
  tokenId: string;
  onTransfer?: (amount: number, recipient: string) => Promise<void>;
}

export default function GiftCardTransfer({ 
  brand, 
  currentBalance,
  tokenId,
  onTransfer 
}: GiftCardTransferProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    
    if (!recipientAddress.trim()) {
      setErrorMessage('Please enter a recipient Bitcoin address');
      setTransferStatus('error');
      return;
    }

    if (!amount || amount <= 0) {
      setErrorMessage('Please enter a valid amount');
      setTransferStatus('error');
      return;
    }

    if (amount > currentBalance) {
      setErrorMessage(`Amount exceeds available balance of $${currentBalance.toFixed(2)}`);
      setTransferStatus('error');
      return;
    }

    setIsTransferring(true);
    setTransferStatus('idle');
    setErrorMessage('');

    try {
      if (onTransfer) {
        await onTransfer(amount, recipientAddress);
      } else {
        // Mock transfer
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      setTransferStatus('success');
      setRecipientAddress('');
      setTransferAmount('');
      setTimeout(() => {
        setTransferStatus('idle');
      }, 3000);
    } catch (error) {
      setTransferStatus('error');
      setErrorMessage('Transfer failed. Please try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  const copyTokenId = () => {
    navigator.clipboard.writeText(tokenId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickAmounts = [10, 25, 50].filter(amt => amt <= currentBalance);

  return (
    <div className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-black/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2A9DFF]/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-[#2A9DFF]" />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-black uppercase tracking-[0.15em]">Transfer Gift Card</h3>
            <p className="text-[12px] text-[#666666] mt-0.5">Send your Bitcoin NFT gift card to another wallet</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Current Balance */}
        <div className="p-4 bg-gradient-to-br from-[#2A9DFF]/10 to-[#2A9DFF]/5 rounded-xl border border-[#2A9DFF]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-black/60 uppercase tracking-wider">Available Balance</span>
            <span className="text-[10px] font-black text-[#2A9DFF] uppercase tracking-wider bg-[#2A9DFF]/10 px-2 py-1 rounded-full">
              NFT
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-black font-bricolage">
              ${currentBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Token ID */}
        <div>
          <label className="text-[12px] font-black text-black uppercase tracking-[0.15em] mb-2 block">
            NFT Token ID
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tokenId}
              readOnly
              className="flex-1 h-12 px-4 rounded-xl border border-black/[0.04] bg-black/5 text-black text-sm font-mono focus:outline-none"
            />
            <button
              onClick={copyTokenId}
              className="h-12 w-12 rounded-xl bg-black/5 hover:bg-black/10 transition-colors flex items-center justify-center"
            >
              {copied ? (
                <Check className="w-5 h-5 text-[#2A9DFF]" />
              ) : (
                <Copy className="w-5 h-5 text-black/60" />
              )}
            </button>
          </div>
        </div>

        {currentBalance > 0 ? (
          <>
            {/* Recipient Address */}
            <div>
              <label className="text-[12px] font-black text-black uppercase tracking-[0.15em] mb-2 block">
                Recipient Bitcoin Address
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => {
                  setRecipientAddress(e.target.value);
                  setTransferStatus('idle');
                  setErrorMessage('');
                }}
                placeholder="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                className="w-full h-12 px-4 rounded-xl border border-black/[0.04] bg-white text-black text-sm font-mono placeholder-black/20 focus:outline-none focus:border-[#2A9DFF] transition-colors"
              />
            </div>

            {/* Transfer Amount */}
            <div>
              <label className="text-[12px] font-black text-black uppercase tracking-[0.15em] mb-2 block">
                Amount to Transfer
              </label>
              <div className="relative mb-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30">$</span>
                <input
                  type="number"
                  min="0.01"
                  max={currentBalance}
                  step="0.01"
                  value={transferAmount}
                  onChange={(e) => {
                    setTransferAmount(e.target.value);
                    setTransferStatus('idle');
                    setErrorMessage('');
                  }}
                  placeholder="0.00"
                  className="w-full h-12 pl-8 pr-4 rounded-xl border border-black/[0.04] bg-white text-black text-lg font-medium placeholder-black/20 focus:outline-none focus:border-[#2A9DFF] transition-colors"
                />
              </div>
              
              {/* Quick Amount Buttons */}
              {quickAmounts.length > 0 && (
                <div className="flex gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        setTransferAmount(amount.toString());
                        setTransferStatus('idle');
                        setErrorMessage('');
                      }}
                      className="px-4 py-2 rounded-lg bg-black/5 text-black text-sm font-medium hover:bg-black/10 transition-colors"
                    >
                      ${amount}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setTransferAmount(currentBalance.toString());
                      setTransferStatus('idle');
                      setErrorMessage('');
                    }}
                    className="px-4 py-2 rounded-lg bg-black/5 text-black text-sm font-medium hover:bg-black/10 transition-colors"
                  >
                    Max
                  </button>
                </div>
              )}
            </div>

            {/* Status Messages */}
            <AnimatePresence>
              {transferStatus === 'error' && errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </motion.div>
              )}

              {transferStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-600">Transfer successful! NFT sent to recipient wallet.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transfer Button */}
            <button
              onClick={handleTransfer}
              disabled={isTransferring || !transferAmount || !recipientAddress || parseFloat(transferAmount) <= 0}
              className={`
                w-full h-14 rounded-xl font-black text-[15px] uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2
                ${isTransferring || !transferAmount || !recipientAddress || parseFloat(transferAmount) <= 0
                  ? 'bg-[#F2F2F2] text-[#999] cursor-not-allowed'
                  : 'bg-[#2A9DFF] text-white hover:bg-[#1A8DFF] shadow-lg shadow-[#2A9DFF]/20 hover:shadow-xl hover:shadow-[#2A9DFF]/30'
                }
              `}
            >
              {isTransferring ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Transfer ${transferAmount || '0.00'}</span>
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-black/40">
              Powered by Bitcoin • Secured by Charms Protocol
            </p>
          </>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-black/20 mx-auto mb-3" />
            <p className="text-black/60 text-sm">No balance available to transfer</p>
          </div>
        )}
      </div>
    </div>
  );
}


