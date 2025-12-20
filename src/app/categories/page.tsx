"use client";

import { ProductCard } from '@/components/ui/product-card';
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/sections/navbar";
import HeroBanner from "@/components/sections/hero-banner";
import Footer from "@/components/sections/footer";

const featuredGiftCards = [
  {
    name: 'Amazon.com',
    range: '$10 - $2,000',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/2560px-Amazon_logo.svg.png',
    href: '/gift-card/amazon-com',
    outOfStock: false,
    category: 'shopping',
  },
  {
    name: 'DoorDash',
    range: '$15 - $500',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/DoorDash_logo.svg/2560px-DoorDash_logo.svg.png',
    href: '/gift-card/doordash-us',
    outOfStock: false,
    category: 'food',
  },
  {
    name: 'Apple',
    range: '$10 - $500',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/800px-Apple_logo_black.svg.png',
    href: '/gift-card/apple-us',
    outOfStock: false,
    category: 'shopping',
  },
  {
    name: 'Uber Eats',
    range: '$15 - $150',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Uber_Eats_2020_logo.svg/2560px-Uber_Eats_2020_logo.svg.png',
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
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Target_logo.svg/2048px-Target_logo.svg.png',
    href: '/gift-card/target-us',
    outOfStock: false,
    category: 'shopping',
  },
  {
    name: 'Best Buy',
    range: '$25 - $500',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Best_Buy_Logo.svg/2560px-Best_Buy_Logo.svg.png',
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
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Google_Play_Store_badge_EN.svg/2560px-Google_Play_Store_badge_EN.svg.png',
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
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function CategoriesPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Popular', 'Food', 'Gaming', 'Shopping', 'Travel', 'Entertainment'];

  const filteredCards = activeFilter === 'All' 
    ? featuredGiftCards 
    : featuredGiftCards.filter(c => c.category === activeFilter.toLowerCase());

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroBanner />

      {/* Browse Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <motion.div 
            className="mb-[60px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-[48px] font-semibold leading-[1.1] tracking-[-0.02em] text-black">
              Browse
            </h1>
          </motion.div>

          <motion.div 
            className="w-full border-b border-[rgba(0,0,0,0.1)] mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
              <Link
                href="/gift-cards/united-states"
                className="relative pb-4 text-[15px] font-medium transition-colors duration-200 whitespace-nowrap text-black after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-black"
              >
                Gift Cards
              </Link>
            </div>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((filter, index) => (
                <motion.button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className="relative h-11 px-6 rounded-full font-semibold text-[14px] transition-colors duration-200 whitespace-nowrap group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {activeFilter === filter && (
                    <motion.div
                      layoutId="active-filter-bg"
                      className="absolute inset-0 bg-black rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={`relative z-10 transition-colors duration-200 ${activeFilter === filter ? 'text-white' : 'text-black group-hover:text-black'}`}>
                    {filter}
                  </span>
                  <div className={`absolute inset-0 border border-[rgba(0,0,0,0.1)] rounded-full transition-colors duration-200 ${activeFilter === filter ? 'border-transparent' : 'border-[rgba(0,0,0,0.1)] group-hover:border-black'}`} />
                </motion.button>
              ))}
            </div>

            <div className="relative group min-w-[124px]">
              <select
                className="appearance-none w-full h-11 px-5 pr-10 rounded-full border border-[rgba(0,0,0,0.1)] bg-white font-semibold text-[14px] text-black cursor-pointer hover:border-black transition-all duration-200 ease-in-out outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {filteredCards.map((card, index) => (
              <ProductCard key={card.name} card={card} index={index} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
