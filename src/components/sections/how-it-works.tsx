"use client";

import React from 'react';
import { CreditCard, Wallet, Clock, ArrowRight, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: "01",
    title: "Choose a Gift Card",
    description: "From Amazon to Zalando, we have it all. Choose from over 3,000 brands all over the world.",
    icon: <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />,
    features: ['3,000+ Brands', 'Global Coverage', 'All Categories'],
  },
  {
    number: "02",
    title: "Pay with crypto",
    description: "Pay with BTC, ETH, USDT, SOL, BNB, TRX, and more across multiple networks.",
    icon: <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />,
    features: ['Multiple Cryptos', 'Low Fees', 'Secure Payments'],
  },
  {
    number: "03",
    title: "Instant delivery",
    description: "Get your Gift Card delivered instantly in your account or by email, ready to be redeemed.",
    icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6" />,
    features: ['Instant Delivery', 'Email Option', 'Ready to Redeem'],
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-secondary py-20 lg:py-28">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-[32px] lg:text-[48px] font-semibold text-foreground mb-4 tracking-[-0.02em]">
            How it works
          </h2>
          <p className="text-muted-foreground text-[16px]">
            Three simple steps to start spending your crypto.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative group"
            >
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[calc(100%)] w-full h-[2px] bg-border -z-10" />
              )}
              
              <div className="bg-background rounded-[12px] p-8 lg:p-10 border border-border transition-all duration-300 hover:shadow-lg hover:border-foreground/20 h-full">
                <div 
                  className="absolute top-6 right-8 select-none pointer-events-none opacity-[0.05] text-[100px] font-bold leading-none"
                >
                  {step.number}
                </div>

                <div className="mb-6 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-secondary border border-border group-hover:bg-foreground group-hover:text-background transition-all duration-300">
                  {step.icon}
                </div>

                <div className="relative z-10">
                  <h3 className="text-foreground text-[20px] font-semibold mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">
                    {step.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {step.features.map((feature, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground bg-secondary px-3 py-1 rounded-full border border-border"
                      >
                        <CheckCircle size={12} className="text-accent" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <a 
            href="/gift-cards/united-states"
            className="flex items-center gap-2 pill-button bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Get Started Now
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
