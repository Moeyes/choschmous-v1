'use client';

import React, { useEffect } from 'react';
import { CardData } from '../types';
import CardIframe from './CardIframe';
import { Button } from '@/shared/ui/button';
import { X } from 'lucide-react';

interface CardViewModalProps {
  card: CardData | null;
  onClose: () => void;
}

const CardViewModal: React.FC<CardViewModalProps> = ({ card, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!card) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card rounded-lg shadow-elevated border border-border p-6 flex flex-col items-center gap-6 max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground leading-snug">
            {card.prefix && <span className="mr-1">{card.prefix}</span>}
            {card.participantName}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground mt-1">{card.orgName || card.eventName}</p>
        </div>

        <div className="border border-border rounded-lg bg-muted/40 p-4">
          <CardIframe {...card} scale={1} />
        </div>

        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1" disabled>
            {/* TODO: exportPDF teammate */}
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CardViewModal;
