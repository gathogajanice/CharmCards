"use client";

import React, { useRef, useState, useEffect } from 'react';
import { 
  ShoppingBag, Gift, Store, Zap, UtensilsCrossed, Wrench, Tv, Smartphone, 
  Plane, Film, Gamepad2, ShoppingCart, Bed, Shirt, Home, Trophy, 
  Car, Dog, Wine, Heart, PlusSquare, Gem, CreditCard,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const categories = [
  { name: 'Ecommerce', icon: ShoppingBag, slug: 'ecommerce' },
  { name: 'Gifts', icon: Gift, slug: 'gifts' },
  { name: 'Retail', icon: Store, slug: 'retail' },
  { name: 'Quick Commerce', icon: Zap, slug: 'quick-commerce' },
  { name: 'Food', icon: UtensilsCrossed, slug: 'food' },
  { name: 'Services', icon: Wrench, slug: 'services' },
  { name: 'Streaming', icon: Tv, slug: 'streaming' },
  { name: 'Electronics', icon: Smartphone, slug: 'electronics' },
  { name: 'Travel', icon: Plane, slug: 'travel' },
  { name: 'Entertainment', icon: Film, slug: 'entertainment' },
  { name: 'Gaming', icon: Gamepad2, slug: 'gaming' },
  { name: 'Grocery', icon: ShoppingCart, slug: 'grocery' },
  { name: 'Hotels & Stays', icon: Bed, slug: 'hotels-and-stays' },
  { name: 'Fashion', icon: Shirt, slug: 'fashion' },
  { name: 'Furnishing', icon: Home, slug: 'furnishing' },
  { name: 'Sporting', icon: Trophy, slug: 'sporting' },
  { name: 'Automotive', icon: Car, slug: 'automotive' },
  { name: 'Pets', icon: Dog, slug: 'pets' },
  { name: 'Beverages', icon: Wine, slug: 'beverages' },
  { name: 'Wellness', icon: Heart, slug: 'wellness' },
  { name: 'Pharmacy', icon: PlusSquare, slug: 'pharmacy' },
  { name: 'Jewellery', icon: Gem, slug: 'jewellery' },
  { name: 'Prepaid Cards', icon: CreditCard, slug: 'prepaid-cards' },
];

export default function CategoryBanner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      return () => ref.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-16 flex flex-col items-center bg-background border-t border-border">
      <p className="text-muted-foreground text-[12px] font-semibold tracking-[0.1em] uppercase mb-8 text-center px-4">
        Explore Categories
      </p>
      
      <div className="w-full relative group">
        <button
          onClick={() => scroll('left')}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-white border border-border rounded-full shadow-sm transition-all hover:border-foreground ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        
        <button
          onClick={() => scroll('right')}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-white border border-border rounded-full shadow-sm transition-all hover:border-foreground ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronRight size={18} className="text-foreground" />
        </button>

        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div 
          ref={scrollRef}
          className="flex overflow-x-auto whitespace-nowrap scrollbar-hide py-2 px-12 gap-3"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((category) => (
            <a
              key={category.name}
              href={`/gift-cards/united-states/${category.slug}`}
              onClick={() => setActiveCategory(category.slug)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 ${
                activeCategory === category.slug 
                  ? 'bg-primary text-primary-foreground border border-primary' 
                  : 'bg-transparent border border-border hover:border-foreground text-foreground'
              }`}
            >
              <category.icon 
                className="w-4 h-4"
                strokeWidth={2}
              />
              <span className="text-[14px] font-medium">
                {category.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
