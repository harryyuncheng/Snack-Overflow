"use client";
import { useEffect, useRef } from "react";
import type { Timeline as T } from "@/lib/timeline";

const KIND_MARK: Record<string, string> = { delivery: "#e4f222", scheduled: "#e4f222", switch: "#ffffff", dropped: "#ff8a80", added: "#b9f6ca", expired: "#ff8a80", donated: "#b9f6ca", stockout: "#ffb74d" };

export default function Timeline({ tl, index, onChange, playing, setPlaying }: { tl: T; index: number; onChange: (i: number) => void; playing: boolean; setPlaying: (p: boolean) => void }) {
  const n = tl.frames.length - 1;
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    let last = 0, i = index;
    const step = (ts: number) => {
      if (ts - last > 90) { last = ts; i = i >= n ? 0 : i + 1; onChange(i); }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const frame = tl.frames[index];
  const pos = (iso: string) => { const t = Date.parse(iso); const i = tl.frames.findIndex((f) => Date.parse(f.t) >= t); return ((i < 0 ? n : i) / n) * 100; };
  const switchPos = pos(tl.switchAt), nowPos = (tl.nowIndex / n) * 100;
  const phase = frame.projected ? "Projected" : Date.parse(frame.t) < Date.parse(tl.switchAt) ? "Before Snack Overflow" : "Snack Overflow on";
  const recent = tl.events.filter((e) => Date.parse(e.t) <= Date.parse(frame.t) && !["restock_request", "back_in_stock"].includes(e.kind)).slice(-1)[0];
  const units = frame.stock.reduce((a, b) => a + b, 0), skus = frame.stock.filter((x) => x > 0).length;
  return (
    <div className="bg-obsidian px-5 pb-3 pt-3 text-paper">
      <div className="flex items-center gap-4">
        <button onClick={() => setPlaying(!playing)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-highlight text-ink" aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
        <div className="w-44 shrink-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ash">{phase}</div>
          <div className="text-sm">{new Date(frame.t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric" })}</div>
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 -top-1 h-2">
            {tl.events.filter((e) => KIND_MARK[e.kind]).map((e, i) => <span key={i} className="absolute h-2 w-[2px]" style={{ left: `${pos(e.t)}%`, background: KIND_MARK[e.kind], opacity: e.projected ? 0.4 : 0.9 }} />)}
          </div>
          <div className="pointer-events-none absolute top-[9px] h-[6px] rounded-sm bg-white/10" style={{ left: `${nowPos}%`, right: 0 }} />
          <input type="range" className="timeline relative w-full" min={0} max={n} value={index} onChange={(e) => { setPlaying(false); onChange(+e.target.value); }} aria-label="Timeline" />
          <div className="relative h-4 text-[10px] uppercase tracking-[0.18em] text-ash">
            <span className="absolute" style={{ left: 0 }}>2 weeks ago</span>
            <span className="absolute -translate-x-1/2 text-paper" style={{ left: `${switchPos}%` }}>▲ Snack Overflow on</span>
            <span className="absolute -translate-x-1/2 text-highlight" style={{ left: `${nowPos}%` }}>▲ Now</span>
            <span className="absolute right-0">Next week</span>
          </div>
        </div>
        <button onClick={() => { setPlaying(false); onChange(tl.nowIndex); }} className="shrink-0 rounded-md border border-white/20 px-3 py-1 text-xs hover:bg-white/10">Jump to now</button>
      </div>
      <div className="mt-1 flex items-center gap-6 text-xs">
        <span className="text-ash">On shelves <span className="text-paper">{units}</span> items · <span className="text-paper">{skus}</span> SKUs</span>
        {recent && <span className="truncate text-paper/80"><span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-ash">{new Date(recent.t).toLocaleDateString(undefined, { weekday: "short" })} {new Date(recent.t).getHours()}:00</span>{recent.text}</span>}
      </div>
    </div>
  );
}
