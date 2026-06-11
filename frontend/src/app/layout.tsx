import type { Metadata } from "next";
import { Kantumruy_Pro, Work_Sans, Public_Sans } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { QueryProvider } from "./providers/QueryProvider";
import { IntlProvider, type AppLocale } from "./providers/IntlProvider";
import { AppAuthProvider } from "./providers/AuthProvider";
import { ConfirmDialogProvider } from "@/shared/ui/ConfirmDialog";
import "./globals.css";

const kantumruyPro = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-kantumruy",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

// Latin face for the athlete-registration reskin (design handoff). Khmer glyphs
// fall back to Kantumruy Pro via the scoped `--font` stack.
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Moeys Sports",
    default: "Moeys Sports - Event Management",
  },
  description: "Professional sports event and registration platform",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as AppLocale;

  return (
    <html
      lang={locale}
      className={`h-full antialiased light ${kantumruyPro.variable} ${workSans.variable} ${publicSans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <IntlProvider initialLocale={locale}>
          <AppAuthProvider>
            <QueryProvider>
              <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            </QueryProvider>
          </AppAuthProvider>
        </IntlProvider>
        <Toaster
          position="top-right"
          theme="light"
          richColors
          closeButton
          toastOptions={{
            className:
              "font-sans leading-relaxed rounded-md border border-border",
          }}
        />
      </body>
    </html>
  );
}
