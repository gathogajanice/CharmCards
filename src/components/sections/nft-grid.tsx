import React from 'react';

interface NFTCardProps {
  image?: string;
  video?: string;
  title: string;
  creator: string;
  price: string;
  endsIn: string;
}

const NFTCard: React.FC<NFTCardProps> = ({ image, video, title, creator, price, endsIn }) => {
  return (
    <div className="group relative flex flex-col w-full h-full card-hover-effect">
      {/* Media Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[12px] bg-surface">
        <div className="absolute inset-0 flex items-center justify-center">
          {video ? (
            <video
              src={video}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : image ? (
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-[#f2f2f2]" />
          )}
        </div>
      </div>

      {/* Info Block */}
      <div className="flex flex-col pt-4 pb-2">
        {/* Status Line */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[12px] font-semibold text-accent-purple tracking-wide uppercase">
            Live auction
          </span>
          <div className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-purple opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-purple"></span>
          </div>
          <span className="text-[12px] font-normal text-text-secondary">
            Ends {endsIn}
          </span>
        </div>

        {/* NFT & Creator Info */}
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-semibold text-black leading-tight truncate">
            {title}
          </h2>
          <div className="text-[14px] text-text-secondary truncate">
            {creator}
          </div>
        </div>

        {/* Price */}
        <div className="mt-3">
          <div className="text-[14px] font-semibold text-black">
            {price}
          </div>
        </div>
      </div>

      {/* Invisible Overlay Link */}
      <a href="#" className="absolute inset-0 z-10" aria-label={`View ${title}`}></a>
    </div>
  );
};

const NFTGrid = () => {
  const nfts = [
    {
      title: "🇰︎≡℟◌ 💽💾☠",
      creator: "ƛƝƛ 🍌",
      price: "0.0004 ETH",
      endsIn: "6d 5h",
      image: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-2.jpg"
    },
    {
      title: "🇰︎≡℟◌ 💽💾☠",
      creator: "ጠዐፕቿረ🍌",
      price: "0.0004 ETH",
      endsIn: "6d 5h",
      image: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-3.jpg"
    },
    {
      title: "🇰︎≡℟◌ 💽💾☠",
      creator: "B͠a͠t͠h͠🍌͠",
      price: "0.0002 ETH",
      endsIn: "6d 6h",
      image: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-4.jpg"
    },
    {
      title: "Nad G.",
      creator: "Crossing the Chaos",
      price: "0.0004 ETH",
      endsIn: "5d 20h",
      video: "https://assets.foundation.app/8453/0x4A4E1C478Bc164FBa169B83c80E4b46FB18A1401/122/nft_streaming_preview_q3.mp4"
    },
    {
      title: "mooncity",
      creator: "Julia",
      price: "0.0003 ETH",
      endsIn: "4d 10h",
      video: "https://assets.foundation.app/8453/0xA70D6bFE002C936a3971b1B73d61f6d3660f4d18/35/nft_streaming_preview_q3.mp4"
    },
    {
      title: "Kira Risugawa 2.0",
      creator: "On a Cool Holy Night?! (video ver.)",
      price: "0.0005 ETH",
      endsIn: "20h 15m",
      video: "https://assets.foundation.app/8453/0x436962062edF079698FFE4b919b4ADc26ab443e0/10/nft_streaming_preview_q3.mp4"
    },
    {
      title: "mooncity",
      creator: "Emily",
      price: "0.0003 ETH",
      endsIn: "5d 7h",
      image: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-5.jpg"
    },
    {
      title: "mooncity",
      creator: "Mona",
      price: "0.0002 ETH",
      endsIn: "2d 12h",
      image: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-6.jpg"
    }
  ];

  return (
    <section className="container py-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[20px]">
        {nfts.map((nft, index) => (
          <NFTCard key={index} {...nft} />
        ))}
        {/* Placeholder cards to fill out more of the grid area if needed */}
        <NFTCard 
          title="🇰︎≡℟◌ 💽💾☠" 
          creator="lareina dtla bw2" 
          price="0.0004 ETH" 
          endsIn="1d 21h" 
          image="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-7.jpg"
        />
        <NFTCard 
          title="mooncity" 
          creator="Madeline" 
          price="0.0003 ETH" 
          endsIn="1d 4h" 
          image="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-8.jpg"
        />
        <NFTCard 
          title="James Tiberios" 
          creator="BEAUTY ART Collection #125" 
          price="0.0003 ETH" 
          endsIn="2d 10h" 
          image="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-9.jpg"
        />
        <NFTCard 
          title="mooncity" 
          creator="Tristan" 
          price="0.0004 ETH" 
          endsIn="6h 58m" 
          image="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/cdcacc15-0922-42c0-8532-9fd8d387c6ab-foundation-app/assets/images/nft-2.jpg"
        />
      </div>
    </section>
  );
};

export default NFTGrid;