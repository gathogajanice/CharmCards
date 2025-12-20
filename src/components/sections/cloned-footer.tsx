import React from 'react';
import Image from 'next/image';

const ClonedFooter = () => {
  // Assets from the provided list
  const logoAsset = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/dg3xoxp97-7.png";

  return (
    <footer className="w-full bg-white border-t border-[#EEEEEE] py-4 sm:py-6 md:py-8 mt-auto">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
          
          {/* Left Section: Logo & Social/Blog Links */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 md:gap-8">
            <a 
              href="/" 
              aria-label="Foundation logo"
              className="transition-opacity hover:opacity-70 flex items-center"
            >
              <div className="relative w-[84px] h-[24px]">
                <Image 
                  src={logoAsset} 
                  alt="Foundation" 
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
            </a>
            
            <div className="flex items-center gap-6">
              <a 
                href="https://twitter.com/foundation" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[14px] font-semibold text-[#000000] hover:text-[#666666] transition-colors"
              >
                Twitter
              </a>
              <a 
                href="https://instagram.com/withfoundation" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[14px] font-semibold text-[#000000] hover:text-[#666666] transition-colors"
              >
                Instagram
              </a>
              <a 
                href="/blog" 
                className="text-[14px] font-semibold text-[#000000] hover:text-[#666666] transition-colors"
              >
                Blog
              </a>
            </div>
          </div>

          {/* Right Section: Legal & Help Links */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-6 md:gap-8">
            <a 
              href="/terms" 
              className="text-[14px] font-semibold text-[#000000] hover:text-[#666666] transition-colors"
            >
              Terms of Service
            </a>
            <a 
              href="/privacy" 
              className="text-[14px] font-semibold text-[#000000] hover:text-[#666666] transition-colors"
            >
              Privacy
            </a>
            <a 
              href="https://help.foundation.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[14px] font-semibold text-[#000000] hover:text-[#666666] transition-colors"
            >
              Help
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default ClonedFooter;
