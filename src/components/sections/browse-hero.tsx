import React from 'react';
import Link from 'next/link';

/**
 * BrowseHero component for Foundation.app clone.
 * Features a large H1 "Browse" title and a horizontal tab navigation.
 * Adheres to the light theme and minimalist design system.
 */
const BrowseHero: React.FC = () => {
  // Tabs for the primary navigation section
  const tabs = [
    { label: 'NFTs', href: '/browse/nfts', active: true },
    { label: 'Collections', href: '/browse/collections', active: false },
    { label: 'Drops', href: '/browse/drops', active: false },
    { label: 'Galleries', href: '/browse/galleries', active: false },
  ];

  return (
    <section className="w-full bg-background pt-[60px]">
      <div className="container px-10 xl:px-10 max-w-[1440px] mx-auto">
        {/* Page Header section */}
        <div className="mb-[60px]">
          <h1 className="text-[48px] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
            Browse
          </h1>
        </div>

        {/* Tab Navigation section */}
        <div className="w-full border-b border-border">
          <div role="tablist" className="flex items-center gap-8 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <a
                key={tab.label}
                href={tab.href}
                className={`
                  relative pb-4 text-[15px] font-medium transition-colors duration-200 whitespace-nowrap
                  ${
                    tab.active
                      ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }
                `}
                aria-selected={tab.active}
              >
                {tab.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      
      {/* 
        Custom scrollbar hiding utility logic for horizontal tabs 
        (Tailwind 'no-scrollbar' assumed to be configured or handled via globals.css)
      */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};

export default BrowseHero;