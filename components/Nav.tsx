"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/types";

const links = [["/", "Kitchen"], ["/scan", "Scan"], ["/ecosystem", "Ecosystem"], ["/orders", "Orders"], ["/waste", "Waste"], ["/impact", "Impact"], ["/settings", "Settings"]];
export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-black/5 bg-white/90 px-4 py-2 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-bold"><span className="text-xl">🥞</span>{APP_NAME}</Link>
      <span className="hidden text-xs text-slate-500 md:inline">Dunder Mifflin, Scranton · sample data</span>
      <nav className="ml-auto flex gap-1 overflow-x-auto">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={`rounded-md px-2.5 py-1 text-sm ${path === href ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</Link>
        ))}
      </nav>
      <button className="btn-ghost text-xs" onClick={async () => { await fetch("/api/reset", { method: "POST" }); location.reload(); }}>Reset demo</button>
    </header>
  );
}
