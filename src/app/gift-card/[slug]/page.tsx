"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { ChevronDown, Info } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import GiftCardRedemption from '@/components/sections/gift-card-redemption';

// Gift card data will be loaded from on-chain data
const giftCardData: Record<string, {
  name: string;
  description: string;
  image: string;
    denominations: number[];
    country: string;
    website?: string;
  }> = {
  };


export default function GiftCardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  // Gift card data will be loaded from on-chain data
  const card = giftCardData[slug] || null;
  
  if (!card) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="container mx-auto px-6 py-32 text-center">
          <h1 className="text-3xl font-bold mb-4">Gift Card Not Found</h1>
          <p className="text-muted-foreground mb-8">This gift card will be available after minting on-chain.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90"
          >
            Go Home
          </button>
        </div>
        <Footer />
      </div>
    );
  }
  
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>('description');
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { addToCart } = useCart();

    const handleAddToCart = () => {
      if (!selectedAmount) return;
      
      setIsAdding(true);
      
      // Use a small delay to show the "Adding..." state for better UX
      setTimeout(() => {
        addToCart({
          id: `${slug}-${selectedAmount}-${Date.now()}`,
          name: card.name,
          image: card.image,
          amount: selectedAmount,
          quantity: quantity,
          slug: slug
        });
        
        setIsAdding(false);
        router.push('/cart');
      }, 400);
    };

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch BTC price');
        }
        return res.json();
      })
      .then(data => {
        if (data.bitcoin && data.bitcoin.usd) {
          setBtcPrice(data.bitcoin.usd);
        }
      })
      .catch(err => {
        console.error('Error fetching BTC price:', err);
        // Set a fallback price or handle gracefully
        setBtcPrice(null);
      });
  }, []);

  const toggleAccordion = (id: string) => {
    setOpenAccordion(openAccordion === id ? null : id);
  };

  const getBtcValue = (usdAmount: number) => {
    if (!btcPrice) return 'Loading...';
    return (usdAmount / btcPrice).toFixed(8);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container pt-24 sm:pt-28 md:pt-32 pb-16 max-w-6xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
        <nav className="flex items-center gap-2 text-[11px] sm:text-[12px] md:text-[13px] mb-8 sm:mb-10 md:mb-12 overflow-x-auto no-scrollbar whitespace-nowrap opacity-60">
          <a href="/" className="hover:text-black transition-colors">Home</a>
          <span>/</span>
          <a href="/categories" className="hover:text-black transition-colors">Gift Cards</a>
          <span>/</span>
          <span className="text-black font-semibold">{card.name}</span>
        </nav>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 md:gap-16 lg:gap-24 items-start">
              <div className="flex flex-col gap-6 sm:gap-8 lg:sticky lg:top-28">
                <div className="relative p-2 sm:p-2.5 rounded-[2rem] sm:rounded-[2.5rem] bg-white border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.04)] w-full max-w-[340px] mx-auto transition-all duration-500 hover:shadow-[0_25px_50px_rgba(0,0,0,0.1)]">
                  <div className="relative aspect-square w-full rounded-[2.2rem] overflow-hidden bg-white border border-black/[0.04] shadow-sm flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/[0.01] to-transparent opacity-50" />
                    <Image
                      src={card.image}
                      alt={card.name}
                      fill
                      className="object-contain p-8 hover:scale-110 transition-transform duration-700"
                      priority
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-white border border-black/[0.03] shadow-sm max-w-[340px] mx-auto w-full">
                  <div className="h-8 w-8 rounded-full bg-[#2A9DFF] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(42,157,255,0.2)]">
                    <Info size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-black uppercase tracking-wider mb-0.5">Instant Delivery</p>
                    <p className="text-[11px] text-[#666666] font-medium leading-tight">Delivered via email immediately after payment.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col max-w-lg">
                  <div className="border-b border-[rgba(0,0,0,0.08)] pb-8 mb-8">
                    <div className="flex items-center gap-2 mb-5">
                      <span className="text-[10px] font-bold text-black tracking-[0.1em] uppercase bg-black/5 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        In Stock
                      </span>
                    </div>

                    <h1 className="text-[40px] sm:text-[48px] font-bold leading-[1] tracking-[-0.04em] text-black mb-6 break-words">
                      {card.name}
                    </h1>
                  
                  {card.website && (
                    <a 
                      href={card.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-[12px] font-semibold text-[#2A9DFF] hover:underline"
                    >
                      Visit official website
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>

                  {/* Amount Selection Section */}
                  <div className="pb-8 mb-2">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-black text-black uppercase tracking-[0.15em]">
                          Select Amount
                        </label>
                        {selectedAmount && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-50 rounded-md border border-orange-100">
                              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-tight">BTC</span>
                              <span className="text-[12px] font-bold text-orange-700 tabular-nums">
                                {getBtcValue(selectedAmount)}
                              </span>
                            </div>
                            <span className="text-[11px] text-black/40 font-medium">≈ ${selectedAmount} USD</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                    {card.denominations.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setSelectedAmount(amount)}
                        className={`
                          min-w-[70px] px-4 h-10 rounded-full font-bold text-[13px] transition-all duration-300 border
                          ${selectedAmount === amount
                            ? 'bg-black text-white border-black shadow-lg shadow-black/10 scale-[1.05]'
                            : 'bg-white text-black border-[rgba(0,0,0,0.1)] hover:border-black hover:shadow-sm'
                          }
                        `}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity Section */}
                <div className="pb-8 mb-2 border-t border-[rgba(0,0,0,0.08)] pt-8">
                  <label className="block text-[11px] font-black text-black mb-4 uppercase tracking-[0.15em]">
                    Quantity
                  </label>
                  <div className="flex items-center gap-2 bg-[#F8F8F8] p-1 rounded-full w-fit border border-[rgba(0,0,0,0.05)]">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[rgba(0,0,0,0.05)] hover:border-black transition-colors text-black font-bold shadow-sm active:scale-90"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-[15px] font-bold text-black">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[rgba(0,0,0,0.05)] hover:border-black transition-colors text-black font-bold shadow-sm active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mb-8">
                  <button 
                    onClick={handleAddToCart}
                    disabled={!selectedAmount || isAdding}
                    className={`
                      w-full sm:w-auto px-12 h-14 rounded-full font-bold text-[15px] transition-all duration-500 transform active:scale-[0.97] shadow-xl flex items-center justify-center
                      ${selectedAmount 
                        ? 'bg-black text-white hover:bg-black/90 shadow-black/20 translate-y-[-2px] hover:translate-y-[-4px]' 
                        : 'bg-[#F2F2F2] text-[#999] cursor-not-allowed shadow-none'
                      }
                    `}
                  >
                    {isAdding ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Adding...</span>
                      </div>
                    ) : selectedAmount ? 'Add to Cart' : 'Select an amount'}
                  </button>
                </div>

                <div className="mt-12 space-y-4">
                  <div className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleAccordion('description')}
                      className="w-full px-6 py-5 flex items-center justify-between text-left group"
                    >
                      <span className="text-[11px] font-black text-black uppercase tracking-[0.15em] group-hover:opacity-60 transition-opacity">Description</span>
                      <ChevronDown 
                        size={16} 
                        className={`text-black transition-transform duration-300 ${openAccordion === 'description' ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {openAccordion === 'description' && (
                      <div className="px-6 pb-6">
                        <p className="text-[13px] text-[#666666] leading-[1.6] break-words font-medium">
                          {card.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleAccordion('howto')}
                      className="w-full px-6 py-5 flex items-center justify-between text-left group"
                    >
                      <span className="text-[11px] font-black text-black uppercase tracking-[0.15em] group-hover:opacity-60 transition-opacity">How to Redeem</span>
                      <ChevronDown 
                        size={16} 
                        className={`text-black transition-transform duration-300 ${openAccordion === 'howto' ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {openAccordion === 'howto' && (
                      <div className="px-6 pb-6">
                        <div className="space-y-4">
                          {[
                            'Complete your purchase and receive your gift card code via email.',
                            `Visit the ${card.name} website or app and log in to your account.`,
                            'Navigate to the payment or gift card section in your account settings.',
                            'Enter your gift card code and apply it to your balance.',
                            'Enjoy your purchase instantly!'
                          ].map((step, i) => (
                            <div key={i} className="flex gap-4">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black">
                                {i + 1}
                              </span>
                              <p className="text-[13px] text-[#666666] leading-[1.6] break-words font-medium">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleAccordion('terms')}
                      className="w-full px-6 py-5 flex items-center justify-between text-left group"
                    >
                      <span className="text-[11px] font-black text-black uppercase tracking-[0.15em] group-hover:opacity-60 transition-opacity">Terms & Conditions</span>
                      <ChevronDown 
                        size={16} 
                        className={`text-black transition-transform duration-300 ${openAccordion === 'terms' ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {openAccordion === 'terms' && (
                      <div className="px-6 pb-6">
                        <p className="text-[13px] text-[#666666] leading-[1.6] break-words font-medium">
                          Gift cards are non-refundable and cannot be exchanged for cash once delivered. The card balance does not expire and no fees apply. Please ensure you are purchasing for the correct region ({card.country}) as gift cards are region-locked. Charm Cards is not responsible for lost or stolen codes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Redemption Interface - Will be populated from on-chain data */}
                {/* <GiftCardRedemption
                  brand={card.name}
                  currentBalance={0}
                  maxBalance={0}
                  onRedeem={async (amount) => {
                    // On-chain redemption will be implemented
                    console.log('Redeeming:', amount);
                  }}
                /> */}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
