import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { APP_NAME, TAGLINE } from "@/lib/types";

export const metadata: Metadata = { title: APP_NAME, description: TAGLINE };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-slate-900 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
