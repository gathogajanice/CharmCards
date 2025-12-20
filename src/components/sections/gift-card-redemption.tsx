"use client";

import React, { useState } from 'react';
import { DollarSign, Wallet, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GiftCardRedemptionProps {
  brand: string;
  currentBalance?: number;
  maxBalance?: number;
  onRedeem?: (amount: number) => Promise<void>;
}

export default function GiftCardRedemption({ 
  brand, 
  currentBalance = 0, 
  maxBalance = 100,
  onRedeem 
}: GiftCardRedemptionProps) {
  const [redeemAmount, setRedeemAmount] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleRedeem = async () => {
    const amount = parseFloat(redeemAmount);
    
    if (!amount || amount <= 0) {
      setErrorMessage('Please enter a valid amount');
      setRedeemStatus('error');
      return;
    }

    if (amount > currentBalance) {
      setErrorMessage(`Amount exceeds available balance of $${currentBalance.toFixed(2)}`);
      setRedeemStatus('error');
      return;
    }

    setIsRedeeming(true);
    setRedeemStatus('idle');
    setErrorMessage('');

    try {
      if (onRedeem) {
        await onRedeem(amount);
      } else {
        // Mock redemption
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      setRedeemStatus('success');
      setRedeemAmount('');
      setTimeout(() => {
        setRedeemStatus('idle');
      }, 3000);
    } catch (error) {
      setRedeemStatus('error');
      setErrorMessage('Redemption failed. Please try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const quickAmounts = [10, 25, 50].filter(amt => amt <= currentBalance);

  return (
    <div className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm mt-6">
      <div className="px-6 py-5 border-b border-black/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2A9DFF]/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#2A9DFF]" />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-black uppercase tracking-[0.15em]">Redeem Gift Card</h3>
            <p className="text-[12px] text-[#666666] mt-0.5">Spend your Bitcoin NFT gift card balance</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Current Balance Display */}
        <div className="mb-6 p-4 bg-gradient-to-br from-[#2A9DFF]/10 to-[#2A9DFF]/5 rounded-xl border border-[#2A9DFF]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-black/60 uppercase tracking-wider">Available Balance</span>
            <span className="text-[10px] font-black text-[#2A9DFF] uppercase tracking-wider bg-[#2A9DFF]/10 px-2 py-1 rounded-full">
              NFT
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <DollarSign className="w-6 h-6 text-[#2A9DFF]" />
            <span className="text-3xl font-black text-black font-bricolage">
              {currentBalance.toFixed(2)}
            </span>
          </div>
          {currentBalance < maxBalance && (
            <div className="mt-2">
              <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentBalance / maxBalance) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-[#2A9DFF]"
                />
              </div>
              <p className="text-[11px] text-black/40 mt-1">
                ${(maxBalance - currentBalance).toFixed(2)} remaining
              </p>
            </div>
          )}
        </div>

        {currentBalance > 0 ? (
          <>
            {/* Amount Input */}
            <div className="mb-4">
              <label className="text-[12px] font-black text-black uppercase tracking-[0.15em] mb-3 block">
                Enter Amount to Redeem
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/30" />
                <input
                  type="number"
                  min="0.01"
                  max={currentBalance}
                  step="0.01"
                  value={redeemAmount}
                  onChange={(e) => {
                    setRedeemAmount(e.target.value);
                    setRedeemStatus('idle');
                    setErrorMessage('');
                  }}
                  placeholder="0.00"
                  className="w-full h-14 pl-12 pr-4 rounded-xl border border-black/[0.04] bg-white text-black text-lg font-medium placeholder-black/20 focus:outline-none focus:border-[#2A9DFF] transition-colors"
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            {quickAmounts.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] text-black/60 mb-2 uppercase tracking-wider">Quick Amounts</p>
                <div className="flex gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        setRedeemAmount(amount.toString());
                        setRedeemStatus('idle');
                        setErrorMessage('');
                      }}
                      className="px-4 py-2 rounded-lg bg-black/5 text-black text-sm font-medium hover:bg-black/10 transition-colors"
                    >
                      ${amount}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setRedeemAmount(currentBalance.toString());
                      setRedeemStatus('idle');
                      setErrorMessage('');
                    }}
                    className="px-4 py-2 rounded-lg bg-black/5 text-black text-sm font-medium hover:bg-black/10 transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>
            )}

            {/* Status Messages */}
            <AnimatePresence>
              {redeemStatus === 'error' && errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </motion.div>
              )}

              {redeemStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-600">Redemption successful! Balance updated.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Redeem Button */}
            <button
              onClick={handleRedeem}
              disabled={isRedeeming || !redeemAmount || parseFloat(redeemAmount) <= 0}
              className={`
                w-full h-14 rounded-xl font-black text-[15px] uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2
                ${isRedeeming || !redeemAmount || parseFloat(redeemAmount) <= 0
                  ? 'bg-[#F2F2F2] text-[#999] cursor-not-allowed'
                  : 'bg-[#2A9DFF] text-white hover:bg-[#1A8DFF] shadow-lg shadow-[#2A9DFF]/20 hover:shadow-xl hover:shadow-[#2A9DFF]/30'
                }
              `}
            >
              {isRedeeming ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Redeem ${redeemAmount || '0.00'}</span>
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-black/40 mt-4">
              Powered by Bitcoin • Secured by Charms Protocol
            </p>
          </>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-black/20 mx-auto mb-3" />
            <p className="text-black/60 text-sm">No balance available to redeem</p>
            <p className="text-black/40 text-xs mt-1">Purchase a gift card to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

