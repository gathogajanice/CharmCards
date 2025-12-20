"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ProductCardProps {
  card: {
    name: string;
    range: string;
    image: string;
    href: string;
    outOfStock?: boolean;
    discount?: string;
  };
  index: number;
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export function ProductCard({ card, index }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ 
        y: -10,
        transition: { duration: 0.4, ease: "easeOut" }
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <Link 
        href={card.href}
        prefetch={true}
        className={`group relative flex flex-col w-full font-bricolage ${card.outOfStock ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
      >
      <div className="relative flex flex-col p-3 rounded-[2.5rem] bg-white border border-black/[0.03] shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-500 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group-hover:border-black/[0.08] overflow-hidden">
        {/* Subtle inner glow on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-black/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        <motion.div 
          className="relative aspect-square w-full rounded-[2.2rem] overflow-hidden bg-white flex items-center justify-center mb-4 border border-black/[0.04] group-hover:border-black/[0.08] transition-colors duration-500 shadow-sm"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-black/[0.01] to-transparent opacity-50" />
          
            <Image 
              src={imageError ? 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=300&auto=format&fit=crop' : card.image}
              alt={card.name}
              fill
              className={`object-cover transition-all duration-700 ${card.outOfStock ? 'grayscale opacity-50' : 'group-hover:scale-110 group-hover:rotate-2'}`}
              sizes="(max-width: 640px) 45vw, (max-width: 768px) 45vw, (max-width: 1024px) 23vw, 280px"
              onError={() => setImageError(true)}
            />
          
          {card.outOfStock && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-black text-white text-[10px] font-black px-5 py-2.5 rounded-full uppercase tracking-[0.2em] shadow-xl">
                Sold Out
              </span>
            </div>
          )}

          {card.discount && !card.outOfStock && (
            <div className="absolute top-4 left-4 bg-[#00A3FF] text-white text-[10px] font-black px-4 py-2 rounded-full shadow-[0_8px_20px_rgba(0,163,255,0.4)] uppercase tracking-wider">
              {card.discount} OFF
            </div>
          )}
        </motion.div>

        <div className="flex flex-col gap-3 px-2 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#00A3FF]/10 shadow-[0_2px_10px_rgba(0,163,255,0.1)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M12 2L13.84 3.42C14.36 3.82 15 4.02 15.65 4L18 4V6.35C18 7 18.2 7.64 18.58 8.16L20 10C20.4 10.52 20.6 11.16 20.6 11.85C20.6 12.54 20.4 13.18 20 13.7L18.58 15.54C18.2 16.06 18 16.7 18 17.35V19.7H15.65C15 19.68 14.36 19.88 13.84 20.28L12 21.7L10.16 20.28C9.64 19.88 9 19.68 8.35 19.7H6V17.35C6 16.7 5.8 16.06 5.42 15.54L4 13.7C3.6 13.18 3.4 12.54 3.4 11.85C3.4 11.16 3.6 10.52 4 10L5.42 8.16C5.8 7.64 6 7 6 6.35V4H8.35C9 4.02 9.64 3.82 10.16 3.42L12 2Z" 
                  fill="#00A3FF"
                />
                <path 
                  d="M8.5 12.5L10.5 14.5L15.5 9.5" 
                  stroke="white" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Verified</span>
          </div>

          <h3 className="text-[24px] font-black text-black leading-none truncate tracking-tight group-hover:text-[#2A9DFF] transition-colors duration-300">
            {card.name}
          </h3>

          <div className="mt-1 p-4 rounded-full bg-[#2A9DFF] hover:bg-[#1A8DFF] flex justify-between items-center transition-all duration-500 shadow-[0_10px_25px_rgba(42,157,255,0.3)] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex flex-col relative z-10">
              <span className="text-[9px] text-white/70 font-black uppercase tracking-[0.2em] mb-1">Price Range</span>
              <span className="text-[18px] font-black text-white tracking-tight leading-none">{card.range}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center relative z-10 group-hover:bg-white/30 transition-all duration-300">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      </Link>
    </motion.div>
  );
}
