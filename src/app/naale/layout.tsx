import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "לימוד עברית",
};

export default function NaaleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
