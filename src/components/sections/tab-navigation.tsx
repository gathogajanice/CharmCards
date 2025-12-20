"use client";

import React, { useState } from "react";

interface TabItem {
  id: string;
  label: string;
}

const tabs: TabItem[] = [
  { id: "home", label: "Home" },
  { id: "listings", label: "Listings" },
  { id: "sales", label: "Sales" },
  { id: "about", label: "About" },
];

/**
 * TabNavigation component replicates the horizontal tab bar with pixel perfection.
 * High-level design: Stark white background, subtle light grey border.
 * Typography: Inter font, 14px size, 500 weight.
 * Transitions: 0.2s ease-in-out for hover/active states.
 */
export default function TabNavigation() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div className="w-full bg-white border-b border-[#EEEEEE] sticky top-[72px] z-40">
      <div className="container px-6">
        <div className="flex justify-center items-center h-[72px]">
          <nav 
            role="tablist" 
            aria-label="Collection sections" 
            className="flex items-center gap-2"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-5 h-10 flex items-center justify-center transition-all duration-200 ease-in-out
                  text-[14px] font-medium leading-none whitespace-nowrap rounded-full
                  ${
                    activeTab === tab.id
                      ? "bg-[#F2F2F2] text-black"
                      : "bg-transparent text-[#666666] hover:text-black"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}