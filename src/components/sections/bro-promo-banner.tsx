"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Sparkles, Zap } from 'lucide-react';
import Image from 'next/image';

export default function BroPromoBanner() {
  return (
    <section className="relative w-full py-6 sm:py-8 overflow-hidden">
      <div className="container px-4 sm:px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-xl overflow-hidden border-2 border-dashed border-[#2A9DFF]/30"
        >
          {/* AD Label */}
          <div className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur-sm border border-[#2A9DFF]/30 rounded-full px-3 py-1">
            <span className="text-[9px] font-black text-[#2A9DFF] uppercase tracking-wider">Advertisement</span>
          </div>
          
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#2A9DFF] via-[#1a7acc] to-[#0f5a99] opacity-95" />
          <div className="absolute inset-0 bg-[url('/noise-bg.png')] opacity-10" />
          
          {/* Content - Compact Horizontal Layout */}
          <div className="relative z-10 px-6 sm:px-8 md:px-10 py-6 sm:py-7">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
              {/* Left Content */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-white/90" />
                  <span className="text-white/80 text-[10px] sm:text-[11px] font-black uppercase tracking-widest">
                    The First Charm
                  </span>
                </div>

                <h2 className="text-[24px] sm:text-[28px] md:text-[32px] font-black text-white mb-2 tracking-tight leading-[1.1] font-bricolage">
                  $BRO Token
                </h2>

                <p className="text-white/90 text-[13px] sm:text-[14px] leading-relaxed mb-4 max-w-xl mx-auto sm:mx-0">
                  The memecoin of UTXBros. Mine it, mint it, send it across chains - no bridges, just magic. That's wild, bro.
                </p>

                {/* Compact Key Points */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-4">
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
                    <Zap className="w-3 h-3 text-white" />
                    <span className="text-white text-[11px] sm:text-[12px] font-medium">Proof-of-Work</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
                    <Sparkles className="w-3 h-3 text-white" />
                    <span className="text-white text-[11px] sm:text-[12px] font-medium">On Bitcoin</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
                    <ExternalLink className="w-3 h-3 text-white" />
                    <span className="text-white text-[11px] sm:text-[12px] font-medium">Cross-Chain</span>
                  </div>
                </div>
              </div>

              {/* Right Side - Logo and CTA */}
              <div className="flex-shrink-0 flex flex-col items-center gap-4">
                {/* BRO Token Logo */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <Image
                    src="https://bro.charms.dev/assets/bro-token-DsXLIv23.jpg"
                    alt="$BRO Token"
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                
                {/* CTA Button */}
                <a
                  href="https://bro.charms.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 bg-white text-[#2A9DFF] font-black text-[13px] sm:text-[14px] px-5 sm:px-6 py-2.5 sm:py-3 rounded-full hover:bg-white/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <span>Mine $BRO</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Accent Line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}

