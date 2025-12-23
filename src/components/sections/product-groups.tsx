"use client";

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { ArrowRight, ChevronLeft, ChevronRight, Heart, CreditCard, ShoppingBag, Zap } from 'lucide-react';

interface Product {
  name: string;
  priceRange: string;
  imageUrl: string;
  isOutOfStock?: boolean;
  discount?: string;
}

interface ProductGroupProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  products: Product[];
  seeMoreHref: string;
}

const ProductCard = ({ product }: { product: Product }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex flex-col gap-y-3 group min-w-[160px] sm:min-w-[200px] md:min-w-0 card-hover-effect">
      <a href={`/gift-card/${product.name.toLowerCase().replace(/\s+/g, '-')}`} className="flex flex-col">
          <div className="relative aspect-[4/5] w-full rounded-[12px] overflow-hidden bg-surface">
            <Image
              src={imageError ? 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=300&auto=format&fit=crop' : product.imageUrl}
              alt={product.name}
              fill
              className={`object-cover transition-all duration-300 ${product.isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-110'}`}
              onError={() => setImageError(true)}
            />
          
          {product.discount && !product.isOutOfStock && (
            <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-[11px] font-semibold px-2 py-0.5 rounded-full">
              {product.discount} OFF
            </div>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsLiked(!isLiked);
            }}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-sm"
          >
            <Heart size={12} className={isLiked ? 'fill-red-500 text-red-500' : 'text-foreground'} />
          </button>
          
          {product.isOutOfStock && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-[2px]">
              <span className="bg-foreground text-background text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Out of Stock
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col pt-3 px-1">
          <p className="text-foreground text-[14px] font-medium truncate group-hover:opacity-70 transition-opacity">
            {product.name}
          </p>
          <p className="text-muted-foreground text-[13px]">
            {product.priceRange}
          </p>
        </div>
      </a>
    </div>
  );
};

const ProductGroup = ({ title, subtitle, icon, products, seeMoreHref }: ProductGroupProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 250;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  return (
    <section className="py-12 border-b border-border last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            {icon && <span className="text-foreground">{icon}</span>}
            <h3 className="text-foreground text-[24px] font-semibold tracking-tight">{title}</h3>
          </div>
          {subtitle && <p className="text-muted-foreground text-[14px] mt-1">{subtitle}</p>}
        </div>
        <a 
          href={seeMoreHref} 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-[14px] font-medium transition-all group self-start sm:self-auto"
        >
          See more 
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>

      <div className="relative md:hidden">
        <button
          onClick={() => scroll('left')}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white border border-border rounded-full shadow-sm transition-all ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronLeft size={16} className="text-foreground" />
        </button>
        <button
          onClick={() => scroll('right')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white border border-border rounded-full shadow-sm transition-all ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronRight size={16} className="text-foreground" />
        </button>
        
        <div 
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product, idx) => (
            <ProductCard key={`${title}-${idx}`} product={product} />
          ))}
        </div>
      </div>

      <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-[20px]">
        {products.map((product, idx) => (
          <ProductCard key={`${title}-${idx}`} product={product} />
        ))}
      </div>
    </section>
  );
};

const ProductGroups = () => {
  // Product groups will be loaded from on-chain data
  const groups: any[] = [];

  return (
    <div className="bg-background w-full pb-16">
      <div className="container">
        {groups.map((group, idx) => (
          <ProductGroup key={idx} {...group} />
        ))}
      </div>
    </div>
  );
};

export default ProductGroups;
