import React from "react";

/**
 * ListingsGrid Component
 * Clones the Listings section with a 4-column responsive grid layout for NFT cards 
 * (shown as placeholders as per design instructions) and a 'View all listings' outline button.
 */
const ListingsGrid: React.FC = () => {
  // Array to represent the 4 columns for the grid
  const skeletonCards = Array.from({ length: 4 });

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-medium tracking-tight text-black">
            Listings
          </h2>
        </div>

        {/* NFT Responsive Grid - 4 Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {skeletonCards.map((_, index) => (
            <div key={index} className="flex flex-col space-y-4">
              {/* Main Media Placeholder */}
              <div 
                className="w-full aspect-[4/5] bg-[#f2f2f2] rounded-2xl overflow-hidden animate-pulse" 
                aria-hidden="true"
              />
              
              {/* Metadata Placeholders */}
              <div className="space-y-3 px-1">
                {/* Title skeleton */}
                <div className="h-5 bg-[#f2f2f2] rounded-md w-3/4 animate-pulse" />
                
                {/* Creator/Details skeleton */}
                <div className="space-y-2">
                  <div className="h-3 bg-[#f2f2f2] rounded-md w-1/2 animate-pulse" />
                  <div className="h-3 bg-[#f2f2f2] rounded-md w-1/3 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Listings Button */}
        <div className="flex justify-center">
          <button 
            type="button"
            className="px-8 py-3 rounded-full border border-[#eeeeee] text-black font-semibold text-sm hover:bg-[#f2f2f2] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
          >
            View all listings
          </button>
        </div>
      </div>
    </section>
  );
};

export default ListingsGrid;