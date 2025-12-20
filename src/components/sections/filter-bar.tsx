"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * FilterBar Component
 * 
 * Clones the interaction bar containing filter buttons (Live auction, Buy now, Reserve)
 * and the sort dropdown menu (Newest/Oldest) using the platform's outline button styling.
 * 
 * Based on the Foundation.app design system:
 * - Rounded capsule shape (40px border-radius)
 * - 40px height for buttons
 * - 1px solid border #0000001A
 * - Active state: Solid black background, white text
 */

export default function FilterBar() {
  const [activeFilter, setActiveFilter] = useState<string>("Live auction");
  const [sortOrder, setSortOrder] = useState<string>("Newest");

  const filters = ["Live auction", "Buy now", "Reserve"];

  return (
    <div className="container py-[24px]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left Side: Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`
                h-10 px-6 rounded-full font-semibold text-[14px] transition-all duration-200 ease-in-out border
                ${
                  activeFilter === filter
                    ? "bg-black text-white border-black"
                    : "bg-transparent text-black border-[#0000001A] hover:border-black"
                }
              `}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Right Side: Sort Dropdown */}
        <div className="relative group min-w-[124px]">
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="Sort by"
            >
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
            </select>
            
            <button
              type="button"
              className="flex items-center justify-between w-full h-10 px-5 rounded-full border border-[#0000001A] bg-white group-hover:border-black transition-all duration-200 ease-in-out"
            >
              <span className="font-semibold text-[14px] text-black mr-2">
                {sortOrder}
              </span>
              <ChevronDown 
                size={16} 
                className="text-black transition-transform duration-200 group-hover:translate-y-[1px]" 
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}