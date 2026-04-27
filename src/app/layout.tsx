import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "תרגול ניצנים",
  description: "אתר תרגול הבנת הנקרא לתוכנית ניצנים",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
