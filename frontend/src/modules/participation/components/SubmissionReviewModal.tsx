'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
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
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant={reasonAction === 'reject' ? 'destructive' : 'default'}
            className={reasonAction === 'flag' ? 'bg-warning text-warning-foreground hover:bg-warning/90 border-warning' : undefined}
            loading={isReviewing}
            disabled={!reason.trim() || isReviewing}
            onClick={onConfirm}
          >
            {reasonAction === 'reject' ? t('reject') : t('flag')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
