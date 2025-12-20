import React from 'react';
import Link from 'next/link';
import { Github, Twitter, Mail, ExternalLink } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Brand Section */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-2 mb-2">
              <img
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766104251676.png?width=200&height=200&resize=contain"
                alt="Charm Cards"
                className="h-8 sm:h-10 w-auto"
              />
              <span className="text-lg sm:text-xl font-black font-bricolage">Charm Cards</span>
            </div>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              NFT gift cards on Bitcoin. Secure, transferable, and programmable digital assets powered by Charms Protocol.
            </p>
            <div className="flex items-center gap-4 mt-2">
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a 
                href="mailto:contact@charmcards.com" 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-wider mb-2">Quick Links</h3>
            <div className="flex flex-col gap-2 sm:gap-3">
              <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm">
                Home
              </Link>
              <Link href="/categories" className="text-white/60 hover:text-white transition-colors text-sm">
                Browse Gift Cards
              </Link>
              <Link href="/wallet" className="text-white/60 hover:text-white transition-colors text-sm">
                My Wallet
              </Link>
              <Link href="/search" className="text-white/60 hover:text-white transition-colors text-sm">
                Search
              </Link>
            </div>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-wider mb-2">Resources</h3>
            <div className="flex flex-col gap-2 sm:gap-3">
              <a 
                href="https://charms.dev/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
              >
                Charms Protocol
                <ExternalLink className="w-3 h-3" />
              </a>
              <a 
                href="https://bitcoin.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
              >
                About Bitcoin
                <ExternalLink className="w-3 h-3" />
              </a>
              <Link href="/categories" className="text-white/60 hover:text-white transition-colors text-sm">
                How It Works
              </Link>
              <Link href="/categories" className="text-white/60 hover:text-white transition-colors text-sm">
                FAQ
              </Link>
            </div>
          </div>

          {/* Legal & Support */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <h3 className="text-white font-black text-xs sm:text-sm uppercase tracking-wider mb-2">Support</h3>
            <div className="flex flex-col gap-2 sm:gap-3">
              <a 
                href="mailto:support@charmcards.com" 
                className="text-white/60 hover:text-white transition-colors text-sm"
              >
                Contact Support
              </a>
              <Link href="/categories" className="text-white/60 hover:text-white transition-colors text-sm">
                Terms of Service
              </Link>
              <Link href="/categories" className="text-white/60 hover:text-white transition-colors text-sm">
                Privacy Policy
              </Link>
              <Link href="/categories" className="text-white/60 hover:text-white transition-colors text-sm">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-6 sm:pt-8 mt-6 sm:mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="text-xs sm:text-sm text-white/60 text-center md:text-left">
              © {new Date().getFullYear()} Charm Cards. All rights reserved.
              <br className="md:hidden" />
              <span className="md:ml-2">Project by JJ and Ti 2025</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-white/40">
              <span>Powered by</span>
              <span className="text-white/60 font-semibold">Bitcoin</span>
              <span>•</span>
              <a 
                href="https://charms.dev/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/60 font-semibold hover:text-white transition-colors"
              >
                Charms Protocol
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
