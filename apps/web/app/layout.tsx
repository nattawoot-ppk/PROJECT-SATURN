import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = { title: "Saturn — early-phase building design", description: "Site, massing, KPIs, code checks and analyses in the browser." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen antialiased" style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
