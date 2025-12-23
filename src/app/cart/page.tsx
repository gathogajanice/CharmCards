"use client";

import { useCart } from '@/context/CartContext';
import { X, ArrowRight, ShoppingBag, Wallet } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { useAppKitAccount } from '@reown/appkit/react';
import { useEffect, useState } from 'react';
import { getWalletCharms } from '@/lib/charms/wallet';
import type { GiftCardNftMetadata } from '@/lib/charms/types';

interface MintedGiftCard {
  id: string;
  brand: string;
  image: string;
  remainingBalance: number;
  initialAmount: number;
  expirationDate: number;
  createdAt: number;
}

export default function CartPage() {
  const { cartItems, removeItem, updateQuantity, subtotal } = useCart();
  const { address, isConnected } = useAppKitAccount();
  const [mintedGiftCards, setMintedGiftCards] = useState<MintedGiftCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch minted gift cards from wallet
  useEffect(() => {
    const fetchMintedGiftCards = async () => {
      if (!address || !isConnected) {
        setMintedGiftCards([]);
        return;
      }

      setIsLoading(true);
      try {
        const walletCharms = await getWalletCharms(address);
        // Convert NFT charms to gift card format
        const giftCards: MintedGiftCard[] = walletCharms.nfts
          .filter(nft => nft.data) // Only NFTs with gift card data
          .map((nft, index) => {
            const data = nft.data as GiftCardNftMetadata;
            return {
              id: `${nft.app_id}-${index}`,
              brand: data.brand,
              image: data.image,
              remainingBalance: data.remaining_balance / 100, // Convert cents to dollars
              initialAmount: data.initial_amount / 100,
              expirationDate: data.expiration_date,
              createdAt: data.created_at,
            };
          });
        setMintedGiftCards(giftCards);
      } catch (error) {
        console.error('Failed to fetch minted gift cards:', error);
        setMintedGiftCards([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMintedGiftCards();
  }, [address, isConnected]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container pt-24 pb-20 max-w-6xl mx-auto px-4 sm:px-8">
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-black mb-10">
          Shopping Cart
        </h1>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#F8F8F8] rounded-[24px] border border-[rgba(0,0,0,0.05)] shadow-sm">
            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-6">
              <Wallet size={32} className="text-black/20" />
            </div>
            <p className="text-[15px] font-medium text-[#666666] mb-2">Connect your wallet to view minted gift cards</p>
            <p className="text-[13px] text-[#999999] mb-8">Your minted gift cards will appear here</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#F8F8F8] rounded-[24px] border border-[rgba(0,0,0,0.05)] shadow-sm">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[15px] font-medium text-[#666666]">Loading your minted gift cards...</p>
          </div>
        ) : mintedGiftCards.length === 0 && cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#F8F8F8] rounded-[24px] border border-[rgba(0,0,0,0.05)] shadow-sm">
            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-6">
              <ShoppingBag size={32} className="text-black/20" />
            </div>
            <p className="text-[15px] font-medium text-[#666666] mb-2">No gift cards yet</p>
            <p className="text-[13px] text-[#999999] mb-8">Mint your first gift card to get started</p>
            <Link 
              href="/"
              className="inline-flex h-12 px-8 rounded-full font-bold text-[13px] bg-black text-white hover:bg-black/90 transition-all items-center gap-2 shadow-lg shadow-black/10"
            >
              <span>Mint Gift Card</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              {/* Minted Gift Cards Section */}
              {mintedGiftCards.length > 0 && (
                <>
                  <h2 className="text-[20px] font-bold mb-4">Your Minted Gift Cards</h2>
                  <div className="space-y-4 mb-8">
                    {mintedGiftCards.map((card) => (
                      <div key={card.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-6 border-b border-[rgba(0,0,0,0.05)] group">
                        <div className="sm:col-span-6 flex items-center gap-4">
                          <div className="relative w-20 h-20 rounded-[16px] overflow-hidden bg-[#F8F8F8] border border-[rgba(0,0,0,0.05)] flex-shrink-0 group-hover:scale-[1.02] transition-transform">
                            <Image
                              src={card.image}
                              alt={card.brand}
                              fill
                              className="object-contain p-4"
                            />
                          </div>
                          <div>
                            <h3 className="text-[15px] font-bold text-black">{card.brand}</h3>
                            <p className="text-[12px] text-[#666] mt-1">
                              Balance: ${card.remainingBalance.toFixed(2)} / ${card.initialAmount.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="sm:col-span-3 text-center sm:text-left">
                          <span className="text-[12px] text-[#999] uppercase block mb-1">Status</span>
                          <span className="text-[14px] font-bold text-green-600">Minted</span>
                        </div>
                        <div className="sm:col-span-3 text-right">
                          <Link
                            href={`/gift-card/${card.brand.toLowerCase().replace(/\s+/g, '-')}`}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors text-[13px]"
                          >
                            View Details
                            <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Cart Items for Minting (Pending) */}
              {cartItems.length > 0 && (
                <>
                  {mintedGiftCards.length > 0 && (
                    <div className="border-t border-[rgba(0,0,0,0.1)] pt-8 mt-8">
                      <h2 className="text-[20px] font-bold mb-4">Pending Mint</h2>
                    </div>
                  )}
                  <div className="border-b border-[rgba(0,0,0,0.1)] pb-4 mb-6 hidden sm:block">
                    <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-[#999] uppercase tracking-[0.1em]">
                      <div className="col-span-6">Product</div>
                      <div className="col-span-2 text-center">Amount</div>
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
                </>
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="space-y-6">
                {/* Minted Gift Cards Summary */}
                {mintedGiftCards.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-[24px] p-6 text-black">
                    <h2 className="text-[16px] font-bold mb-4 uppercase tracking-wider text-green-700">Minted Gift Cards</h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium">Total Cards</span>
                        <span className="text-[14px] font-bold">{mintedGiftCards.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium">Total Balance</span>
                        <span className="text-[18px] font-bold text-green-600">
                          ${mintedGiftCards.reduce((sum, card) => sum + card.remainingBalance, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/wallet"
                      className="mt-4 w-full inline-flex h-11 rounded-full font-bold text-[13px] bg-green-600 text-white hover:bg-green-700 transition-all active:scale-[0.98] shadow-lg items-center justify-center gap-2"
                    >
                      <Wallet size={16} />
                      <span>View Wallet</span>
                    </Link>
                  </div>
                )}

                {/* Pending Mint Summary */}
                {cartItems.length > 0 && (
                  <div className="bg-black rounded-[24px] p-8 text-white shadow-xl shadow-black/10">
                    <h2 className="text-[16px] font-bold mb-8 uppercase tracking-wider">Pending Mint</h2>
                    
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
                      <p className="text-[11px] opacity-40">Pay with Bitcoin on Testnet4</p>
                    </div>

                    <button className="w-full h-14 rounded-full font-bold text-[14px] bg-white text-black hover:bg-white/90 transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2">
                      <span>Mint Gift Cards</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
