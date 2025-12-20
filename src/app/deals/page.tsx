"use client";

import { ProductCard } from '@/components/ui/product-card';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';

const dealCards = [
  {
    name: 'DoorDash',
    range: '$15 - $500',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/DoorDash_logo.svg/2560px-DoorDash_logo.svg.png',
    href: '/gift-card/doordash-us',
    category: 'food',
    discount: '10% OFF',
  },
  {
    name: 'Uber Eats',
    range: '$15 - $150',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Uber_Eats_2020_logo.svg/2560px-Uber_Eats_2020_logo.svg.png',
    href: '/gift-card/uber-eats-us',
    category: 'food',
    discount: '5% OFF',
  },
    {
      name: 'Starbucks',
      range: '$10 - $150',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010825.448-1766182140763.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/starbucks-us',
      category: 'food',
      discount: '8% OFF',
    },
    {
      name: 'Netflix',
      range: '$15 - $100',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010616.484-1766182009151.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/netflix-us',
      category: 'entertainment',
      discount: '12% OFF',
    },
  {
    name: 'Spotify',
    range: '$10 - $60',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png',
    href: '/gift-card/spotify-us',
    category: 'entertainment',
    discount: '15% OFF',
  },
    {
      name: 'Puma',
      range: '$20 - $50',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T003348.696-1766180069369.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/puma-us',
      category: 'gaming',
      discount: '7% OFF',
    },
    {
      name: 'ChatGPT',
      range: '$20 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011019.453-1766182223658.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/chatgpt-us',
      category: 'shopping',
      discount: '10% OFF',
    },
  {
    name: 'Dominos',
    range: '$10 - $100',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T140110.777-1766098833764.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/dominos-us',
    category: 'food',
    discount: '20% OFF',
  },
  {
    name: 'Target',
    range: '$10 - $500',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Target_logo.svg/2048px-Target_logo.svg.png',
    href: '/gift-card/target-us',
    category: 'shopping',
    discount: '5% OFF',
  },
  {
    name: 'Apple Music',
    range: '$10 - $100',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T141006.993-1766098833813.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/apple-music-us',
    category: 'entertainment',
    discount: '10% OFF',
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

export default function DealsPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Food', 'Gaming', 'Shopping', 'Entertainment'];

  const tabs = [
    { label: 'Gift Cards', href: '/', active: false },
    { label: 'Categories', href: '/categories', active: false },
    { label: 'Deals', href: '/deals', active: true },
  ];

  const filteredCards = activeFilter === 'All' 
    ? dealCards 
    : activeFilter === 'Food'
    ? dealCards.filter(c => c.category === 'food')
    : activeFilter === 'Gaming'
    ? dealCards.filter(c => c.category === 'gaming')
    : activeFilter === 'Shopping'
    ? dealCards.filter(c => c.category === 'shopping')
    : activeFilter === 'Entertainment'
    ? dealCards.filter(c => c.category === 'entertainment')
    : dealCards;

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
              Browse
            </h1>
          </motion.div>

          <motion.div 
            className="w-full border-b border-[rgba(0,0,0,0.1)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
              {tabs.map((tab, index) => (
                <motion.div key={tab.label}>
                  <Link
                    href={tab.href}
                    className={`
                      relative pb-4 text-[14px] sm:text-[15px] font-medium transition-colors duration-200 whitespace-nowrap block
                      ${
                        tab.active
                          ? 'text-black after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-black'
                          : 'text-[#666666] hover:text-black'
                      }
                    `}
                  >
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      whileHover={{ y: -2 }}
                      className="inline-block"
                    >
                      {tab.label}
                    </motion.span>
                  </Link>
                </motion.div>
              ))}
            </div>
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
                <option value="best">Best Deal</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
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
