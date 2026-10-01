"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { post, usd, useSnapshot, ZONE_LABEL } from "@/components/useSnapshot";
import AskBox from "@/components/AskBox";
import Sparkline from "@/components/Sparkline";
import type { Overlay } from "@/components/Kitchen3D";
import type { Zone } from "@/lib/types";
import { TAGLINE } from "@/lib/types";

const Kitchen3D = dynamic(() => import("@/components/Kitchen3D"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-slate-400">Loading kitchen…</div> });

type SearchResult = { productId: string; name: string; emoji: string; zone: Zone; score: number; inStock: boolean; stock: number; why: { shared: string[]; penalized: string[] } };
type ReqResp = { fulfilledBy: (SearchResult & { location?: { zone: Zone; shelf: number } }) | null; results: SearchResult[]; category: string; cluster?: { label: string; size: number; upvotes: number } };

export default function Home() {
  const { data, refresh } = useSnapshot();
  const [zone, setZone] = useState<Zone | "overview">("overview");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [dietary, setDietary] = useState("vegan");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState<{ q: string; results: SearchResult[]; negated: string[]; dietary: string[]; category: string } | null>(null);
  const [reqResp, setReqResp] = useState<ReqResp | null>(null);
  const [subs, setSubs] = useState<{ productId: string; name: string; emoji: string; score: number }[]>([]);

  if (!data) return <div className="p-8 text-slate-500">Loading Snack Overflow…</div>;
  const highlights = search ? new Map(search.results.filter((r) => r.inStock && r.score > 0.15).map((r) => [r.productId, r.score])) : null;

  const doSearch = async (q: string) => {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((x) => x.json());
    setSearch({ q, ...r }); setReqResp(null); setSelected(null);
    const best = r.results.find((x: SearchResult) => x.inStock);
    if (best) setZone(best.zone);
  };
  const doRequest = async (q: string) => {
    const r = await post<ReqResp>("/api/request", { text: q });
    setReqResp(r); refresh();
    if (r.fulfilledBy) setZone(r.fulfilledBy.zone);
  };
  const select = async (id: string) => {
    setSelected(id); setSubs(await fetch(`/api/substitutes/${id}`).then((x) => x.json()));
  };
  const p = selected ? data.products.find((x) => x.id === selected) : null;
  const s = selected ? data.stats.find((x) => x.productId === selected) : null;
  const zoneCounts = (z: Zone) => data.inventory.filter((b) => b.location.zone === z).reduce((a, b) => a + b.quantity, 0);
  const alerts = data.stats.filter((x) => x.nearExpiry).length;

  return (
    <main className="relative flex h-[calc(100vh-49px)]">
      <div className="relative flex-1">
        <Kitchen3D data={data} zone={zone} overlay={overlay} dietary={dietary} highlights={highlights} selected={selected} onSelect={select} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
          <div className="pointer-events-auto flex flex-wrap gap-1">
            {(["overview", "drink_fridge", "fresh_fridge", "pantry", "coffee_bar", "fruit_bowl", "freezer"] as const).map((z) => (
              <button key={z} onClick={() => setZone(z)} className={`rounded-full px-3 py-1 text-xs font-medium shadow ${zone === z ? "bg-slate-900 text-white" : "bg-white/90 text-slate-700 hover:bg-white"}`}>
                {z === "overview" ? "🏢 Overview" : `${ZONE_LABEL[z]} · ${zoneCounts(z)}`}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center gap-1 text-xs">
            {(["none", "heatmap", "waste", "dietary"] as Overlay[]).map((o) => (
              <button key={o} onClick={() => setOverlay(o)} className={`rounded-md px-2 py-1 shadow ${overlay === o ? "bg-cyan-600 text-white" : "bg-white/90"}`}>
                {{ none: "Live", heatmap: "🔥 Popularity heatmap", waste: "⏳ Waste risk", dietary: "🥦 Dietary filter" }[o]}
              </button>
            ))}
            {overlay === "dietary" && (
              <select value={dietary} onChange={(e) => setDietary(e.target.value)} className="rounded-md bg-white px-2 py-1 shadow">
                {["vegan", "vegetarian", "gluten_free", "nut_free", "dairy_free"].map((d) => <option key={d}>{d}</option>)}
              </select>
            )}
            {overlay === "heatmap" && <span className="rounded bg-white/90 px-2 py-1 shadow"><span className="text-blue-600">■ slow</span> → <span className="text-red-600">■ hot</span></span>}
          </div>
        </div>
        <div className="absolute bottom-3 left-3 flex gap-2 text-xs">
          <span className="rounded-md bg-white/90 px-2 py-1 shadow">🟠 low stock · 🔴 expiring ≤3d ({alerts}) · click fridge doors to open</span>
        </div>
      </div>

      <aside className="flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-black/5 bg-white p-4">
        <div>
          <div className="text-xs text-slate-500">{TAGLINE}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Stat label="saved / mo" value={usd(data.impact.savedMonthly)} />
            <Stat label="hours back / mo" value={`${data.impact.time.hoursPerMonth}h`} />
            <Stat label="waste ↓" value={`${data.impact.waste.reductionPct.toFixed(0)}%`} />
          </div>
        </div>
        <div className="card space-y-2 !p-3">
          <div className="text-sm font-semibold">🔎 Ask the pantry</div>
          <AskBox placeholder='"salty and crunchy that isn&apos;t chips, gluten-free"' onSubmit={doSearch} />
          <div className="flex flex-wrap gap-1">
            {["something salty and crunchy that isn't chips, gluten-free", "caffeine that isn't coffee", "sweet but not candy", "high-protein snack"].map((q) => (
              <button key={q} onClick={() => doSearch(q)} className="chip bg-slate-100 hover:bg-slate-200">{q}</button>
            ))}
          </div>
          {search && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>category → <b>{search.category}</b>{search.negated.length > 0 && <> · excluding <b>{search.negated.join(", ")}</b></>}{search.dietary.length > 0 && <> · must be <b>{search.dietary.join(", ")}</b></>}</span>
                <button className="underline" onClick={() => setSearch(null)}>clear</button>
              </div>
              {search.results.map((r) => (
                <div key={r.productId} className={`flex items-center gap-2 rounded-lg p-1.5 text-sm ${r.inStock ? "bg-cyan-50" : "bg-slate-50 opacity-70"}`}>
                  <span className="text-lg">{r.emoji}</span>
                  <button className="flex-1 text-left" onClick={() => { select(r.productId); if (r.inStock) setZone(r.zone); }}>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-slate-500">sim {r.score.toFixed(2)}{r.why.shared.length > 0 && ` · shares: ${r.why.shared.join(", ")}`} · {r.inStock ? `${ZONE_LABEL[r.zone]} (${r.stock})` : "not stocked (ghost)"}</div>
                  </button>
                  {!r.inStock && <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => doRequest(`${search.q} — e.g. ${r.name}`)}>request</button>}
                </div>
              ))}
              <button className="btn w-full" onClick={() => doRequest(search.q)}>Submit as a request</button>
            </div>
          )}
          {reqResp && (
            <div className={`rounded-lg p-2 text-sm ${reqResp.fulfilledBy ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
              {reqResp.fulfilledBy ? (
                <>✅ <b>Already in stock, no purchase needed.</b> {reqResp.fulfilledBy.emoji} {reqResp.fulfilledBy.name} is in the {ZONE_LABEL[reqResp.fulfilledBy.zone]}{reqResp.fulfilledBy.location && `, shelf ${reqResp.fulfilledBy.location.shelf + 1}`}.</>
              ) : (
                <>📝 Logged for the ordering agent (category <b>{reqResp.category}</b>).{reqResp.cluster && <> Clustered into <b>“{reqResp.cluster.label}”</b> with {reqResp.cluster.size - 1} similar requests ({reqResp.cluster.upvotes} votes).</>}</>
              )}
            </div>
          )}
        </div>

        {p && s && (
          <div className="card space-y-2 !p-3">
            <div className="flex items-start justify-between">
              <div><div className="text-lg font-semibold">{p.emoji} {p.name}</div><div className="text-xs text-slate-500">{p.brand} · {ZONE_LABEL[p.zone]} · {data.quadrants[p.id] ?? "trial"}</div></div>
              <button onClick={() => setSelected(null)} className="text-slate-400">✕</button>
            </div>
            <p className="text-xs text-slate-600">{p.description}</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div>Stock: <b>{s.stock}</b></div><div>Expires: <b className={s.nearExpiry ? "text-red-600" : ""}>{s.daysToExpiry ?? "–"}d</b></div>
              <div>Velocity: <b>{s.perDay.toFixed(1)}/day</b></div><div>Price/serving: <b>{usd(s.pricePerServing, 2)}</b></div>
              <div>Rating: <b>{Math.round(s.netRating * 100)}%</b> ({s.up}👍 {s.down}👎)</div><div>{p.caloriesPerServing} kcal</div>
            </div>
            <div className="flex flex-wrap gap-1">{p.dietaryTags.map((t) => <span key={t} className="chip bg-emerald-100 text-emerald-800">{t}</span>)}{p.flavorProfile.map((t) => <span key={t} className="chip bg-slate-100">{t}</span>)}</div>
            <div><div className="text-xs text-slate-500">Eaten per week (8 wks)</div><Sparkline data={s.trend} /></div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={async () => { await post("/api/vote", { productId: p.id, value: 1 }); refresh(); }}>👍</button>
              <button className="btn-ghost flex-1" onClick={async () => { await post("/api/vote", { productId: p.id, value: -1 }); refresh(); }}>👎</button>
              <button className="btn flex-1" onClick={() => doRequest(`more ${p.name}`)}>Request more</button>
            </div>
            {subs.length > 0 && <div className="text-xs"><div className="text-slate-500">People who like this also eat (embedding neighbors)</div>{subs.map((x) => <button key={x.productId} onClick={() => select(x.productId)} className="mr-1 mt-1 chip bg-violet-50 text-violet-800">{x.emoji} {x.name} · {x.score.toFixed(2)}</button>)}</div>}
          </div>
        )}

        <div className="card !p-3 text-sm">
          <div className="flex items-center justify-between"><div className="font-semibold">💳 {data.ramp.fund.name}</div><span className="chip bg-yellow-100 text-yellow-900">Ramp ({data.ramp.mode})</span></div>
          <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-yellow-400" style={{ width: `${Math.min(100, (data.ramp.fund.spent / data.ramp.fund.limit) * 100)}%` }} /></div>
          <div className="mt-1 text-xs text-slate-500">{usd(data.ramp.fund.limit - data.ramp.fund.spent)} left of {usd(data.ramp.fund.limit)} this month</div>
        </div>
      </aside>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-2"><div className="text-lg font-bold text-emerald-700">{value}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div></div>;
}
