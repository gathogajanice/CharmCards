"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';

const CRYPTO_DATA = [
  { name: 'BTC', fullName: 'Bitcoin', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_17.png' },
  { name: 'ETH', fullName: 'Ethereum', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_18.png' },
  { name: 'LTC', fullName: 'Litecoin', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_19.png' },
  { name: 'SOL', fullName: 'Solana', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_20.png' },
  { name: 'TRX', fullName: 'Tron', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_21.png' },
  { name: 'BNB', fullName: 'BNB Chain', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_22.png' },
  { name: 'USDT - ERC20', fullName: 'Tether', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_23.png' },
  { name: 'USDT - BEP20', fullName: 'Tether BSC', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_24.png' },
  { name: 'USDT - TRC20', fullName: 'Tether TRC', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_25.png' },
  { name: 'USDT - Polygon', fullName: 'Tether Poly', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_26.png' },
  { name: 'USDC - ERC20', fullName: 'USD Coin', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_27.png' },
  { name: 'USDC - BEP20', fullName: 'USD Coin BSC', icon: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-spendcrypto-com/assets/images/images_28.png' },
];

const CryptoCard = ({ crypto }: { crypto: typeof CRYPTO_DATA[0] }) => {
  const [selected, setSelected] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fallbackIcon = `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be16d37567431484f9cf0823c93259838/32/color/${crypto.name.split(' ')[0].toLowerCase()}.png`;

  return (
    <button
      onClick={() => setSelected(!selected)}
      className={`relative flex flex-col items-center justify-center p-4 sm:p-6 rounded-[12px] border transition-all duration-200 hover:shadow-sm ${
        selected 
          ? 'bg-secondary border-foreground' 
          : 'border-border bg-background hover:border-foreground'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-foreground rounded-full flex items-center justify-center">
          <Check size={12} className="text-background" />
        </div>
      )}
      
      <div className="relative w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-4">
        <Image
          src={imageError ? fallbackIcon : crypto.icon}
          alt={crypto.name}
          fill
          className="object-contain"
          onError={() => setImageError(true)}
        />
      </div>
      <span className="text-muted-foreground text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-center leading-tight">
        {crypto.name}
      </span>
    </button>
  );
};

const AcceptedCryptos = () => {
  return (
    <section className="bg-background py-20 border-t border-border">
      <div className="container max-w-[1000px]">
        <div className="text-center mb-12">
          <h2 className="text-[32px] font-semibold text-foreground mb-3 tracking-[-0.01em]">
            Accepted Cryptocurrencies
          </h2>
          <p className="text-muted-foreground text-[16px]">
            Pay with your favorite crypto across multiple networks
          </p>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
          {CRYPTO_DATA.map((crypto, index) => (
            <CryptoCard key={index} crypto={crypto} />
          ))}
        </div>

        <p className="text-center text-muted-foreground text-[14px] mt-8">
          Click to select your preferred payment method
        </p>
      </div>
    </section>
  );
};

export default AcceptedCryptos;
