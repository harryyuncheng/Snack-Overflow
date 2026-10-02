"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { post, usd, useSnapshot, ZONE_LABEL } from "@/components/useSnapshot";
import AskBox from "@/components/AskBox";
import Timeline from "@/components/Timeline";
import Thumb from "@/components/Thumb";
import type { ItemStatus, Overlay } from "@/components/Kitchen3D";
import type { Zone } from "@/lib/types";

const Kitchen3D = dynamic(() => import("@/components/Kitchen3D"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-ash">Walking into the kitchen…</div> });

type SearchResult = { productId: string; name: string; zone: Zone; score: number; inStock: boolean; stock: number; why: { shared: string[]; parts: { q: string; s: number }[] } };
type Search = { q: string; results: SearchResult[]; negated: string[]; dietary: string[]; parts: string[]; category: string };
type ReqResp = { fulfilledBy: (SearchResult & { location?: { shelf: number } }) | null; category: string; cluster?: { label: string; size: number; upvotes: number } };
const ZONES = ["overview", "drink_fridge", "fresh_fridge", "pantry", "coffee_bar", "fruit_bowl", "freezer"] as const;
const EXAMPLES = ["I want meat, beef jerky and protein", "salty and crunchy that isn't chips, gluten-free", "caffeine that isn't coffee", "our drinks are bad"];

export default function Kitchen() {
  const { data, refresh } = useSnapshot(1000);
  const [zone, setZone] = useState<Zone | "overview">("overview");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [dietary, setDietary] = useState("vegetarian");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState<Search | null>(null);
  const [reqResp, setReqResp] = useState<ReqResp | null>(null);
  const [frame, setFrame] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const tl = data?.timeline;
  const idx = frame ?? tl?.nowIndex ?? 0;
  const atNow = !!tl && idx === tl.nowIndex;

  const stock = useMemo(() => {
    if (!data || !tl) return {};
    if (atNow) { const s: Record<string, number> = {}; data.inventory.forEach((b) => (s[b.productId] = (s[b.productId] ?? 0) + b.quantity)); return s; }
    return Object.fromEntries(tl.productIds.map((id, i) => [id, tl.frames[idx].stock[i]]));
  }, [data, tl, idx, atNow]);

  const status = useMemo(() => {
    if (!data) return {};
    const ranked = [...data.stats].sort((a, b) => a.rate - b.rate).map((s) => s.productId);
    return Object.fromEntries(data.stats.map((s) => [s.productId, {
      lowStock: atNow && s.lowStock, nearExpiry: atNow && s.nearExpiry, eatFirst: atNow && s.eatFirst, heat: ranked.indexOf(s.productId) / ranked.length,
      netRating: s.netRating, daysToExpiry: atNow ? s.daysToExpiry : null, perDay: s.perDay,
    } satisfies ItemStatus]));
  }, [data, atNow]);

  // toast each new camera scan; the first load only records where the scan list starts
  const seenScan = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const s = data.scans[0];
    const prev = seenScan.current;
    seenScan.current = s?.id ?? "";
    if (prev === null || !s || s.id === prev) return;
    const label = (id: string) => data.products.find((p) => p.id === id)?.name ?? id;
    const stockOf = (id: string) => data.inventory.filter((b) => b.productId === id).reduce((a, b) => a + b.quantity, 0);
    setToast(`📷 ${s.diffFromExpected.map((d) => `${label(d.productId)}: ${Math.abs(d.delta)} ${d.delta < 0 ? "removed" : "added"}, ${stockOf(d.productId)} in stock`).join(" · ")}`);
    setTimeout(() => setToast(null), 5000);
  }, [data]);

  if (!data || !tl) return <div className="p-8 text-sm text-ash">Loading Snack Overflow…</div>;
  const highlights = search ? new Map(search.results.filter((r) => r.inStock && r.score > 0.2).slice(0, 4).map((r) => [r.productId, r.score])) : null;

  const doSearch = async (q: string) => {
    const r: Search = { q, ...(await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((x) => x.json())) };
    setSearch(r); setReqResp(null); setSelected(null); setFrame(null);
    const best = r.results.find((x) => x.inStock);
    if (best && best.score > 0.25) setZone(best.zone);
  };
  const doRequest = async (q: string) => {
    const r = await post<ReqResp>("/api/request", { text: q });
    setReqResp(r); refresh();
    if (r.fulfilledBy) setZone(r.fulfilledBy.zone);
  };
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3500); };

  const p = selected ? data.products.find((x) => x.id === selected) : null;
  const s = selected ? data.stats.find((x) => x.productId === selected) : null;
  const q = selected ? data.quadrants[selected] : null;

  return (
    <main className="flex h-[calc(100vh-56px)] flex-col">
      <div className="relative min-h-0 flex-1">
        <Kitchen3D products={data.products} layout={data.layout} stock={stock} status={status} overlay={overlay} dietary={dietary}
          highlights={highlights} selected={selected} onSelect={(id) => setSelected(id)} focusZone={zone} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-4">
          <div className="pointer-events-auto flex flex-wrap gap-1 rounded-xl border border-hairline bg-paper/95 p-1">
            {ZONES.map((z) => (
              <button key={z} onClick={() => setZone(z)} className={`rounded-md px-3 py-1.5 text-[13px] ${zone === z ? "bg-highlight text-ink" : "text-ash hover:text-ink"}`}>{z === "overview" ? "Overview" : ZONE_LABEL[z]}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-hairline bg-paper/95 p-1">
              {(["none", "heatmap", "waste", "dietary"] as Overlay[]).map((o) => (
                <button key={o} onClick={() => setOverlay(o)} className={`rounded-md px-3 py-1.5 text-[13px] ${overlay === o ? "bg-ink text-paper" : "text-ash hover:text-ink"}`}>
                  {{ none: "Live", heatmap: "Popularity", waste: "Expiry", dietary: "Dietary" }[o]}
                </button>
              ))}
              {overlay === "dietary" && (
                <select value={dietary} onChange={(e) => setDietary(e.target.value)} className="h-8 rounded-md border border-hairline bg-paper px-2 text-[13px]">
                  {["vegetarian", "vegan", "gluten_free", "nut_free", "dairy_free"].map((d) => <option key={d} value={d}>{d.replace("_", "-")}</option>)}
                </select>
              )}
            </div>
            <div className="group pointer-events-auto relative w-[340px]">
              <AskBox placeholder="What are you craving?" onSubmit={doSearch} />
              {!search && (
                <div className="absolute inset-x-0 top-full mt-2 hidden flex-wrap gap-1.5 rounded-xl border border-hairline bg-paper p-3 group-focus-within:flex">
                  <div className="label w-full">Try</div>
                  {EXAMPLES.map((x) => <button key={x} onClick={() => doSearch(x)} className="tag hover:border-ink hover:text-ink">{x}</button>)}
                </div>
              )}
              {search && (
                <div className="absolute inset-x-0 top-full mt-2 max-h-[calc(100vh-260px)] space-y-1.5 overflow-y-auto rounded-xl border border-hairline bg-paper p-3">
                  <div className="flex items-start justify-between gap-2 text-[12px] text-ash">
                    <span>
                      {search.parts.length > 1 ? <>Matching all {search.parts.length} asks · </> : null}
                      {search.negated.length > 0 && <>excluding {search.negated.join(", ")} · </>}
                      {search.dietary.length > 0 && <>{search.dietary.join(", ").replaceAll("_", "-")} only · </>}
                      category {search.category}
                    </span>
                    <button className="underline" onClick={() => { setSearch(null); setReqResp(null); }}>clear</button>
                  </div>
                  {search.results.slice(0, 5).map((r) => {
                    const prod = data.products.find((x) => x.id === r.productId)!;
                    return (
                      <button key={r.productId} onClick={() => { setSelected(r.productId); if (r.inStock) setZone(r.zone); }}
                        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${selected === r.productId ? "border-ink" : r.inStock ? "border-hairline hover:border-ink" : "border-dashed border-smoke opacity-70"}`}>
                        <Thumb src={prod.image} emoji={prod.emoji} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{r.name}</div>
                          <div className="truncate text-[11px] text-ash">{r.inStock ? `${ZONE_LABEL[r.zone]} · ${r.stock} left` : "Not stocked"} · match {Math.round(r.score * 100)}{r.why.shared.length > 0 && ` · ${r.why.shared.slice(0, 3).join(", ").replaceAll("_", "-")}`}</div>
                        </div>
                      </button>
                    );
                  })}
                  {reqResp ? (
                    <div className="wash text-sm">
                      {reqResp.fulfilledBy ? <>Already in stock, no purchase needed: <span className="bg-highlight px-1">{reqResp.fulfilledBy.name}</span> in the {ZONE_LABEL[reqResp.fulfilledBy.zone].toLowerCase()}{reqResp.fulfilledBy.location && `, shelf ${reqResp.fulfilledBy.location.shelf + 1}`}.</>
                        : <>Posted. Grouped with {reqResp.cluster ? `${reqResp.cluster.size - 1} similar requests in “${reqResp.cluster.label}” (${reqResp.cluster.upvotes} votes)` : "the request board"}. The ordering agent will weigh it next order.</>}
                    </div>
                  ) : <button className="btn-outline w-full" onClick={() => doRequest(search.q)}>Post as a request to the team</button>}
                </div>
              )}
            </div>
          </div>
        </div>

        {p && s && (
          <div className="card absolute bottom-10 left-4 w-[340px] space-y-3 !p-4">
            <div className="flex gap-3">
              <Thumb src={p.image} emoji={p.emoji} size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between"><div className="text-[17px] leading-tight">{p.name}</div><button onClick={() => setSelected(null)} className="text-ash" aria-label="Close">✕</button></div>
                <div className="mt-0.5 text-[12px] text-ash">{p.brand} · {ZONE_LABEL[p.zone]}{q && <> · <span className={q === "dud" ? "text-ink underline decoration-highlight decoration-2" : ""}>{{ star: "Star", guilty: "Guilty pleasure", aspirational: "Aspirational", dud: "Dud" }[q]}</span></>}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini v={`${stock[p.id] ?? 0}`} l="on shelf" />
              <Mini v={`${s.perDay.toFixed(1)}`} l="eaten / day" />
              <Mini v={`${Math.round(((s.netRating + 1) / 2) * 100)}%`} l={`liked · ${s.votes}`} />
            </div>
            <div className="flex flex-wrap gap-1">{p.dietaryTags.map((t) => <span key={t} className="tag">{t.replace("_", "-")}</span>)}{s.daysToExpiry !== null && s.daysToExpiry < 4 && <span className="tag-hi">expires in {Math.max(0, Math.round(s.daysToExpiry))}d</span>}</div>
            <Bars data={s.trend} />
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-outline" onClick={async () => { await post("/api/vote", { productId: p.id, value: 1 }); refresh(); flash(`Upvoted ${p.name}`); }}>▲ Up</button>
              <button className="btn-outline" onClick={async () => { await post("/api/vote", { productId: p.id, value: -1 }); refresh(); flash(`Downvoted ${p.name}`); }}>▼ Down</button>
              <button className="btn" onClick={async () => { await post("/api/restock", { productId: p.id }); refresh(); flash(`Restock requested for ${p.name}. Everyone can see it.`); }}>Restock</button>
            </div>
            <div className="text-[11px] text-ash">{usd(s.pricePerServing, 2)} per serving at the cheapest supplier{data.restockFlags.includes(p.id) && " · restock flagged for next order"}</div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-ash">Drag to look around · WASD to walk · scroll to step · click a snack</div>
        {toast && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl border border-hairline bg-paper px-4 py-2 text-sm">{toast}</div>}
      </div>
      <Timeline tl={tl} index={idx} onChange={setFrame} playing={playing} setPlaying={setPlaying} />
    </main>
  );
}

function Mini({ v, l }: { v: string; l: string }) {
  return <div className="rounded-xl bg-bone px-2 py-2"><div className="text-lg leading-none">{v}</div><div className="mt-1 text-[10px] text-ash">{l}</div></div>;
}
function Bars({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <div>
      <div className="flex h-10 items-end gap-1">{data.map((v, i) => <div key={i} className={`flex-1 rounded-sm ${i === data.length - 1 ? "bg-highlight" : "bg-smoke"}`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={`${v} eaten`} />)}</div>
      <div className="mt-1 text-[10px] text-ash">Eaten per week, last 8 weeks</div>
    </div>
  );
}
