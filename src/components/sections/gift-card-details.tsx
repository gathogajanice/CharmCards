"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface GiftCardDetailsProps {
  description: string;
  howToRedeem: string;
  terms: { label: string; url: string }[];
  bullets?: string[];
  note?: string;
}

export default function GiftCardDetails({ description, howToRedeem, terms, bullets, note }: GiftCardDetailsProps) {
  const [openSection, setOpenSection] = useState<string | null>('description');

  const sections = [
    {
      id: 'description',
      title: 'Description',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground text-[15px] leading-relaxed">{description}</p>
          {bullets && (
            <ul className="space-y-2">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex gap-3 text-muted-foreground text-[15px]">
                  <span className="text-foreground">•</span>
                  {bullet}
                </li>
              ))}
            </ul>
          )}
          {note && (
            <div className="p-4 bg-secondary rounded-[8px] border border-border">
              <p className="text-muted-foreground text-[14px]">
                <strong className="text-foreground">Note:</strong> {note}
              </p>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'redeem',
      title: 'How to Redeem',
      content: (
        <div className="text-muted-foreground text-[15px] leading-relaxed">
          {howToRedeem}
        </div>
      )
    },
    {
      id: 'terms',
      title: 'Terms & Conditions',
      content: (
        <div className="space-y-3">
          {terms.length > 0 ? (
            terms.map((term, i) => (
              <a
                key={i}
                href={term.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-foreground text-[15px] hover:opacity-70 transition-opacity"
              >
                <ExternalLink size={14} />
                {term.label}
              </a>
            ))
          ) : (
            <p className="text-muted-foreground text-[15px]">
              Please refer to the brand's official website for terms and conditions.
            </p>
          )}
        </div>
      )
    }
  ];

  return (
    <section className="bg-background py-12 border-t border-border">
      <div className="container max-w-[800px]">
        <div className="space-y-3">
          {sections.map((section) => (
            <div
              key={section.id}
              className={`rounded-[12px] border overflow-hidden transition-all ${
                openSection === section.id ? 'border-foreground' : 'border-border'
              }`}
            >
              <button
                onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="text-[16px] font-medium text-foreground">
                  {section.title}
                </span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  openSection === section.id ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
                }`}>
                  {openSection === section.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>
              
              {openSection === section.id && (
                <div className="px-5 pb-5">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
