import React from 'react';
import Image from 'next/image';

/**
 * HeroHeader component for 'GM World' featuring a large background illustration,
 * a central rounded logo, and a statistics bar with user avatars.
 */
const HeroHeader: React.FC = () => {
  // Assets from the provided list
  const bgImage = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/x5jejrq44-2.jpeg";
  const centralLogo = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/t8iqlinhp-3.png";
  const avatarMark = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/m00e4omah-mark-constantine-inducil-320x320-profile-5.jpg";

  return (
    <section className="relative w-full overflow-hidden select-none">
      {/* Background Banner with dark overlay */}
      <div className="relative h-[480px] lg:h-[560px] w-full">
        <Image
          src={bgImage}
          alt="GM World Banner"
          fill
          priority
          className="object-cover"
        />
        {/* Darkening overlay for readability */}
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-6 mt-12 pointer-events-auto">
          {/* Central Logo Container */}
          <div className="relative w-24 h-24 lg:w-32 lg:h-32 rounded-[24px] overflow-hidden bg-black border-[1px] border-white/10 shadow-2xl">
            <Image
              src={centralLogo}
              alt="GM World Logo"
              fill
              className="object-cover"
            />
          </div>

          {/* Page Title */}
          <h1 className="text-white text-[48px] lg:text-[64px] font-medium tracking-tight leading-[1.1]">
            GM World
          </h1>

          {/* Statistics Bar (Pills) */}
          <div className="flex items-center gap-0.5 mt-2 overflow-hidden rounded-[16px] glass-panel border border-white/10 shadow-xl">
            {/* Creators Pill */}
            <div className="flex flex-col items-start px-6 py-4 border-r border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
              <span className="text-white/60 text-[12px] font-medium uppercase tracking-wider mb-2">
                Creators
              </span>
              <div className="flex items-center gap-3">
                <span className="text-white text-[18px] lg:text-[20px] font-semibold leading-none">
                  26
                </span>
                <div className="flex -space-x-2">
                  {[1, 2, avatarMark].map((src, i) => (
                    <div key={i} className="relative w-6 h-6 rounded-full border border-black/50 overflow-hidden bg-muted">
                      <Image 
                        src={typeof src === 'string' ? src : `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} 
                        alt="Creator" 
                        fill 
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Collectors Pill */}
            <div className="flex flex-col items-start px-6 py-4 border-r border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
              <span className="text-white/60 text-[12px] font-medium uppercase tracking-wider mb-2">
                Collectors
              </span>
              <div className="flex items-center gap-3">
                <span className="text-white text-[18px] lg:text-[20px] font-semibold leading-none">
                  52
                </span>
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="relative w-6 h-6 rounded-full border border-black/50 overflow-hidden bg-muted">
                      <Image 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 40}`} 
                        alt="Collector" 
                        fill 
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sales Pill */}
            <div className="flex flex-col items-start px-6 py-4 hover:bg-white/5 cursor-pointer transition-colors">
              <span className="text-white/60 text-[12px] font-medium uppercase tracking-wider mb-2">
                Sales
              </span>
              <div className="flex items-center">
                <span className="text-white text-[18px] lg:text-[20px] font-semibold leading-none">
                  $497K
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons (Share/More) - Bottom Right Corner */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2">
        <button className="flex items-center gap-2 px-4 h-12 rounded-full glass-panel border border-white/10 text-white font-semibold text-[14px] hover:bg-white/20 transition-all">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.5 10c-.72 0-1.37.28-1.85.74L6.15 8.44l.02-.22.02-.22 4.49-2.29C11.16 6.2 11.8 6.5 12.5 6.5c1.38 0 2.5-1.12 2.5-2.5S13.88 1.5 12.5 1.5 10 2.62 10 4c0 .22.03.43.08.64L5.59 6.94c-.48-.46-1.13-.74-1.85-.74-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5c.72 0 1.37-.28 1.85-.74l4.5 2.3c-.04.2-.07.41-.07.63 0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z" />
          </svg>
          Share
        </button>
        <button className="flex items-center justify-center w-12 h-12 rounded-full glass-panel border border-white/10 text-white hover:bg-white/20 transition-all">
          <svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor">
            <circle cx="2" cy="2" r="2" />
            <circle cx="9" cy="2" r="2" />
            <circle cx="16" cy="2" r="2" />
          </svg>
        </button>
      </div>

      {/* Tab bar container styling - to blend with the rest of the page */}
      <div className="w-full bg-white border-b border-border">
        <div className="container flex justify-center py-4">
          <nav className="flex items-center space-x-8">
            {['Home', 'Listings', 'Sales', 'About'].map((tab) => (
              <button
                key={tab}
                className={`tab-label px-2 py-1 relative ${
                  tab === 'Home' ? 'text-black' : 'text-muted-foreground'
                }`}
              >
                {tab}
                {tab === 'Home' && (
                  <span className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-black" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
};

export default HeroHeader;