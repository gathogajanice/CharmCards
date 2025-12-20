import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import Web3Provider from "@/context/Web3Provider";

const bricolage = Bricolage_Grotesque({ 
  subsets: ['latin'],
  variable: '--font-bricolage-grotesque',
});

export const metadata: Metadata = {
  title: "Charm Cards | Spend Crypto on Premium Gift Cards",
  description: "Shop 1000+ gift cards with Bitcoin, Ethereum, and USDC. Fast, secure, and rewarding crypto shopping experience.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} font-sans antialiased`}>
        <Web3Provider>
          <CartProvider>
            {children}
          </CartProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
