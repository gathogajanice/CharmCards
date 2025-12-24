"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const bannerImages = [
  "/image.png",
  "/image1.jpg",
  "/image3.jpg",
  "/image5.jpg",
];

export default function HeroBanner() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  
  const rotatingTexts = [
    "Mint gift cards as Bitcoin NFTs with programmable balance",
    "Get your gift cards directly in your Bitcoin wallet",
    "Powered by Charms protocol - no bridges, no third parties",
    "Create, transfer, and redeem gift cards on Bitcoin blockchain"
  ];

  // Preload all images for smooth transitions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      bannerImages.forEach((src) => {
        const img = new window.Image();
        img.src = src;
      });
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentSlide((prev) => (prev + 1) % bannerImages.length);
    }, 8000); // Change slide every 8 seconds
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const textTimer = setInterval(() => {
      setCurrentTextIndex((prev) => (prev + 1) % rotatingTexts.length);
    }, 4000); // Change text every 4 seconds
    return () => clearInterval(textTimer);
  }, [rotatingTexts.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
      scale: 1.05,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? "-100%" : "100%",
      opacity: 0,
      scale: 0.98,
    }),
  };

  const handleSlideChange = (index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  };

  return (
    <section className="relative w-full h-[550px] lg:h-[600px] overflow-hidden bg-black">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentSlide}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: 0.8
            },
            opacity: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
            scale: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }
          }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ 
                duration: 1.5, 
                ease: [0.16, 1, 0.3, 1]
              }}
              className="w-full h-full"
            >
              <Image
                src={bannerImages[currentSlide]}
                alt="Gift Cards Banner"
                fill
                priority={currentSlide === 0}
                className="object-cover"
                quality={90}
              />
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/30" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-16">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-3xl overflow-hidden bg-transparent shadow-2xl flex items-center justify-center">
            <img
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766104251676.png?width=8000&height=8000&resize=contain"
              alt="Charm Cards"
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </div>

          <h1 className="text-white text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-tighter text-center font-bricolage px-4">
            Charm Cards
          </h1>

          <div className="flex items-center gap-3 sm:gap-4 mt-4 flex-wrap justify-center px-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
              <span className="text-white text-[11px] sm:text-[12px] font-medium">Secure</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
              <span className="text-white text-[11px] sm:text-[12px] font-medium">Instant</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
              <span className="text-white text-[11px] sm:text-[12px] font-medium">Transferable</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
              <span className="text-white text-[11px] sm:text-[12px] font-medium">On-Chain</span>
            </div>
          </div>

          {/* Rotating Feature Text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-4 text-center"
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={currentTextIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="text-white/80 text-[12px] sm:text-[13px] font-medium px-4"
              >
                {rotatingTexts[currentTextIndex]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {bannerImages.map((_, index) => (
          <button
            key={index}
            onClick={() => handleSlideChange(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide ? "bg-white w-8" : "bg-white/50 w-2 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
