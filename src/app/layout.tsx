import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "תרגול ניצנים",
  description: "אתר תרגול הבנת הנקרא לתוכנית ניצנים",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${heebo.variable} min-h-screen font-sans`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
