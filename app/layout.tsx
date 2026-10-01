import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { APP_NAME, TAGLINE } from "@/lib/types";

const inter = Inter({ subsets: ["latin"], weight: ["400"], variable: "--font-inter" });
export const metadata: Metadata = { title: APP_NAME, description: TAGLINE, icons: { icon: "/snackoverflow-icon.svg" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
