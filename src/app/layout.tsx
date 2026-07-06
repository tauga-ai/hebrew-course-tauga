import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "תרגול ניצנים",
  description: "אתר תרגול הבנת הנקרא לתוכנית ניצנים",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${heebo.variable} min-h-screen bg-gray-50 font-sans`}>{children}</body>
    </html>
  );
}
