"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { post, usd, useSnapshot, ZONE_LABEL } from "@/components/useSnapshot";
import type { InventoryBatch } from "@/lib/types";

export default function Waste() {
  const { data, refresh } = useSnapshot();
  const [days, setDays] = useState(3);
  const [list, setList] = useState<(InventoryBatch & { daysLeft: number })[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const load = async () => setList(await fetch(`/api/waste/check?days=${days}`).then((r) => r.json()));
  useEffect(() => { load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <div className="p-8 text-slate-500">Loading…</div>;
  const name = (id: string) => { const p = data.products.find((x) => x.id === id)!; return `${p.emoji} ${p.name}`; };
  const act = async (batchId: string, action: string) => { const r = await post<{ notification?: string }>("/api/waste/check", { batchId, action }); if (r.notification) setNote(r.notification); await load(); refresh(); };
  const byProduct = Object.values(data.waste.filter((w) => w.period === "baseline").reduce<Record<string, { name: string; usd: number }>>((a, w) => { (a[w.productId] ??= { name: name(w.productId), usd: 0 }).usd += w.costUsd; return a; }, {})).sort((a, b) => b.usd - a.usd).slice(0, 8);
  const totalBase = byProduct.reduce((a, b) => a + b.usd, 0);
  const i = data.impact.waste;
  return (
    <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-2">
      <div className="card space-y-3">
        <div className="flex items-center justify-between"><h1 className="text-xl font-bold">⏳ Expiring soon</h1>
          <label className="text-sm">within <select value={days} onChange={(e) => setDays(+e.target.value)} className="rounded border px-1">{[2, 3, 5, 7, 14].map((d) => <option key={d}>{d}</option>)}</select> days</label></div>
        {note && <div className="rounded-lg bg-slate-900 p-2 text-sm text-white">💬 Slack (mock) — {note}</div>}
        {list.length === 0 && <div className="text-sm text-slate-500">Nothing expiring. 🎉</div>}
        {list.map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
            <div className="flex-1"><div className="font-medium">{name(b.productId)} × {b.quantity} {b.eatFirst && <span className="chip bg-red-100 text-red-700">eat me first</span>}</div><div className="text-xs text-slate-500">{ZONE_LABEL[b.location.zone]}, shelf {b.location.shelf + 1} · <b className={b.daysLeft < 2 ? "text-red-600" : ""}>{b.daysLeft.toFixed(1)} days left</b></div></div>
            <button className="btn-ghost !px-2 text-xs" onClick={() => act(b.id, "eat_first")}>📣 Eat me first</button>
            <button className="btn !px-2 text-xs" onClick={() => act(b.id, "donate")}>🤝 Donate</button>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <K label="baseline waste / mo" v={usd(i.baseMonthlyUsd)} sub={`${i.baseMonthlyKg} kg`} />
          <K label="projected waste / mo" v={usd(i.projectedUsd)} sub={`${i.projectedKg} kg · −${i.reductionPct.toFixed(0)}%`} good />
          <K label="donated" v={`${i.donatedKg} kg`} sub={`${usd(i.donatedUsd)} diverted`} good />
        </div>
        <div className="card">
          <div className="font-semibold">Baseline waste concentration (8 wks)</div>
          <p className="text-xs text-slate-500">Top {byProduct.length} SKUs = {usd(totalBase)} — a few items drive most waste (cf. Fooda’s ~20% of items → ~80% of waste).</p>
          <div className="h-64"><ResponsiveContainer><BarChart data={byProduct} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={170} fontSize={11} /><Tooltip formatter={(v) => usd(Number(v), 2)} /><Legend /><Bar dataKey="usd" name="$ wasted" fill="#dc2626" /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="card text-sm"><div className="font-semibold">Waste log (live)</div>{data.waste.filter((w) => w.period === "live").map((w) => <div key={w.id} className="flex justify-between border-t py-1 text-xs"><span>{name(w.productId)} × {w.quantity} · {w.reason}</span><span>{w.kg} kg</span></div>)}{data.waste.filter((w) => w.period === "live").length === 0 && <div className="text-xs text-slate-400">No live waste yet.</div>}</div>
      </div>
    </main>
  );
}
function K({ label, v, sub, good }: { label: string; v: string; sub: string; good?: boolean }) {
  return <div className="card !p-3 text-center"><div className={`text-xl font-bold ${good ? "text-emerald-700" : "text-red-600"}`}>{v}</div><div className="text-[11px] text-slate-500">{sub}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div></div>;
}
