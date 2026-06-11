"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

import { Button } from "./button";
import { cn } from "@/shared/utils/cn";

type ConfirmFn = (options?: {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
}) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Imperative confirmation dialog. Replaces native `window.confirm` with a
 * themed, accessible base-ui Dialog (focus trap, Esc, click-outside, animated).
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ message: t("deleteConfirm") })) doDelete();
 */
export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("common.confirmDelete");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "destructive" | "default";
  }>({});
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts ?? {});
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  // If the dialog is dismissed (Esc / backdrop / close), treat as cancel.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) settle(false);
    },
    [settle],
  );

  const variant = options.variant ?? "destructive";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/50",
              "transition-opacity duration-200",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              "motion-reduce:transition-none",
            )}
          />
          <Dialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
              "rounded-lg border border-border bg-card p-6 shadow-elevated outline-none",
              "transition-all duration-200 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "motion-reduce:transition-none",
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  variant === "destructive"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-accent text-primary",
                )}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-base font-semibold leading-snug text-foreground">
                  {options.title ?? t("title")}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {options.message ?? t("message")}
                </Dialog.Description>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => settle(false)}>
                {options.cancelText ?? t("cancel")}
              </Button>
              <Button
                variant={variant === "destructive" ? "destructive" : "default"}
                onClick={() => settle(true)}
                autoFocus
              >
                {options.confirmText ?? t("confirm")}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return ctx;
}
