import React from 'react';

const NFTCardSkeleton = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Media Container */}
      <div className="aspect-square w-full rounded-[16px] bg-[#f2f2f2] animate-pulse overflow-hidden">
        <div className="w-full h-full bg-gradient-to-br from-[#f2f2f2] to-[#eeeeee]" />
      </div>
      
      {/* Metadata Container */}
      <div className="flex flex-col gap-2 px-1">
        <div className="h-4 w-3/4 bg-[#f2f2f2] rounded-sm animate-pulse" />
        <div className="h-3 w-1/2 bg-[#f2f2f2] rounded-sm animate-pulse" />
        <div className="h-3 w-1/3 bg-[#f2f2f2] rounded-sm animate-pulse mt-1" />
      </div>
    </div>
  );
};

export default function SalesGrid() {
  // Creating an array of 8 items to fill two rows based on the screenshot layout
  const skeletonItems = Array.from({ length: 8 });

  return (
    <section className="py-[80px] bg-white">
      <div className="container px-6 max-w-[1280px] mx-auto">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[24px] font-medium leading-[1.25] text-black tracking-tight self-start">
            Sold NFTs
          </h2>
        </div>

        {/* NFT Grid - 4 Columns Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {skeletonItems.map((_, index) => (
            <NFTCardSkeleton key={index} />
          ))}
        </div>

        {/* View All Button */}
        <div className="flex justify-center mt-12">
          <button 
            type="button"
            className="inline-flex items-center justify-center px-8 h-12 rounded-full border border-[#eeeeee] bg-white text-[16px] font-semibold text-black transition-colors duration-200 hover:border-black active:scale-[0.98]"
          >
            View all sales
          </button>
        </div>
      </div>

      <style jsx global>{`
        /* Replicating the specific spacing and grid layout from the computed styles and container rules */
        .container {
          width: 100%;
          max-width: 1280px;
          margin-left: auto;
          margin-right: auto;
          padding-left: 24px;
          padding-right: 24px;
        }

        @media (min-width: 1024px) {
          .st--c-drsnmg-kPngUj-maxColumns-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}