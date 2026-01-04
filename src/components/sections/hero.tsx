"use client";

import { useState, useEffect } from 'react';
import React from 'react';
import { ProductCard } from '@/components/ui/product-card';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

const featuredGiftCards = [
    {
      name: 'Amazon.com',
      range: '$10 - $2,000',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T002841.206-1766179817903.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/amazon-com',
      outOfStock: false,
      category: 'shopping',
    },
  {
    name: 'DoorDash',
    range: '$15 - $500',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177180674.png',
    href: '/gift-card/doordash-us',
    outOfStock: false,
    category: 'food',
  },
  {
    name: 'Apple',
    range: '$10 - $500',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177192472.png',
    href: '/gift-card/apple-us',
    outOfStock: false,
    category: 'shopping',
  },
  {
    name: 'Uber Eats',
    range: '$15 - $150',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177226936.png',
    href: '/gift-card/uber-eats-us',
    outOfStock: false,
    category: 'food',
  },
  {
    name: 'Uber',
    range: '$15 - $500',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T134944.605-1766098833835.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/uber-us',
    outOfStock: false,
    category: 'travel',
  },
    {
      name: 'Puma',
      range: '$20 - $50',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T003348.696-1766180069369.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/puma-us',
      outOfStock: false,
      category: 'gaming',
    },
      {
        name: 'Walmart',
        range: '$10 - $500',
        image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T005009.811-1766181015323.png?width=8000&height=8000&resize=contain',
        href: '/gift-card/walmart-us',
        outOfStock: false,
        category: 'shopping',
      },
    {
      name: 'Airbnb',
      range: '$50 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T003720.667-1766180247288.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/airbnb-us',
      outOfStock: false,
      category: 'travel',
    },
    {
      name: 'Netflix',
      range: '$15 - $100',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010616.484-1766182009151.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/netflix-us',
      outOfStock: false,
      category: 'entertainment',
    },
    {
      name: 'Starbucks',
      range: '$10 - $150',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010825.448-1766182140763.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/starbucks-us',
      outOfStock: false,
      category: 'food',
    },
  {
    name: 'Feastables',
    range: '$10 - $100',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T142249.733-1766098833699.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/feastables-us',
    outOfStock: false,
    category: 'food',
  },
  {
    name: 'Apple Music',
    range: '$10 - $100',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T141006.993-1766098833813.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/apple-music-us',
    outOfStock: false,
    category: 'entertainment',
  },
  {
    name: 'Canva',
    range: '$25 - $200',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T140457.719-1766098833706.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/canva-us',
    outOfStock: false,
    category: 'shopping',
  },
  {
    name: 'Dominos',
    range: '$10 - $100',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T140110.777-1766098833764.png?width=8000&height=8000&resize=contain',
    href: '/gift-card/dominos-us',
    outOfStock: false,
    category: 'food',
  },
  {
    name: 'Spotify',
    range: '$10 - $60',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png',
    href: '/gift-card/spotify-us',
    outOfStock: false,
    category: 'entertainment',
  },
  {
    name: 'Target',
    range: '$10 - $500',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177237708.png',
    href: '/gift-card/target-us',
    outOfStock: false,
    category: 'shopping',
  },
  {
    name: 'Best Buy',
    range: '$25 - $500',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177258131.png',
    href: '/gift-card/best-buy-us',
    outOfStock: false,
    category: 'shopping',
  },
    {
      name: 'ChatGPT',
      range: '$20 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011019.453-1766182223658.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/chatgpt-us',
      outOfStock: false,
      category: 'shopping',
    },
    {
      name: 'Sephora',
      range: '$10 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011402.613-1766182450035.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/sephora-us',
      outOfStock: false,
      category: 'shopping',
    },
    {
      name: 'Claude',
      range: '$20 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011717.532-1766182645152.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/claude-us',
      outOfStock: false,
      category: 'shopping',
    },
    {
      name: 'Steam',
      range: '$25 - $200',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T003829.102-1766180323994.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/steam-us',
      outOfStock: false,
      category: 'food',
    },
  {
    name: 'Google Play',
    range: '$10 - $200',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177297240.png',
    href: '/gift-card/google-play-us',
    outOfStock: false,
    category: 'entertainment',
  },
    {
      name: 'Pampers',
      range: '$25 - $100',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T005905.360-1766181587248.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/pampers-us',
      outOfStock: false,
      category: 'shopping',
    },
    {
      name: 'Nike',
      range: '$25 - $500',
      image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T004830.670-1766180915054.png?width=8000&height=8000&resize=contain',
      href: '/gift-card/nike-us',
      outOfStock: false,
      category: 'shopping',
    },
    {
      name: 'Expedia',
      range: '$25 - $1,000',
      image: 'https://logos-world.net/wp-content/uploads/2020/11/Expedia-Logo.png',
      href: '/gift-card/expedia-us',
      outOfStock: false,
      category: 'travel',
    },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const Hero = () => {
  const [mainTab, setMainTab] = useState('gift-cards');
  const [activeFilter, setActiveFilter] = useState('All');
  const router = useRouter();
  
  // Get available categories from cards (keep original case for matching)
  const availableCategoriesMap = new Map<string, string>();
  featuredGiftCards.forEach(card => {
    const lowerCat = card.category.toLowerCase();
    const displayCat = card.category.charAt(0).toUpperCase() + card.category.slice(1);
    if (!availableCategoriesMap.has(lowerCat)) {
      availableCategoriesMap.set(lowerCat, displayCat);
    }
  });
  
  const availableCategories = Array.from(availableCategoriesMap.values());
  
  // Build filters array dynamically, excluding Shopping and Gaming
  const excludedFilters = ['Shopping', 'Gaming'];
  const filteredCategories = availableCategories.filter(cat => !excludedFilters.includes(cat));
  const filters = ['All', 'Popular', ...filteredCategories];
  
  // Filter cards based on active filter
  const filteredCards = React.useMemo(() => {
    if (activeFilter === 'All') {
      return featuredGiftCards;
    }
    
    if (activeFilter === 'Popular') {
      // Show first 10 cards as popular
      return featuredGiftCards.slice(0, 10);
    }
    
    // Match category - normalize both to lowercase for comparison
    const normalizedFilter = activeFilter.toLowerCase().trim();
    return featuredGiftCards.filter(card => {
      const normalizedCategory = card.category.toLowerCase().trim();
      return normalizedCategory === normalizedFilter;
    });
  }, [activeFilter]);

  const displayCards = filteredCards;

  // Scroll to cards section when filter changes
  useEffect(() => {
    if (activeFilter !== 'All') {
      const cardsSection = document.getElementById('gift-cards-section');
      if (cardsSection) {
        setTimeout(() => {
          cardsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [activeFilter, displayCards.length]);

  return (
    <section className="w-full bg-white relative">
      <div className="container pt-12 sm:pt-16 md:pt-20 px-4 sm:px-6 md:px-8">
        <motion.div 
          className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#2A9DFF] font-black uppercase tracking-[0.3em] text-[10px] sm:text-[11px] md:text-[12px]">Bitcoin NFT Gift Cards</span>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#F7931A]/10 rounded-full border border-[#F7931A]/20">
                  <svg className="w-2.5 h-2.5 text-[#F7931A]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.243 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546z"/>
                  </svg>
                  <span className="text-[8px] font-black text-[#F7931A] uppercase tracking-wider">BTC</span>
                </div>
                <span className="text-[9px] text-black/40 font-medium">• Powered by Charms</span>
              </div>
              <h1 className="text-[36px] sm:text-[48px] md:text-[64px] lg:text-[80px] font-black leading-[0.9] tracking-tighter text-black font-bricolage">
                Gift Cards
              </h1>
              <p className="text-[14px] sm:text-[15px] md:text-[16px] text-black/60 font-medium max-w-2xl mt-2">
                Bitcoin NFTs with programmable balance. Each card is secured on Bitcoin's blockchain using Charms protocol - no bridges, no third parties, just Bitcoin-native assets you truly own. Select a card to create.
              </p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 bg-black/5 p-1.5 rounded-full backdrop-blur-md border border-black/5">
              <button 
                onClick={() => setMainTab('gift-cards')}
                className={`px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-full font-black text-[12px] sm:text-[13px] md:text-[14px] font-bricolage transition-all ${
                  mainTab === 'gift-cards' ? 'bg-white text-black shadow-sm scale-105' : 'text-black/40 hover:text-black hover:bg-black/5'
                }`}
              >
                Gift Cards
              </button>
              <button 
                onClick={() => router.push('/wallet')}
                className="px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-full font-black text-[12px] sm:text-[13px] md:text-[14px] font-bricolage transition-all text-black/40 hover:text-black hover:bg-black/5"
              >
                My Collection
              </button>
            </div>
          </motion.div>

          <motion.div 
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((filter, index) => {
                const handleFilterClick = () => {
                  setActiveFilter(filter);
                };
                
                return (
                <motion.button
                  key={`filter-${filter}-${index}`}
                  onClick={handleFilterClick}
                  className="relative h-10 sm:h-12 px-4 sm:px-6 md:px-8 rounded-full font-black text-[11px] sm:text-[12px] md:text-[13px] uppercase tracking-wider transition-all duration-300 font-bricolage group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {activeFilter === filter && (
                    <motion.div
                      layoutId="active-filter-bg"
                      className="absolute inset-0 bg-[#2A9DFF] rounded-full shadow-[0_10px_25px_rgba(42,157,255,0.3)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={`relative z-10 transition-colors duration-300 ${activeFilter === filter ? 'text-white' : 'text-black/60 group-hover:text-black'}`}>
                    {filter}
                  </span>
                  {activeFilter !== filter && (
                    <div className="absolute inset-0 border border-black/[0.05] group-hover:border-black/20 rounded-full transition-colors duration-300" />
                  )}
                </motion.button>
                );
              })}
            </div>
        </motion.div>

          {/* Call to Action */}
          <motion.div 
            className="mb-8 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <p className="text-[15px] sm:text-[16px] text-black/70 font-medium">
              Select any card below to create your Bitcoin NFT →
            </p>
          </motion.div>

          <div id="gift-cards-section" className="pb-16 sm:pb-24 md:pb-32">
            {displayCards.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <p className="text-black/40 text-lg font-medium mb-2">
                  No gift cards found in this category.
                </p>
                <p className="text-black/30 text-sm">
                  Try selecting a different filter or browse all cards.
                </p>
              </motion.div>
            ) : (
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 md:gap-6 lg:gap-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {displayCards.map((card, index) => (
                  <div key={card.name} className="pb-6">
                    <ProductCard card={card} index={index} />
                  </div>
                ))}
              </motion.div>
            )}
          </div>

      </div>
    </section>
  );
};

export default Hero;
