"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Sparkles, Zap } from 'lucide-react';

export default function BroPromoBanner() {
  return (
    <section className="relative w-full py-12 sm:py-16 md:py-20 overflow-hidden">
      <div className="container px-4 sm:px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-2xl overflow-hidden"
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#2A9DFF] via-[#1a7acc] to-[#0f5a99] opacity-95" />
          <div className="absolute inset-0 bg-[url('/noise-bg.png')] opacity-10" />
          
          {/* Content */}
          <div className="relative z-10 px-6 sm:px-8 md:px-12 lg:px-16 py-10 sm:py-12 md:py-16">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Left Content */}
              <div className="flex-1 text-center lg:text-left">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="flex items-center justify-center lg:justify-start gap-2 mb-4"
                >
                  <Sparkles className="w-5 h-5 text-white/90" />
                  <span className="text-white/80 text-[11px] sm:text-[12px] font-black uppercase tracking-widest">
                    Powered by Charms Protocol
                  </span>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px] font-black text-white mb-4 tracking-tighter leading-[1.1] font-bricolage"
                >
                  Meet $BRO
                  <br />
                  <span className="text-white/90">The Memecoin of UTXBros</span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-white/90 text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed mb-6 max-w-2xl mx-auto lg:mx-0"
                >
                  The first token to run on Charms protocol. Mine it, mint it, send it across chains - no bridges, just magic. That's wild, bro.
                </motion.p>

                {/* Key Points */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="flex flex-wrap gap-3 justify-center lg:justify-start mb-8"
                >
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                    <Zap className="w-4 h-4 text-white" />
                    <span className="text-white text-[13px] sm:text-[14px] font-medium">Proof-of-Work Mining</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-white text-[13px] sm:text-[14px] font-medium">Programmable on Bitcoin</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                    <ExternalLink className="w-4 h-4 text-white" />
                    <span className="text-white text-[13px] sm:text-[14px] font-medium">Cross-Chain Ready</span>
                  </div>
                </motion.div>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="flex justify-center lg:justify-start"
                >
                  <a
                    href="https://bro.charms.dev/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 bg-white text-[#2A9DFF] font-black text-[14px] sm:text-[15px] px-6 sm:px-8 py-3 sm:py-4 rounded-full hover:bg-white/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    <span>Mine $BRO Now</span>
                    <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </motion.div>
              </div>

              {/* Right Visual Element */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex-shrink-0"
              >
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56">
                  {/* BRO Logo Placeholder - Using Charms logo as fallback */}
                  <div className="w-full h-full rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-white text-[48px] sm:text-[64px] md:text-[80px] font-black mb-2 font-bricolage">
                        $BRO
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-[12px] font-medium uppercase tracking-wider">
                        UTXBros
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-white/20 rounded-full blur-sm" />
                  <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-white/20 rounded-full blur-sm" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Bottom Accent Line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}

