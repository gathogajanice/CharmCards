"use client";

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ExternalLink, Bitcoin, Sparkles, Gift } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

interface EpicSuccessToastProps {
  brand: string;
  image: string;
  amount: number;
  commitTxid: string;
  spellTxid: string;
  onViewWallet?: () => void;
}

// Confetti effect using CSS (lightweight alternative to canvas-confetti)
const triggerConfetti = () => {
  if (typeof window === 'undefined') return;
  
  // Create confetti elements
  const confettiCount = 50;
  const colors = ['#10b981', '#fbbf24', '#3b82f6', '#ef4444', '#8b5cf6'];
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.top = '-10px';
    confetti.style.width = `${Math.random() * 10 + 5}px`;
    confetti.style.height = confetti.style.width;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0%';
    confetti.style.pointerEvents = 'none';
    confetti.style.zIndex = '9999';
    confetti.style.opacity = '0.9';
    
    document.body.appendChild(confetti);
    
    const animation = confetti.animate(
      [
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { 
          transform: `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0
        }
      ],
      {
        duration: Math.random() * 2000 + 2000,
        easing: 'cubic-bezier(0.5, 0, 0.5, 1)'
      }
    );
    
    animation.onfinish = () => confetti.remove();
  }
};

const EpicSuccessToastContent: React.FC<EpicSuccessToastProps> = ({
  brand,
  image,
  amount,
  commitTxid,
  spellTxid,
  onViewWallet,
}) => {
  const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
  const explorerBase = NETWORK === 'testnet4'
    ? 'https://memepool.space/testnet4/tx/'
    : 'https://memepool.space/tx/';

  useEffect(() => {
    // Trigger confetti on mount
    triggerConfetti();
  }, []);

  const messages = [
    `🎉 BOOM! Your ${brand} gift card is now on Bitcoin!`,
    `🚀 Success! Your $${amount.toFixed(2)} ${brand} gift card is live!`,
    `✨ Epic! Your Bitcoin NFT gift card is minted!`,
    `🎊 Congratulations! Your gift card is on-chain!`,
  ];
  
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative w-full max-w-[500px] overflow-hidden rounded-2xl border-2 border-green-300/50 bg-gradient-to-br from-green-50 via-emerald-50 to-yellow-50 shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(251, 191, 36, 0.1) 50%, rgba(16, 185, 129, 0.1) 100%)',
      }}
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-400 via-yellow-400 to-green-400 opacity-20 blur-xl animate-pulse" />
      
      {/* Content */}
      <div className="relative p-6 space-y-4">
        {/* Header with animated icons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </motion.div>
            <h3 className="text-xl font-black text-gray-900 font-bricolage">
              🎊 Gift Card Minted! 🎊
            </h3>
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.5 }}
          >
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </motion.div>
        </div>

        {/* Brand Image and Details */}
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-green-300 shadow-lg flex-shrink-0"
          >
            <Image
              src={image}
              alt={brand}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/20 to-transparent" />
          </motion.div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-black text-gray-900 font-bricolage truncate">
              {brand}
            </h4>
            <p className="text-3xl font-black text-[#2A9DFF] font-bricolage">
              ${amount.toFixed(2)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Bitcoin NFT Gift Card</p>
          </div>
        </div>

        {/* Success Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm font-semibold text-gray-800 text-center py-2 px-4 bg-white/60 rounded-lg border border-green-200/50"
        >
          {randomMessage}
        </motion.p>

        {/* Transaction Links */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            View Transactions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <motion.a
              href={`${explorerBase}${commitTxid}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white/80 hover:bg-white border border-green-300 rounded-lg text-xs font-semibold text-gray-800 transition-colors shadow-sm"
            >
              <Bitcoin className="w-3.5 h-3.5 text-orange-500" />
              <span className="truncate">Commit TX</span>
              <ExternalLink className="w-3 h-3 text-gray-500" />
            </motion.a>
            
            <motion.a
              href={`${explorerBase}${spellTxid}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white/80 hover:bg-white border border-green-300 rounded-lg text-xs font-semibold text-gray-800 transition-colors shadow-sm"
            >
              <Gift className="w-3.5 h-3.5 text-purple-500" />
              <span className="truncate">Spell TX</span>
              <ExternalLink className="w-3 h-3 text-gray-500" />
            </motion.a>
          </div>
        </div>

        {/* View Wallet Button */}
        {onViewWallet && (
          <motion.button
            onClick={onViewWallet}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-gradient-to-r from-[#2A9DFF] to-[#1A8DFF] text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <Bitcoin className="w-4 h-4" />
            View in Wallet
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Show an epic success toast for gift card minting
 */
export function showEpicSuccessToast(props: EpicSuccessToastProps) {
  toast.custom(
    (t) => (
      <motion.div
        initial={{ opacity: 0, x: 300, scale: 0.9 }}
        animate={{ 
          opacity: t.visible ? 1 : 0, 
          x: t.visible ? 0 : 300,
          scale: t.visible ? 1 : 0.9
        }}
        exit={{ opacity: 0, x: 300, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={() => toast.dismiss(t.id)}
        className="cursor-pointer"
      >
        <EpicSuccessToastContent {...props} />
      </motion.div>
    ),
    {
      duration: 10000, // 10 seconds for epic feel
      position: 'top-right',
    }
  );
}
