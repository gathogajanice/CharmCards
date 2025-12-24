"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Bitcoin, Code, Network, ArrowLeftRight, Sparkles } from 'lucide-react';

export default function CharmsFeatures() {
  const features = [
    {
      icon: Sparkles,
      title: 'Next Generation Token Standard',
      description: 'Tokens are no longer bound to specific chains or programming languages. Charms welcome every crypto developer, and tap into every market.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Bitcoin,
      title: 'Bitcoin Native',
      description: 'Issue charms directly on Bitcoin, to BTC holders, with Bitcoin-secure ownership guarantees. Unlock access to the widest network and largest market.',
      color: 'from-[#F7931A] to-orange-600',
    },
    {
      icon: Code,
      title: 'Programmable',
      description: 'Build charms with custom issuance models and functionality while maintaining asset logic between chains.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Network,
      title: 'Chain Agnostic',
      description: 'Beam charms between chains without bridges, oracles, or indexers - Star Trek style. Purely user-run software, no trusted third parties.',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: ArrowLeftRight,
      title: 'Cross Compatible',
      description: 'Charms land on other chains under their widely adopted token standards (ERC-20, SPL, CNTs, etc) making them compatible with mainstream dapps and wallets.',
      color: 'from-indigo-500 to-purple-500',
    },
  ];

  return (
    <section className="w-full bg-gradient-to-b from-white to-black/5 py-8 sm:py-10">
      <div className="container px-4 sm:px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-8"
        >
          <h2 className="text-[20px] sm:text-[24px] font-black text-black mb-2 font-bricolage">
            Powered by Charms Protocol
          </h2>
          <p className="text-[12px] sm:text-[13px] text-black/60 max-w-xl mx-auto font-medium">
            Bitcoin NFTs secured by Charms - no bridges, no third parties
          </p>
        </motion.div>

        {/* Horizontal Scrollable Layout */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 no-scrollbar">
          <div className="flex gap-4 min-w-max">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                  className="group relative bg-white border border-black/5 rounded-xl p-4 hover:border-black/10 transition-all duration-300 hover:shadow-md flex-shrink-0 w-[280px] sm:w-[300px]"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-[13px] sm:text-[14px] font-black text-black mb-2 font-bricolage leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] sm:text-[12px] text-black/60 leading-relaxed font-medium">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-6 text-center"
        >
          <a
            href="https://docs.charms.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#2A9DFF] font-semibold text-[12px] sm:text-[13px] hover:gap-2 transition-all"
          >
            <span>Learn more about Charms</span>
            <ArrowLeftRight className="w-3 h-3" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

