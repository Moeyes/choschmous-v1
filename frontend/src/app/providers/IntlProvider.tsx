"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import enMessages from "@/messages/en.json";
import khMessages from "@/messages/kh.json";

export type AppLocale = "en" | "kh";

// Both bundles are tiny (~6–7 KB gzip each), so we ship both to the client and
// swap the active one in React state. This makes language switching instant —
// no server round-trip / router.refresh(), no page flash. The cookie is still
// written so a hard reload / new tab / SSR picks the same language.
const MESSAGES: Record<AppLocale, AbstractIntlMessages> = {
  en: enMessages as AbstractIntlMessages,
  kh: khMessages as AbstractIntlMessages,
};

const SetLocaleContext = createContext<(locale: AppLocale) => void>(() => {});

/** Swap the app language instantly (client-side), no refresh. */
export function useSetLocale() {
  return useContext(SetLocaleContext);
}

export function IntlProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  const setLocale = useCallback((next: AppLocale) => {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    // BCP-47: Khmer is "km". Keep the document lang attribute accurate for a11y.
    document.documentElement.lang = next === "kh" ? "km" : "en";
    setLocaleState(next);
  }, []);

  return (
    <SetLocaleContext.Provider value={setLocale}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Asia/Phnom_Penh">
        {children}
      </NextIntlClientProvider>
    </SetLocaleContext.Provider>
  );
}
