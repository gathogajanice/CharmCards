"use client";

import { ProductCard } from '@/components/ui/product-card';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';

const trendingCards = [
  {
    name: 'Amazon.com',
    range: '$10 - $2,000',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/2560px-Amazon_logo.svg.png',
    href: '/gift-card/amazon-com',
    category: 'shopping',
    trending: 1,
  },
    {
      name: 'Netflix',
      range: '$15 - $100',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010616.484-1766182009151.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/netflix-us',
      category: 'entertainment',
      trending: 2,
    },
    {
      name: 'Starbucks',
      range: '$10 - $150',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010825.448-1766182140763.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/starbucks-us',
      category: 'food',
      trending: 3,
    },
    {
      name: 'Puma',
      range: '$20 - $50',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T003348.696-1766180069369.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/puma-us',
      category: 'gaming',
      trending: 4,
    },
  {
    name: 'Uber',
    range: '$15 - $500',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T134944.605-1766098833835.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/uber-us',
    category: 'travel',
    trending: 5,
  },
  {
    name: 'Spotify',
    range: '$10 - $60',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png',
    href: '/gift-card/spotify-us',
    category: 'entertainment',
    trending: 6,
  },
  {
    name: 'Apple',
    range: '$10 - $500',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/800px-Apple_logo_black.svg.png',
    href: '/gift-card/apple-us',
    category: 'shopping',
    trending: 7,
  },
  {
    name: 'DoorDash',
    range: '$15 - $500',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/DoorDash_logo.svg/2560px-DoorDash_logo.svg.png',
    href: '/gift-card/doordash-us',
    category: 'food',
    trending: 8,
  },
    {
      name: 'ChatGPT',
      range: '$20 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011019.453-1766182223658.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/chatgpt-us',
      category: 'shopping',
      trending: 9,
    },
    {
      name: 'Nike',
      range: '$25 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T004830.670-1766180915054.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/nike-us',
      category: 'shopping',
      trending: 10,
    },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function TrendingPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Food', 'Gaming', 'Shopping', 'Travel', 'Entertainment'];

  const filteredCards = activeFilter === 'All' 
    ? trendingCards 
    : activeFilter === 'Food'
    ? trendingCards.filter(c => c.category === 'food')
    : activeFilter === 'Gaming'
    ? trendingCards.filter(c => c.category === 'gaming')
    : activeFilter === 'Shopping'
    ? trendingCards.filter(c => c.category === 'shopping')
    : activeFilter === 'Travel'
    ? trendingCards.filter(c => c.category === 'travel')
    : activeFilter === 'Entertainment'
    ? trendingCards.filter(c => c.category === 'entertainment')
    : trendingCards;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="w-full bg-white">
        <div className="container pt-32">
          <motion.div 
            className="mb-[60px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-[36px] sm:text-[48px] font-semibold leading-[1.1] tracking-[-0.02em] text-black">
              Trending
            </h1>
            <p className="text-[#666] text-base sm:text-lg mt-4 max-w-xl">
              The most popular gift cards right now
            </p>
          </motion.div>
        </div>

        <div className="container py-[24px]">
          <motion.div 
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((filter, index) => (
                <motion.button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`
                    h-9 sm:h-10 px-3 sm:px-5 rounded-full font-semibold text-[12px] sm:text-[14px] transition-all duration-200 ease-in-out border whitespace-nowrap
                    ${
                      activeFilter === filter
                        ? "bg-black text-white border-black"
                        : "bg-transparent text-black border-[rgba(0,0,0,0.1)] hover:border-black"
                    }
                  `}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.03 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {filter}
                </motion.button>
              ))}
            </div>

            <motion.div 
              className="relative group min-w-[110px] sm:min-w-[124px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <select
                className="appearance-none w-full h-9 sm:h-10 px-4 sm:px-5 pr-8 sm:pr-10 rounded-full border border-[rgba(0,0,0,0.1)] bg-white font-semibold text-[12px] sm:text-[14px] text-black cursor-pointer hover:border-black transition-all duration-200 ease-in-out outline-none"
              >
                <option value="rank">By Rank</option>
                <option value="newest">Newest</option>
              </select>
              <svg className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </motion.div>
        </div>

          <div className="container pb-20">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
              {filteredCards.map((card, index) => (
                <ProductCard key={card.name} card={card} index={index} />
              ))}
            </div>
          </div>

      </main>
      
      <Footer />
    </div>
  );
}
