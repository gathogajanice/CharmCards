"use client";

import React from "react";
import { Search, ChevronDown, Menu } from "lucide-react";

/**
 * Foundation Header Component
 *
 * This component clones the minimalist navigation bar featuring:
 * - Foundation logo
 * - Search input with magnifying glass icon
 * - Navigation links for Feed and Trending
 * - Black 'Connect' action button
 */
const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-black/10 transition-all duration-200">
      <div className="container mx-auto px-10 h-20 flex items-center justify-between">
        {/* Left Section: Logo & Main Nav */}
        <div className="flex items-center gap-8">
          <a
            href="/"
            aria-label="Foundation logo"
            className="flex items-center transition-opacity hover:opacity-70"
          >
            <svg
              width="32"
              height="16"
              viewBox="0 0 32 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-black"
            >
              <path
                d="M0 0H7.5V16H0V0ZM12.25 0H19.75V16H12.25V0ZM24.5 0H32V16H24.5V0Z"
                fill="currentColor"
              />
            </svg>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            <a
              href="/feed"
              className="nav-link text-[15px] font-medium text-black transition-opacity hover:opacity-70"
            >
              Feed
            </a>
            <div className="relative group">
              <button
                id=":R2ii6cmH2:"
                className="flex items-center gap-1 text-[15px] font-medium text-black transition-opacity hover:opacity-70"
              >
                Trending
                <ChevronDown size={14} strokeWidth={2.5} />
              </button>
            </div>
          </nav>
        </div>

        {/* Center Section: Search Bar */}
        <div className="flex-1 max-w-[640px] px-8 hidden sm:block">
          <div className="relative group w-full">
            <input
              type="text"
              placeholder="Search galleries, exhibitions, artists or works"
              className="w-full h-10 pl-11 pr-4 bg-[#F2F2F2] rounded-full text-[14px] font-medium placeholder-[#666666] border-none focus:ring-2 focus:ring-black/5 outline-none transition-all"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none group-focus-within:text-black transition-colors">
              <Search size={16} strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <button className="pill-button bg-black text-white hover:opacity-90 transition-opacity">
              Connect
            </button>
          </div>

          {/* Mobile Search & Menu */}
          <button
            aria-label="Open search"
            className="sm:hidden flex items-center justify-center p-2 rounded-full border border-black/10 hover:bg-[#F2F2F2] transition-colors"
          >
            <Search size={16} />
          </button>
          
          <button
            aria-label="Menu"
            className="flex md:hidden items-center justify-center p-2 rounded-full border border-black/10 hover:bg-[#F2F2F2] transition-colors"
          >
            <Menu size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;