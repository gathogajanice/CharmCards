"use client";

import Navbar from "@/components/sections/navbar";
import HeroBanner from "@/components/sections/hero-banner";
import BroPromoBanner from "@/components/sections/bro-promo-banner";
import Hero from "@/components/sections/hero";
import Footer from "@/components/sections/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="noise-bg" />
      <div className="relative z-10">
        <Navbar />
        <HeroBanner />
        <BroPromoBanner />
        <Hero />
        <Footer />
      </div>
    </div>
  );
}
