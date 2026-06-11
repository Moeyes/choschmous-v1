'use client';

import React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Max width of the dialog. Defaults to `lg`. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * Themed modal built on the accessible base-ui Dialog: focus trap, Esc to
 * close, click-outside, focus restoration and body scroll lock all come for
 * free. The imperative `isOpen`/`onClose` API is preserved so existing call
 * sites need no changes.
 */
export function Modal({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn('fixed inset-0 z-50 bg-black/50', 'transition-opacity duration-200', 'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0', 'motion-reduce:transition-none')}
        />
        <Dialog.Popup
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-hidden rounded-lg border border-border bg-card shadow-elevated outline-none',
            'transition-all duration-200 ease-out',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'motion-reduce:transition-none',
            SIZE_MAP[size],
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border p-4 sm:p-6">
            <Dialog.Title className="text-base font-semibold leading-snug text-foreground sm:text-lg">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto p-4 sm:p-6">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
