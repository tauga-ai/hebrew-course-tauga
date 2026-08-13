import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { DevLangProvider } from "@/components/dev/DevLangProvider";
import { DevPanel } from "@/components/dev/DevPanel";
import { t, debugMode } from "@/lib/dev-i18n";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: t("תרגול ניצנים"),
  description: t("אתר תרגול הבנת הנקרא לתוכנית ניצנים"),
};

/**
 * Deliberately a plain inline script reading document.cookie directly,
 * NOT a server-side `cookies()` read in this layout — that would make
 * every route in the app dynamically rendered (a Next.js "dynamic API"
 * used in the root layout opts out every page under it from static
 * generation), which cost real static routes when tried during
 * development. This runs synchronously before paint instead, so there's
 * still no flash: explicit cookie choice wins, otherwise OS preference.
 */
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':null);if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

/**
 * Dev-only. Mirrors THEME_SCRIPT: reads the toggle cookie synchronously
 * before paint and corrects lang/dir if it disagrees with the static
 * debugMode-based default below — avoids the flash a server cookies() read
 * would otherwise require (that's why THEME_SCRIPT itself avoids a
 * server-side cookies() read in this layout: it would force every route in
 * the app into dynamic rendering, losing static generation).
 */
const DEV_LANG_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )dev-lang=(he|en)/);if(!m)return;var lang=m[1];document.documentElement.lang=lang;document.documentElement.dir=lang==='he'?'rtl':'ltr'}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={debugMode ? "en" : "he"} dir={debugMode ? "ltr" : "rtl"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {debugMode && <script dangerouslySetInnerHTML={{ __html: DEV_LANG_SCRIPT }} />}
      </head>
      <body className={`${heebo.variable} min-h-screen font-sans`}>
        <ThemeProvider>
          {debugMode ? <DevLangProvider>{children}</DevLangProvider> : children}
        </ThemeProvider>
        {debugMode && <DevPanel />}
      </body>
    </html>
  );
}
