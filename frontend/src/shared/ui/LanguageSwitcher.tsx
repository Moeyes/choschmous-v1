"use client";

import { useLocale } from "next-intl";
import { useSetLocale } from "@/app/providers/IntlProvider";
import { cn } from "@/shared/utils/cn";

export function LanguageSwitcher() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const isKh = locale === "kh";

  const toggle = () => setLocale(isKh ? "en" : "kh");

  return (
    <button
      onClick={toggle}
      aria-label={`Switch language. Current: ${isKh ? "Khmer" : "English"}`}
      className={cn(
        "relative rounded-full border border-border bg-card p-1 text-sm font-medium shadow-sm",
        "transition-all duration-150 ease-out hover:shadow-md hover:border-border/80 active:scale-95",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "motion-reduce:transition-none",
      )}
    >
      <span className="relative flex">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-14 rounded-full bg-primary shadow-sm",
            "transition-transform duration-300 ease-spring",
            "motion-reduce:transition-none",
            isKh ? "translate-x-0" : "translate-x-full",
          )}
        />
        <span
          className={cn(
            "relative z-10 w-14 rounded-full py-0.5 text-center transition-colors duration-150",
            isKh ? "text-primary-foreground" : "text-muted-text",
          )}
        >
          ខ្មែរ
        </span>
        <span
          className={cn(
            "relative z-10 w-14 rounded-full py-0.5 text-center transition-colors duration-150",
            !isKh ? "text-primary-foreground" : "text-muted-text",
          )}
        >
          EN
        </span>
      </span>
    </button>
  );
}
