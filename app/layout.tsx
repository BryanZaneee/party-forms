import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Party Forms",
  description: "AI-powered form builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
