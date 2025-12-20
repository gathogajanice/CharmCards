"use client";

import React, { useState } from 'react';
import { Plus, Minus, MessageCircle } from 'lucide-react';

const faqData = [
  {
    question: "What is Charm Cards?",
    answer: "Charm Cards is a premium FinTech platform that allows you to purchase gift cards from over 3,000 global brands using your favorite cryptocurrencies. We provide instant delivery and a secure checkout process for all our users."
  },
  {
    question: "Which cryptos and networks are supported?",
    answer: "We support a wide range of cryptocurrencies including BTC, ETH, LTC, SOL, TRX, BNB, and stablecoins like USDT and USDC across multiple networks such as ERC20, BEP20, Polygon, and TRC20."
  },
  {
    question: "How long does it take to get my gift card?",
    answer: "Our system is designed for instant delivery. As soon as your crypto transaction is confirmed on the blockchain, your gift card code will be delivered instantly to your account dashboard and registered email address."
  },
  {
    question: "Is it safe to buy with crypto?",
    answer: "Absolutely. We use industry-standard encryption and direct blockchain confirmations. We never store your private keys or sensitive financial information."
  },
  {
    question: "What happens if I don't receive my gift card?",
    answer: "In the rare case that you don't receive your gift card, our support team is available 24/7 to assist you. Simply contact us with your transaction details and we'll resolve the issue promptly."
  },
  {
    question: "Can I get a refund?",
    answer: "Due to the nature of digital gift cards and cryptocurrency transactions, refunds are generally not available once the gift card has been delivered. However, we review each case individually. Please contact our support team for assistance."
  }
];

export default function FAQs() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-background py-20 lg:py-28 border-t border-border">
      <div className="container max-w-[800px]">
        <div className="text-center mb-12">
          <h2 className="text-[32px] lg:text-[48px] font-semibold text-foreground mb-4 tracking-[-0.02em]">
            Frequently Asked Questions
          </h2>
            <p className="text-muted-foreground text-[16px]">
              Everything you need to know about Charm Cards.
            </p>
        </div>

        <div className="space-y-3">
          {faqData.map((faq, index) => (
            <div 
              key={index}
              className={`rounded-[12px] overflow-hidden border transition-all duration-200 ${openIndex === index ? 'border-foreground bg-secondary/50' : 'border-border bg-background hover:border-foreground/50'}`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left group"
              >
                <span className="text-[16px] font-medium text-foreground pr-4">
                  {faq.question}
                </span>
                <div className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${openIndex === index ? 'bg-foreground text-background' : 'bg-secondary text-foreground'}`}>
                  {openIndex === index ? <Minus size={16} /> : <Plus size={16} />}
                </div>
              </button>
              
              {openIndex === index && (
                <div className="px-5 pb-5 text-muted-foreground text-[15px] leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 p-8 bg-secondary rounded-[12px] border border-border text-center">
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full bg-background border border-border">
            <MessageCircle className="w-5 h-5 text-foreground" />
          </div>
          <h4 className="text-foreground text-[18px] font-semibold mb-2">
            Still have questions?
          </h4>
          <p className="text-muted-foreground text-[15px] mb-4">
            Can't find the answer you're looking for? Our team is here to help.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-background hover:bg-foreground hover:text-background border border-border hover:border-foreground rounded-full text-foreground text-[14px] font-medium transition-all"
          >
            Contact Support
          </a>
        </div>
      </div>
    </section>
  );
}
