"use client";

import { ProductCard } from '@/components/ui/product-card';
import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ArrowLeft, Heart, ArrowRight, X } from 'lucide-react';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';

const allGiftCards = [
  { name: 'Amazon.com', range: '$10 - $2,000', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/a83ffd73-633a-4489-8c91-74d46d7fd400/public', href: '/gift-card/amazon-com', category: 'Shopping' },
  { name: 'Apple', range: '$10 - $500', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/5becebce-dc9b-4873-d884-532537598800/public', href: '/gift-card/apple-us', category: 'Tech' },
  { name: 'DoorDash', range: '$15 - $500', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/f66fee6e-f8f7-4d4f-619c-df0b5cb54900/public', href: '/gift-card/doordash-us', category: 'Food & Dining', discount: '5%' },
  { name: 'Uber', range: '$15 - $500', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/469da4fd-c457-4f04-046c-f85686cc5700/public', href: '/gift-card/uber-us', category: 'Travel' },
  { name: 'Uber Eats', range: '$15 - $150', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/c6e03a87-ceb9-4893-a3b9-3c4b64d5d900/public', href: '/gift-card/uber-eats-us', category: 'Food & Dining' },
  { name: 'Puma', range: '$20 - $50', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T003348.696-1766180069369.png?width=8000&height=8000&resize=contain', href: '/gift-card/puma-us', category: 'Gaming' },
    { name: 'Walmart', range: '$10 - $500', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T005009.811-1766181015323.png?width=8000&height=8000&resize=contain', href: '/gift-card/walmart-us', category: 'Shopping', discount: '3%' },
  { name: 'Airbnb', range: '$50 - $500', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T003720.667-1766180247288.png?width=8000&height=8000&resize=contain', href: '/gift-card/airbnb-us', category: 'Travel' },
    { name: 'Netflix', range: '$15 - $100', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010616.484-1766182009151.png?width=8000&height=8000&resize=contain', href: '/gift-card/netflix-us', category: 'Entertainment' },
    { name: 'ChatGPT', range: '$20 - $500', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011019.453-1766182223658.png?width=8000&height=8000&resize=contain', href: '/gift-card/chatgpt-us', category: 'Shopping' },
    { name: 'Sephora', range: '$10 - $500', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011402.613-1766182450035.png?width=8000&height=8000&resize=contain', href: '/gift-card/sephora-us', category: 'Shopping' },
    { name: 'Claude', range: '$20 - $500', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T011717.532-1766182645152.png?width=8000&height=8000&resize=contain', href: '/gift-card/claude-us', category: 'Shopping' },
    { name: 'Google Play', range: '$10 - $200', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/c81ac8cf-e2f3-4d23-7e32-81a5d0ca4e00/public', href: '/gift-card/google-play-us', category: 'Tech' },
    { name: 'Spotify', range: '$10 - $60', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/90b5f0c5-2dd6-4c86-e2db-fce2d5d4f400/public', href: '/gift-card/spotify-us', category: 'Entertainment' },
    { name: 'Target', range: '$10 - $500', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/4ba2a6e2-cf6d-4b8b-ab8f-e7b3b0d93a00/public', href: '/gift-card/target-us', category: 'Shopping' },
    { name: 'Best Buy', range: '$25 - $500', image: 'https://cf.spendcrypto.com/cdn-cgi/imagedelivery/6c6yD_T6YhEUbCD7KBHwGQ/e9a76f06-5f64-4fcb-0c5f-84e07c32cf00/public', href: '/gift-card/best-buy-us', category: 'Tech' },
    { name: 'Starbucks', range: '$10 - $150', image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010825.448-1766182140763.png?width=8000&height=8000&resize=contain', href: '/gift-card/starbucks-us', category: 'Food & Dining' },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  const filteredCards = allGiftCards.filter(card =>
    card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleLike = (name: string) => {
    const newLiked = new Set(likedCards);
    if (newLiked.has(name)) {
      newLiked.delete(name);
    } else {
      newLiked.add(name);
    }
    setLikedCards(newLiked);
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      <main className="max-w-[1280px] mx-auto px-4 pt-32 pb-20">
        {searchQuery ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white">
                Search results for "{searchQuery}"
              </h1>
              <p className="mt-2 text-muted-foreground">
                {filteredCards.length} gift card{filteredCards.length !== 1 ? 's' : ''} found
              </p>
            </div>

              {filteredCards.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                  {filteredCards.map((card, index) => (
                    <ProductCard 
                      key={card.name} 
                      card={{
                        ...card,
                        outOfStock: false // Assuming available if in search results for now
                      }} 
                      index={index} 
                    />
                  ))}
                </div>

            ) : (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">No gift cards found for "{searchQuery}"</p>
                <p className="text-sm text-muted-foreground mt-2">Try a different search term</p>
                <Link
                  href="/gift-cards/united-states"
                  className="mt-4 inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors"
                >
                  Browse All Cards
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Search for gift cards</h2>
            <p className="text-muted-foreground">Enter a brand name or category to find gift cards</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
