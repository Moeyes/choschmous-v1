'use client';

import { CardData } from '../types';
import CardIframe from './CardIframe';
import { ModalV2 } from '@/shared/ui/ModalV2';

interface CardViewModalProps {
  card: CardData | null;
  onClose: () => void;
}

const CardViewModal: React.FC<CardViewModalProps> = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <ModalV2
      isOpen={card !== null}
      onClose={onClose}
      title={`${card.prefix ? `${card.prefix} ` : ''}${card.participantName}`}
      description={card.orgName || card.eventName || undefined}
      size="md"
      cancelText="Close"
      onConfirm={() => {}}
      confirmText="Download PDF"
      confirmDisabled
    >
      <div className="border border-border rounded-lg bg-muted/40 p-4">
        <CardIframe {...card} scale={1} />
      </div>
    </ModalV2>
  );
};

export default CardViewModal;
