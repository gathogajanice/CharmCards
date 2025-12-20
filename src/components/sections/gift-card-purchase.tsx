"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ShoppingCart, Bitcoin } from 'lucide-react';

interface GiftCardPurchaseProps {
  name: string;
  imageUrl: string;
  denominations: number[];
  customRange?: { min: number; max: number };
  discount?: string;
}

export default function GiftCardPurchase({ name, imageUrl, denominations, customRange, discount }: GiftCardPurchaseProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(denominations[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const handleSelectDenomination = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const currentAmount = selectedAmount || (customAmount ? parseFloat(customAmount) : 0);
  const discountedPrice = discount ? currentAmount * (1 - parseFloat(discount) / 100) : currentAmount;
  const total = discountedPrice * quantity;

  return (
    <section className="bg-background py-12">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="relative aspect-[4/3] rounded-[12px] overflow-hidden bg-surface">
            <Image
              src={imageError ? 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&auto=format&fit=crop' : imageUrl}
              alt={name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
            {discount && (
              <div className="absolute top-4 left-4 bg-accent text-accent-foreground text-[13px] font-semibold px-3 py-1.5 rounded-full">
                {discount} OFF
              </div>
            )}
          </div>

          <div>
            <h1 className="text-[32px] font-semibold text-foreground tracking-[-0.01em] mb-2">
              {name} Gift Card
            </h1>
            
            {discount && (
              <p className="text-accent text-[14px] font-medium mb-6">
                Save {discount} on this gift card
              </p>
            )}

            <div className="mb-8">
              <label className="text-[14px] font-medium text-foreground mb-3 block">
                Select Amount
              </label>
              <div className="flex flex-wrap gap-2">
                {denominations.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleSelectDenomination(amount)}
                    className={`h-10 px-5 rounded-full text-[14px] font-medium border transition-all ${
                      selectedAmount === amount
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-foreground'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            {customRange && (
              <div className="mb-8">
                <label className="text-[14px] font-medium text-foreground mb-3 block">
                  Or enter custom amount (${customRange.min} - ${customRange.max})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={customRange.min}
                    max={customRange.max}
                    value={customAmount}
                    onChange={(e) => handleCustomAmount(e.target.value)}
                    placeholder={`${customRange.min} - ${customRange.max}`}
                    className="w-full h-12 pl-8 pr-4 bg-background border border-border rounded-[8px] text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="mb-8">
              <label className="text-[14px] font-medium text-foreground mb-3 block">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center text-foreground font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-6 bg-secondary rounded-[12px] border border-border mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-muted-foreground text-[14px]">Price per card</span>
                <div className="text-right">
                  {discount && (
                    <span className="text-muted-foreground line-through text-[14px] mr-2">
                      ${currentAmount.toFixed(2)}
                    </span>
                  )}
                  <span className="text-foreground font-medium">${discountedPrice.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <span className="text-foreground font-medium">Total</span>
                <span className="text-[24px] font-semibold text-foreground">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 h-12 bg-primary text-primary-foreground font-semibold rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                <ShoppingCart size={18} />
                Add to Cart
              </button>
              <button className="flex-1 h-12 bg-foreground text-background font-semibold rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                <Bitcoin size={18} />
                Buy Now
              </button>
            </div>

            <p className="text-center text-muted-foreground text-[13px] mt-4">
              Pay with 100+ cryptocurrencies
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
