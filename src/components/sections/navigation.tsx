import React from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Menu } from 'lucide-react';

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] h-[72px] flex items-center justify-between px-6 bg-transparent backdrop-blur-[20px] transition-all duration-200">
      {/* Left Section: Logo & Links */}
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-70" aria-label="Charm Cards">
          <img 
            src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T145609.868-1766100208574.png?width=8000&height=8000&resize=contain" 
            alt="Charm Cards" 
            className="h-8 w-auto rounded-md"
          />
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-semibold text-white/90 hover:text-white transition-colors"
          >
            Gift Cards
          </Link>
          <Link
            href="/categories"
            className="text-sm font-semibold text-white transition-colors border-b-2 border-white pb-0.5"
          >
            Categories
          </Link>
        </div>
      </div>

      {/* Center Section: Search Bar */}
      <div className="flex-1 max-w-[640px] px-6">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={16} className="text-white/60" />
          </div>
          <input
            type="text"
            placeholder="Search for gift cards, categories or brands"
            className="w-full h-11 pl-11 pr-4 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/50 outline-none transition-all"
          />
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-3">
        <button className="hidden sm:block px-6 h-10 bg-white text-black font-semibold text-sm rounded-full hover:bg-white/90 transition-colors">
          Connect
        </button>
        
        {/* Mobile Search/Menu Toggle (Visual only for now) */}
        <button className="md:hidden p-2 text-white hover:bg-white/10 rounded-full">
          <Search size={20} />
        </button>
        <button className="p-2 text-white hover:bg-white/10 rounded-full" aria-label="Menu">
          <Menu size={24} />
        </button>
      </div>

      {/* Bottom Border line is subtle in original glassmorphism */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/5" />
    </nav>
  );
};

export default Navigation;
