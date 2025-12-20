"use client";

import { useCart } from '@/context/CartContext';
import { X, ArrowRight, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';

export default function CartPage() {
  const { cartItems, removeItem, updateQuantity, subtotal } = useCart();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container pt-24 pb-20 max-w-6xl mx-auto px-4 sm:px-8">
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-black mb-10">
          Shopping Cart
        </h1>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#F8F8F8] rounded-[24px] border border-[rgba(0,0,0,0.05)] shadow-sm">
            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-6">
              <ShoppingBag size={32} className="text-black/20" />
            </div>
            <p className="text-[15px] font-medium text-[#666666] mb-8">Your cart is currently empty</p>
            <Link 
              href="/"
              className="inline-flex h-12 px-8 rounded-full font-bold text-[13px] bg-black text-white hover:bg-black/90 transition-all items-center gap-2 shadow-lg shadow-black/10"
            >
              <span>Start Shopping</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <div className="border-b border-[rgba(0,0,0,0.1)] pb-4 mb-6 hidden sm:block">
                <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-[#999] uppercase tracking-[0.1em]">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2 text-center">Price</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
              </div>

              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-6 border-b border-[rgba(0,0,0,0.05)] group">
                    <div className="sm:col-span-6 flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-[16px] overflow-hidden bg-[#F8F8F8] border border-[rgba(0,0,0,0.05)] flex-shrink-0 group-hover:scale-[1.02] transition-transform">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain p-4"
                        />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold text-black">{item.name}</h3>
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="text-[12px] font-medium text-[#FF4444] hover:text-[#CC0000] transition-colors flex items-center gap-1 mt-1"
                        >
                          <X size={12} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="sm:col-span-2 text-center flex sm:block items-center justify-between">
                      <span className="sm:hidden text-[12px] font-bold text-[#999] uppercase">Price</span>
                      <span className="text-[14px] font-bold text-black">${item.amount}</span>
                    </div>
                    
                    <div className="sm:col-span-2 flex items-center justify-center gap-2">
                      <div className="flex items-center bg-[#F8F8F8] p-0.5 rounded-full border border-[rgba(0,0,0,0.05)]">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-[rgba(0,0,0,0.05)] hover:border-black transition-colors text-black font-bold active:scale-90"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-[13px] font-bold text-black">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-[rgba(0,0,0,0.05)] hover:border-black transition-colors text-black font-bold active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    
                    <div className="sm:col-span-2 text-right flex sm:block items-center justify-between">
                      <span className="sm:hidden text-[12px] font-bold text-[#999] uppercase">Total</span>
                      <span className="text-[15px] font-bold text-[#2A9DFF]">
                        ${(item.amount * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-black rounded-[24px] p-8 sticky top-28 text-white shadow-xl shadow-black/10">
                <h2 className="text-[16px] font-bold mb-8 uppercase tracking-wider">Order Summary</h2>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between opacity-60">
                    <span className="text-[13px] font-medium">Subtotal</span>
                    <span className="text-[14px] font-bold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between opacity-60">
                    <span className="text-[13px] font-medium">Network Fee</span>
                    <span className="text-[13px] font-bold">FREE</span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-6 mb-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[15px] font-bold">Total Amount</span>
                    <span className="text-[24px] font-bold text-[#2A9DFF]">${subtotal.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] opacity-40">Inclusive of all taxes and service fees</p>
                </div>

                <button className="w-full h-14 rounded-full font-bold text-[14px] bg-white text-black hover:bg-white/90 transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2">
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={18} />
                </button>

                <div className="mt-8 flex flex-col items-center gap-4">
                  <p className="text-[11px] opacity-40 text-center uppercase tracking-widest">Pay with Crypto</p>
                  <div className="flex items-center gap-3 opacity-60 grayscale hover:grayscale-0 transition-all cursor-default">
                    <Image src="https://cryptologos.cc/logos/bitcoin-btc-logo.png" alt="BTC" width={20} height={20} />
                    <Image src="https://cryptologos.cc/logos/ethereum-eth-logo.png" alt="ETH" width={20} height={20} />
                    <Image src="https://cryptologos.cc/logos/tether-usdt-logo.png" alt="USDT" width={20} height={20} />
                    <Image src="https://cryptologos.cc/logos/solana-sol-logo.png" alt="SOL" width={20} height={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
