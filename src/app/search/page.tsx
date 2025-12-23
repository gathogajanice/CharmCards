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

// Gift cards will be loaded from on-chain data
const allGiftCards: any[] = [];

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
