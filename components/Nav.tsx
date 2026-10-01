"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/types";

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-6 border-b border-hairline bg-paper px-5 shadow-[inset_0_0_2px_rgba(255,255,255,0.6)]">
      <Link href="/" className="flex items-center gap-2 text-[17px] tracking-tight">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-highlight text-[13px]">S</span>{APP_NAME}
      </Link>
      <nav className="flex gap-1">
        {[["/", "Kitchen"], ["/dashboard", "Dashboard"]].map(([href, label]) => (
          <Link key={href} href={href} className={`rounded-md px-3 py-1.5 text-sm ${path === href ? "bg-bone text-ink" : "text-ash hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>
      <span className="ml-auto hidden text-[13px] text-ash md:inline">Dunder Mifflin, Scranton · 60 people · sample data</span>
      <button className="btn-ghost text-[13px] text-ash" onClick={async () => { await fetch("/api/reset", { method: "POST" }); location.reload(); }}>Reset demo</button>
    </header>
  );
}
