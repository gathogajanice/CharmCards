"use client";

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface GiftCardHeaderProps {
  category: string;
  categorySlug: string;
  name: string;
}

export default function GiftCardHeader({ category, categorySlug, name }: GiftCardHeaderProps) {
  return (
    <section className="bg-background border-b border-border">
      <div className="container py-6">
        <nav className="flex items-center gap-2 text-[14px]">
          <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Home
          </a>
          <ChevronRight size={14} className="text-muted-foreground" />
          <a href="/gift-cards/united-states" className="text-muted-foreground hover:text-foreground transition-colors">
            Gift Cards
          </a>
          <ChevronRight size={14} className="text-muted-foreground" />
          <a href={`/gift-cards/united-states/${categorySlug}`} className="text-muted-foreground hover:text-foreground transition-colors">
            {category}
          </a>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="text-foreground font-medium">{name}</span>
        </nav>
      </div>
    </section>
  );
}
