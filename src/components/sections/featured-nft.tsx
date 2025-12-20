import React from 'react';
import Image from 'next/image';

const FeaturedNFT = () => {
  // Asset 1 is likely the creator avatar, Asset 2 is likely the main NFT media
  const creatorAvatar = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/bmstmo826-4.jpg";
  const mainNFTMedia = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/efahzmsnc-6.jpg";

  return (
    <section className="w-full bg-white py-10 lg:py-20 border-b border-[#eeeeee]">
      <div className="container max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          
          {/* Large Media Preview */}
          <div className="w-full lg:w-1/2">
            <a 
              href="/@TheFour/0x1133Cc044Dd8A17D636E47eC8e3C0C846eA21FFA/7" 
              className="block relative aspect-square w-full bg-[#f2f2f2] rounded-[16px] overflow-hidden group"
            >
              <div className="absolute inset-0">
                <Image
                  src={mainNFTMedia}
                  alt="Does The World Not See US?"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                />
              </div>
            </a>
          </div>

          {/* NFT Details & Actions */}
          <div className="w-full lg:w-1/2 flex flex-col pt-2">
            {/* NFT Type Badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-[#eeeeee] rounded-full">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 1L2 4V12L8 15L14 12V4L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[12px] font-semibold uppercase tracking-wider">NFT</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[32px] md:text-[48px] font-medium leading-[1.1] tracking-tight mb-4">
              Does The World Not See US?
            </h1>

            {/* Creator Attribution */}
            <div className="flex items-center mb-6">
              <a href="/@TheFour" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[#eeeeee]">
                  <Image
                    src={creatorAvatar}
                    alt="@TheFour"
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="text-[16px] font-semibold text-black">@TheFour</span>
              </a>
            </div>

            {/* Description Text */}
            <div className="mb-8">
              <div className="text-[16px] leading-[1.6] text-[#666666] mb-2 line-clamp-5">
                You stand against a wall; you sink into it.<br />
                You rest your back against a tree, the breeze rubs you green.<br />
                You look back for a bit. Your world pauses and everybody else moves on.<br />
                You wonder if anything you do would ever be the right thing.<br />
                You leap, you jump, you scream, you turn. All you want is...
              </div>
              <a 
                href="/@TheFour/0x1133Cc044Dd8A17D636E47eC8e3C0C846eA21FFA/7" 
                className="text-[14px] font-semibold text-black hover:underline"
              >
                See details
              </a>
            </div>

            {/* Pricing Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-[#eeeeee] p-6 rounded-[16px]">
              {/* Reserve Pricing */}
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-[12px] font-medium text-[#666666] uppercase tracking-wider mb-1">
                    Reserve
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[24px] font-semibold">1.50</span>
                    <span className="text-[16px] font-semibold text-[#666666]">ETH</span>
                  </div>
                </div>
                <button className="w-full bg-black text-white py-3.5 rounded-[12px] text-[16px] font-semibold hover:bg-[#333333] transition-colors">
                  Place bid
                </button>
              </div>

              {/* Buy Now Pricing */}
              <div className="flex flex-col gap-4 md:border-l md:border-[#eeeeee] md:pl-6">
                <div>
                  <div className="text-[12px] font-medium text-[#666666] uppercase tracking-wider mb-1">
                    Buy Now
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[24px] font-semibold">2.00</span>
                    <span className="text-[16px] font-semibold text-[#666666]">ETH</span>
                  </div>
                </div>
                <a 
                  href="/@TheFour/0x1133Cc044Dd8A17D636E47eC8e3C0C846eA21FFA/7" 
                  className="w-full bg-white border border-[#eeeeee] text-black py-3.5 rounded-[12px] text-[16px] font-semibold text-center hover:bg-[#f2f2f2] transition-colors"
                >
                  Buy
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedNFT;