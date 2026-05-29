import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mimo2codex++",
  description: "mimo2codex++: multi-account MiMo gateway with quota visibility and Codex setup.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
