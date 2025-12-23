"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { BitcoinAdapter } from "@reown/appkit-adapter-bitcoin";
import { mainnet, arbitrum, bitcoin } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import React, { ReactNode } from "react";

// 1. Get projectId from user
const projectId = "017586850c1165c7bcf777883e747a02";

// 2. Create a metadata object
const metadata = {
  name: "Charm Cards",
  description: "Spend Crypto on Premium Gift Cards",
  url: "https://charmcards.com",
  icons: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766104251676.png"]
};

// 3. Set the networks (including Bitcoin)
const networks = [bitcoin, mainnet, arbitrum] as any;

// 4. Create Adapters
const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet, arbitrum],
  projectId,
  ssr: true
});

const bitcoinAdapter = new BitcoinAdapter({
  projectId
});

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter, bitcoinAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: []
  },
  includeWalletIds: [
    'be49f0a78d6ea1beed3804c3a6b62ea71f568d58d9df8097f3d61c7c9baf273d', // Unisat - Bitcoin wallet (Charms-compatible)
    'e58b292e92c253907c1b5046200236a6', // Xverse - Bitcoin wallet (Charms-compatible)
    '1ae152b1263d893f40f065363b96324d', // Leather - Bitcoin wallet (Charms-compatible)
  ],
  featuredWalletIds: [
    'be49f0a78d6ea1beed3804c3a6b62ea71f568d58d9df8097f3d61c7c9baf273d', // Unisat
    'e58b292e92c253907c1b5046200236a6', // Xverse
    '1ae152b1263d893f40f065363b96324d', // Leather
  ],
  allWallets: 'show', 
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#2A9DFF',
    '--w3m-border-radius-master': '1px',
    '--w3m-font-family': 'var(--font-bricolage-grotesque)'
  }
});

const queryClient = new QueryClient();

export default function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
