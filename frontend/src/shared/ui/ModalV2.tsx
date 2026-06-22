'use client';

import { type ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Button } from './button';

export type ModalV2Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: ModalV2Size;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmVariant?: 'default' | 'destructive';
  /** References a <form> id so the confirm button can submit it. */
  form?: string;
  /** Custom footer content — overrides the standard cancel/confirm footer. */
  footer?: ReactNode;
}

const SIZE_MAP: Record<ModalV2Size, string> = {
  xs: 'max-w-sm',
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
};

/**
 * Modal V2 – government-grade admin modal.
 *
 * Sizes:
 *   xs = confirmation (max-w-sm)
 *   sm = small form   (max-w-md)
 *   md = standard form (max-w-lg)
 *   lg = complex form  (max-w-xl)
 *   xl = multi-section (max-w-2xl)
 *
 * Footer standard: [Cancel] [Primary action aligned right].
 * Loading state is built into the confirm button.
 * On mobile the footer stays sticky when content scrolls.
 */
export function ModalV2({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDisabled = false,
  confirmLoading = false,
  confirmVariant = 'default',
  form,
  footer,
}: ModalV2Props) {
  const hasStandardFooter = onConfirm !== undefined;
  const showFooter = hasStandardFooter || footer !== undefined;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn('fixed inset-0 z-50 bg-black/50', 'transition-opacity duration-200', 'data-starting-style:opacity-0 data-ending-style:opacity-0', 'motion-reduce:transition-none')}
        />
        <Dialog.Popup
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-hidden rounded-lg border border-border bg-card shadow-elevated outline-none',
            'transition-all duration-200 ease-out',
            'data-starting-style:scale-95 data-starting-style:opacity-0',
            'data-ending-style:scale-95 data-ending-style:opacity-0',
            'motion-reduce:transition-none',
            SIZE_MAP[size],
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold leading-snug text-foreground sm:text-lg">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              type="button"
              aria-label="Close"
              className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">{children}</div>

          {showFooter && (
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-card px-4 py-4 sm:px-6">
              {footer ? (
                footer
              ) : (
                <div className="flex items-center justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    {cancelText}
                  </Button>
                  <Button
                    type={form ? 'submit' : 'button'}
                    form={form}
                    variant={confirmVariant}
                    onClick={!form ? onConfirm : undefined}
                    disabled={confirmDisabled || confirmLoading}
                    loading={confirmLoading}
                  >
                    {confirmText}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
