"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { ChevronDown, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import GiftCardPurchase from '@/components/sections/gift-card-purchase';

// Gift card data - matches featuredGiftCards from hero section
const giftCardData: Record<string, {
  name: string;
  description: string;
  image: string;
  denominations: number[];
  customRange?: { min: number; max: number };
  country: string;
  website?: string;
}> = {
  'amazon-com': {
    name: 'Amazon.com',
    description: 'Shop millions of products on Amazon.com. Use your Bitcoin NFT gift card to purchase anything from electronics to books, clothing, and more.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T002841.206-1766179817903.png?width=8000&height=8000&resize=contain',
    denominations: [10, 25, 50, 100, 200, 500, 1000, 2000],
    customRange: { min: 10, max: 2000 },
    country: 'US',
    website: 'https://amazon.com',
  },
  'doordash-us': {
    name: 'DoorDash',
    description: 'Order food delivery from your favorite restaurants. Get meals delivered fast with your Bitcoin NFT gift card.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177180674.png',
    denominations: [15, 25, 50, 100, 200, 500],
    customRange: { min: 15, max: 500 },
    country: 'US',
    website: 'https://doordash.com',
  },
  'apple-us': {
    name: 'Apple',
    description: 'Purchase Apple products, accessories, and services. Use your Bitcoin NFT gift card for iPhones, iPads, Macs, and more.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177192472.png',
    denominations: [10, 25, 50, 100, 200, 500],
    customRange: { min: 10, max: 500 },
    country: 'US',
    website: 'https://apple.com',
  },
  'uber-eats-us': {
    name: 'Uber Eats',
    description: 'Food delivery from thousands of restaurants. Order with your Bitcoin NFT gift card and get food delivered to your door.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177226936.png',
    denominations: [15, 25, 50, 100, 150],
    customRange: { min: 15, max: 150 },
    country: 'US',
    website: 'https://ubereats.com',
  },
  'uber-us': {
    name: 'Uber',
    description: 'Ride-sharing and transportation services. Use your Bitcoin NFT gift card for rides, food delivery, and more.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T134944.605-1766098833835.png?width=8000&height=8000&resize=contain',
    denominations: [15, 25, 50, 100, 200, 500],
    customRange: { min: 15, max: 500 },
    country: 'US',
    website: 'https://uber.com',
  },
  'walmart-us': {
    name: 'Walmart',
    description: 'Shop for groceries, electronics, clothing, and more at Walmart. Your Bitcoin NFT gift card works for all purchases.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T005009.811-1766181015323.png?width=8000&height=8000&resize=contain',
    denominations: [10, 25, 50, 100, 200, 500],
    customRange: { min: 10, max: 500 },
    country: 'US',
    website: 'https://walmart.com',
  },
  'netflix-us': {
    name: 'Netflix',
    description: 'Stream movies and TV shows. Use your Bitcoin NFT gift card to pay for your Netflix subscription.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010616.484-1766182009151.png?width=8000&height=8000&resize=contain',
    denominations: [15, 25, 50, 100],
    customRange: { min: 15, max: 100 },
    country: 'US',
    website: 'https://netflix.com',
  },
  'starbucks-us': {
    name: 'Starbucks',
    description: 'Coffee, tea, and snacks at Starbucks. Use your Bitcoin NFT gift card to pay for your favorite beverages.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010825.448-1766182140763.png?width=8000&height=8000&resize=contain',
    denominations: [10, 25, 50, 100, 150],
    customRange: { min: 10, max: 150 },
    country: 'US',
    website: 'https://starbucks.com',
  },
  'nike-us': {
    name: 'Nike',
    description: 'Shop for athletic wear, shoes, and gear at Nike. Use your Bitcoin NFT gift card for all Nike products.',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T004830.670-1766180915054.png?width=8000&height=8000&resize=contain',
    denominations: [25, 50, 100, 200, 500],
    customRange: { min: 25, max: 500 },
    country: 'US',
    website: 'https://nike.com',
  },
  'expedia-us': {
    name: 'Expedia',
    description: 'Book flights, hotels, car rentals, and vacation packages. Use your Bitcoin NFT gift card to plan your next trip.',
    image: 'https://logos-world.net/wp-content/uploads/2021/08/Expedia-Logo.png',
    denominations: [25, 50, 100, 200, 500, 1000],
    customRange: { min: 25, max: 1000 },
    country: 'US',
    website: 'https://expedia.com',
  },
  // Add more gift cards as needed - these match the featuredGiftCards from hero section
};


export default function GiftCardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  // Gift card data will be loaded from on-chain data
  const card = giftCardData[slug] || null;
  
  if (!card) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="container mx-auto px-6 py-32 text-center">
          <h1 className="text-3xl font-bold mb-4">Gift Card Not Found</h1>
          <p className="text-muted-foreground mb-8">This gift card will be available after minting on-chain.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90"
          >
            Go Home
          </button>
        </div>
        <Footer />
      </div>
    );
  }
  

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container pt-24 sm:pt-28 md:pt-32 pb-16 max-w-6xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
        <nav className="flex items-center gap-2 text-[11px] sm:text-[12px] md:text-[13px] mb-8 sm:mb-10 md:mb-12 overflow-x-auto no-scrollbar whitespace-nowrap opacity-60">
          <a href="/" className="hover:text-black transition-colors">Home</a>
          <span>/</span>
          <a href="/categories" className="hover:text-black transition-colors">Gift Cards</a>
          <span>/</span>
          <span className="text-black font-semibold">{card.name}</span>
        </nav>

            {/* Minting Section */}
            <div className="mb-8">
              <div className="mb-6">
                <h1 className="text-[32px] sm:text-[40px] md:text-[48px] font-black text-black mb-3 font-bricolage">
                  {card.name} Gift Card
                </h1>
                <p className="text-[14px] sm:text-[15px] text-black/60 font-medium mb-4">
                  Mint this gift card as a Bitcoin NFT with programmable balance. Each card is secured on Bitcoin's blockchain using Charms protocol - no bridges, no third parties, just Bitcoin-native assets you truly own.
                </p>
                {card.website && (
                  <a 
                    href={card.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[12px] font-semibold text-[#2A9DFF] hover:underline mb-4"
                  >
                    Visit official website
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
              
              <GiftCardPurchase
                name={card.name}
                imageUrl={card.image}
                denominations={card.denominations}
                customRange={card.customRange}
              />
            </div>
      </main>

      <Footer />
    </div>
  );
}
