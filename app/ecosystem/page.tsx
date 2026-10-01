"use client";
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { post, usd, useSnapshot } from "@/components/useSnapshot";
import AskBox from "@/components/AskBox";
import { useState } from "react";

const QC: Record<string, string> = { star: "#059669", guilty: "#d97706", aspirational: "#2563eb", dud: "#dc2626" };
const QL: Record<string, string> = { star: "⭐ Stars — always stock", guilty: "😈 Guilty pleasures — keep, don't expand", aspirational: "🌱 Aspirational — smaller qty, better placement", dud: "💀 Duds — drop" };

export default function Ecosystem() {
  const { data, refresh } = useSnapshot();
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) return <div className="p-8 text-slate-500">Loading…</div>;
  const pts = data.stats.filter((s) => data.quadrants[s.productId]).map((s) => { const p = data.products.find((x) => x.id === s.productId)!; return { x: +s.perDay.toFixed(2), y: Math.round(s.netRating * 100), name: `${p.emoji} ${p.name}`, q: data.quadrants[s.productId] }; });
  const sorted = [...data.stats].filter((s) => data.quadrants[s.productId]).sort((a, b) => b.perDay - a.perDay);
  const trending = [...data.stats].filter((s) => s.trend[6] + s.trend[7] > 0).sort((a, b) => (b.trend[7] + b.trend[6]) / (b.trend[0] + b.trend[1] + 1) - (a.trend[7] + a.trend[6]) / (a.trend[0] + a.trend[1] + 1)).slice(0, 5);
  const name = (id: string) => { const p = data.products.find((x) => x.id === id); return p ? `${p.emoji} ${p.name}` : id; };
  const duds = Object.entries(data.quadrants).filter(([, q]) => q === "dud");
  const byCat = data.categories.map((c) => ({ name: c.name, v: data.requests.filter((r) => r.category === c.id).reduce((a, r) => a + r.upvotes + 1, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  return (
    <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-3">
      <div className="card lg:col-span-2">
        <h1 className="text-xl font-bold">Snack ecosystem</h1>
        <p className="text-sm text-slate-600">x = consumption velocity (units/day), y = net rating from votes. Duds save <b className="text-emerald-700">{usd(data.impact.levers.droppedDuds)}/month</b> by being dropped.</p>
        <div className="h-[420px]">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" type="number" name="units/day" label={{ value: "eaten per day", position: "bottom" }} /><YAxis dataKey="y" type="number" domain={[-100, 100]} name="net rating %" />
              <ReferenceLine y={20} stroke="#94a3b8" /><ReferenceLine x={sorted[Math.floor(sorted.length / 2)]?.perDay} stroke="#94a3b8" />
              <Tooltip content={({ payload }) => payload?.[0] ? <div className="rounded bg-white p-2 text-xs shadow">{payload[0].payload.name}<br />{payload[0].payload.x}/day · {payload[0].payload.y}% net</div> : null} />
              <Scatter data={pts}>{pts.map((p, i) => <Cell key={i} fill={QC[p.q]} />)}</Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">{Object.entries(QL).map(([k, v]) => <div key={k} className="rounded p-2" style={{ background: QC[k] + "15" }}><b style={{ color: QC[k] }}>{v}</b><div className="text-slate-600">{Object.entries(data.quadrants).filter(([, q]) => q === k).map(([id]) => name(id)).slice(0, 6).join(", ")}</div></div>)}</div>
      </div>
      <div className="space-y-4">
        <div className="card space-y-2">
          <div className="font-semibold">💬 Request a snack</div>
          <AskBox placeholder="something for a 3pm slump that isn't coffee" action="Request" onSubmit={async (text) => {
            const r = await post<{ fulfilledBy: { name: string; zone: string } | null; cluster?: { label: string; size: number } }>("/api/request", { text });
            setMsg(r.fulfilledBy ? `✅ In stock: ${r.fulfilledBy.name} (${r.fulfilledBy.zone.replace("_", " ")}). No purchase needed.` : `📝 Added to cluster “${r.cluster?.label}” (${r.cluster?.size} requests).`); refresh();
          }} />
          {msg && <div className="rounded bg-slate-50 p-2 text-sm">{msg}</div>}
        </div>
        <div className="card">
          <div className="mb-2 font-semibold">🧩 Request clusters (embedding similarity)</div>
          {data.clusters.map((c, i) => (
            <div key={c.id} className="border-t py-2 text-sm first:border-0">
              <div className="flex justify-between"><b>{i === 0 && "🏆 "}{c.label}</b><span className="chip bg-violet-100 text-violet-800">{c.size} req · {c.upvotes} votes</span></div>
              <div className="text-xs text-slate-500">best catalog matches: {c.topProductIds.map(name).join(", ") || "none"}</div>
              <div className="mt-1 space-y-0.5">{c.requestIds.slice(0, 4).map((id) => { const r = data.requests.find((x) => x.id === id)!; return (
                <div key={id} className="flex items-center justify-between text-xs"><span className="truncate">“{r.text}” {r.status !== "open" && <span className="chip bg-emerald-100 text-emerald-800">{r.status.replaceAll("_", " ")}</span>}</span>
                  <button className="ml-2 shrink-0 text-slate-500 hover:text-slate-900" onClick={async () => { await post("/api/request", { id }, "PATCH"); refresh(); }}>▲ {r.upvotes}</button></div>); })}</div>
            </div>
          ))}
        </div>
      </div>
      <Board title="🏅 Top 10 eaten" rows={sorted.slice(0, 10).map((s) => [name(s.productId), `${s.perDay.toFixed(1)}/day`])} />
      <Board title="🪦 Bottom 10" rows={sorted.slice(-10).reverse().map((s) => [name(s.productId), `${s.perDay.toFixed(2)}/day · ${Math.round(s.netRating * 100)}%`])} />
      <div className="card">
        <div className="mb-2 font-semibold">📈 Trending up · 📊 demand by category</div>
        {trending.map((s) => <div key={s.productId} className="flex justify-between text-sm"><span>{name(s.productId)}</span><span className="text-emerald-700">↑</span></div>)}
        <div className="mt-2 h-40"><ResponsiveContainer><BarChart data={byCat} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={110} fontSize={11} /><Tooltip /><Bar dataKey="v" fill="#7c3aed" name="request votes" /></BarChart></ResponsiveContainer></div>
        {duds.length > 0 && <div className="mt-2 text-xs text-slate-500">Mismatch insights: <b>Quinoa Superfood Bar</b> is voted up but rarely eaten (aspirational); <b>Fiery Cheese Puffs</b> are eaten a lot but voted down (guilty pleasure).</div>}
      </div>
    </main>
  );
}
function Board({ title, rows }: { title: string; rows: [string, string][] }) {
  return <div className="card"><div className="mb-2 font-semibold">{title}</div>{rows.map(([a, b]) => <div key={a} className="flex justify-between border-t py-1 text-sm first:border-0"><span>{a}</span><span className="text-slate-500">{b}</span></div>)}</div>;
}
