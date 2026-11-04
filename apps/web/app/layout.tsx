import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Saturn — early-phase building design", description: "Site, massing, KPIs, code checks and analyses in the browser." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
