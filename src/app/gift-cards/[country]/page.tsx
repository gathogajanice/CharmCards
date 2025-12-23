"use client";

import { ProductCard } from '@/components/ui/product-card';
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';

// Gift cards will be loaded from on-chain data
const giftCards: any[] = [];

export default function GiftCardsPage() {
  const params = useParams();
  const country = params.country as string;
  const countryName = country?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'United States';
  
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Ecommerce', 'Food', 'Gaming', 'Entertainment', 'Travel'];

  const filteredCards = activeFilter === 'All' 
    ? giftCards 
    : giftCards.filter(card => card.category === activeFilter.toLowerCase());

  const tabs = [
    { label: 'Gift Cards', href: `/gift-cards/${country}`, active: true },
    { label: 'Categories', href: '/categories', active: false },
    { label: 'Deals', href: '/deals', active: false },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="w-full bg-white">
        <div className="container pt-[60px]">
          <div className="mb-[60px]">
            <h1 className="text-[48px] font-semibold leading-[1.1] tracking-[-0.02em] text-black">
              {countryName}
            </h1>
          </div>

          <div className="w-full border-b border-[rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <a
                  key={tab.label}
                  href={tab.href}
                  className={`
                    relative pb-4 text-[15px] font-medium transition-colors duration-200 whitespace-nowrap
                    ${
                      tab.active
                        ? 'text-black after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-black'
                        : 'text-[#666666] hover:text-black'
                    }
                  `}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="container py-[24px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`
                    h-10 px-6 rounded-full font-semibold text-[14px] transition-all duration-200 ease-in-out border
                    ${
                      activeFilter === filter
                        ? "bg-black text-white border-black"
                        : "bg-transparent text-black border-[rgba(0,0,0,0.1)] hover:border-black"
                    }
                  `}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative group min-w-[124px]">
              <select
                className="appearance-none w-full h-10 px-5 pr-10 rounded-full border border-[rgba(0,0,0,0.1)] bg-white font-semibold text-[14px] text-black cursor-pointer hover:border-black transition-all duration-200 ease-in-out outline-none"
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
        </div>

          <div className="container pb-20">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
              {filteredCards.map((card, index) => (
                <ProductCard key={index} card={card} index={index} />
              ))}
            </div>
          </div>

      </main>

      <Footer />
    </div>
  );
}