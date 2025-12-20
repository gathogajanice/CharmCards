"use client";

import React from 'react';
import { Calendar, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Redemption {
  id: string;
  date: string;
  amount: number;
  brand: string;
  status: 'completed' | 'pending';
  transactionHash?: string;
}

interface RedemptionHistoryProps {
  redemptions: Redemption[];
}

export default function RedemptionHistory({ redemptions }: RedemptionHistoryProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (redemptions.length === 0) {
    return (
      <div className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-black/[0.04]">
          <h3 className="text-[14px] font-black text-black uppercase tracking-[0.15em]">Redemption History</h3>
        </div>
        <div className="px-6 py-12 text-center">
          <Clock className="w-12 h-12 text-black/20 mx-auto mb-3" />
          <p className="text-black/60 text-sm">No redemptions yet</p>
          <p className="text-black/40 text-xs mt-1">Your redemption history will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-black/[0.04]">
        <h3 className="text-[14px] font-black text-black uppercase tracking-[0.15em]">Redemption History</h3>
        <p className="text-[12px] text-[#666666] mt-0.5">Track all your gift card redemptions</p>
      </div>
      
      <div className="divide-y divide-black/[0.04]">
        {redemptions.map((redemption, index) => (
          <motion.div
            key={redemption.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="px-6 py-4 hover:bg-black/5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  redemption.status === 'completed' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-orange-100 text-orange-600'
                }`}>
                  {redemption.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-black font-medium">{redemption.brand}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      redemption.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {redemption.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-black/60">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(redemption.date)}</span>
                    </div>
                    {redemption.transactionHash && (
                      <a
                        href={`https://blockstream.info/tx/${redemption.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2A9DFF] hover:underline"
                      >
                        View TX
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-black font-black">
                  <DollarSign className="w-4 h-4" />
                  <span>{redemption.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

