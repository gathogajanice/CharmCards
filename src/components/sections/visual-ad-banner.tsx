"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';

const VisualAdBanner = () => {
  const [imageError, setImageError] = useState(false);
  const bannerImage = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_30.png";

  return (
    <section className="w-full py-16 bg-background">
      <div className="container">
        <div className="relative w-full h-[280px] sm:h-[360px] lg:h-[420px] rounded-[12px] overflow-hidden flex items-center justify-center group cursor-pointer bg-foreground">
          <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src={imageError ? 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=800&auto=format&fit=crop' : bannerImage}
                alt="Charm Cards Gift Cards Mockup"
                fill
              className="object-contain transition-transform duration-700 group-hover:scale-105"
              priority
              onError={() => setImageError(true)}
            />
          </div>

          <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-10 z-20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-background/80" />
              <span className="text-background/80 text-[11px] font-semibold uppercase tracking-wider">Featured</span>
            </div>
            <h4 className="text-background text-[24px] sm:text-[28px] lg:text-[32px] font-semibold tracking-tight mb-1">
              Ready to spend?
            </h4>
            <p className="text-background/80 text-[14px] hidden sm:block">
              Over 3,000 brands at your fingertips.
            </p>
          </div>

          <a
            href="/gift-cards/united-states"
            className="absolute bottom-6 sm:bottom-8 right-6 sm:right-10 z-20 flex items-center gap-2 px-5 py-2.5 bg-background rounded-full text-foreground text-[14px] font-medium border border-border hover:bg-secondary transition-colors"
          >
            <span>Shop Now</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
};

export default VisualAdBanner;
