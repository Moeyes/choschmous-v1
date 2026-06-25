'use client';

import { AlertCircle } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { useTranslations } from 'next-intl';

interface SubmissionReviewModalProps {
  reasonAction: 'reject' | 'flag' | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isReviewing: boolean;
}

export function SubmissionReviewModal({
  reasonAction,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
  isReviewing,
}: SubmissionReviewModalProps) {
  const t = useTranslations('participation.review');

  if (!reasonAction) return null;

  return (
    <Modal
      isOpen={reasonAction !== null}
      onClose={onClose}
      title={reasonAction === 'reject' ? t('confirmReject') : t('confirmFlag')}
      size="xs"
      cancelText={t('cancel')}
      confirmText={reasonAction === 'reject' ? t('reject') : t('flag')}
      confirmVariant={reasonAction === 'reject' ? 'destructive' : 'default'}
      confirmLoading={isReviewing}
      confirmDisabled={!reason.trim() || isReviewing}
      onConfirm={onConfirm}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm leading-relaxed text-foreground">{t('reasonRequired')}</p>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">{t('reason')}</label>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={4}
            placeholder={t('reasonPlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </Modal>
  );
}
