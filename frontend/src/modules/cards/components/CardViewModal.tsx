'use client';

import { CardData } from '../types';
import CardIframe from './CardIframe';
import { Modal } from '@/shared/ui/Modal';

interface CardViewModalProps {
  card: CardData | null;
  onClose: () => void;
}

const CardViewModal: React.FC<CardViewModalProps> = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <Modal
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
    </Modal>
  );
};

export default CardViewModal;
