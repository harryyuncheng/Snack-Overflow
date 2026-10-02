"use client";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Cell } from "recharts";
import { post, usd, useSnapshot, when } from "@/components/useSnapshot";
import Thumb from "@/components/Thumb";
import OrderDraft from "@/components/OrderDraft";
import type { Order } from "@/lib/types";

const STATUS: Record<string, string> = { star: "Star", guilty: "Guilty pleasure", aspirational: "Aspirational", dud: "Dropped (dud)" };
const LEVER: Record<string, string> = { droppedDuds: "Dropped duds", rightSizing: "Right-sized orders", attendanceScaling: "Hybrid attendance", supplierSwitching: "Cheaper suppliers" };
const AX = { fontSize: 11, fill: "#6d6c6b" };

export default function Dashboard() {
  const { data, refresh } = useSnapshot();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"perDay" | "stock" | "rating">("perDay");

  const weekly = useMemo(() => {
    if (!data) return [];
    const wk = (iso: string) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
    const m = new Map<number, { spend: number; waste: number; agent: boolean }>();
    for (const o of data.orders) if (o.status !== "draft" && o.status !== "pending_approval") { const k = wk(o.createdAt); const e = m.get(k) ?? { spend: 0, waste: 0, agent: false }; e.spend += o.totalUsd; e.agent ||= o.kind === "agent"; m.set(k, e); }
    for (const w of data.waste) if (!w.donated) { const k = wk(w.at); const e = m.get(k); if (e) e.waste += w.costUsd; }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ week: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }), spend: Math.round(v.spend), waste: Math.round(v.waste), agent: v.agent }));
  }, [data]);

  if (!data) return <div className="p-8 text-sm text-ash">Loading…</div>;
  const i = data.impact;
  const prod = (id: string) => data.products.find((p) => p.id === id)!;
  const draft = data.orders.find((o) => o.kind === "agent" && ["pending_approval", "approved", "draft"].includes(o.status) && o.lines.length > 0);
  const history = data.orders.filter((o) => o !== draft && o.status === "received");
  const baselinePrice = (id: string) => data.offers.find((o) => o.productId === id && o.supplier === "amazon_business")?.casePrice ?? 0;
  const cheapest = (id: string) => [...data.offers.filter((o) => o.productId === id)].sort((a, b) => a.casePrice - b.casePrice)[0];
  const stockOf = (id: string) => data.inventory.filter((b) => b.productId === id).reduce((a, b) => a + b.quantity, 0);
  const statusOf = (id: string) => (prod(id).trial ? "trial" : data.quadrants[id] ?? "trial");
  const rows = data.stats.filter((s) => filter === "all" || statusOf(s.productId) === filter)
    .sort((a, b) => sort === "stock" ? stockOf(b.productId) - stockOf(a.productId) : sort === "rating" ? b.netRating - a.netRating : b.perDay - a.perDay);
  const levers = Object.entries(i.levers).map(([k, v]) => ({ name: LEVER[k], v: Math.round(v) }));

  const draftOrder = async () => { setBusy(true); setErr(null); await post("/api/orders"); await refresh(); setBusy(false); };
  const approve = async (o: Order) => { setBusy(true); const r = await post<{ error?: string }>(`/api/orders/${o.id}/approve`); if (r.error) setErr(r.error); await refresh(); setBusy(false); };

  return (
    <main className="pb-24">
      <section className="mx-auto max-w-[1200px] px-5 pt-10">
        <div className="label">Office snack program · Dunder Mifflin Scranton</div>
        <h1 className="mt-2 max-w-3xl text-[40px] leading-[1.05] tracking-tight">Buy what people eat. Skip what they don’t. Pay on Ramp.</h1>
      </section>

      <section className="mt-8 bg-obsidian">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-6 px-5 py-6 md:grid-cols-6">
          <Counter l="Saved / month" v={usd(i.savedMonthly)} s={`${Math.round(i.savedPct)}% vs ${usd(i.baselineMonthly)} before`} hi />
          <Counter l="Time back / month" v={`${Math.round(i.time.hoursPerMonth)} hrs`} s="counting, polls, orders, receipts" />
          <Counter l="Expired food" v={`−${Math.round(i.waste.reductionPct)}%`} s={`${usd(i.waste.baseMonthlyUsd)} → ${usd(i.waste.projectedUsd)}/mo · ${Math.round((Date.now() - Date.parse(data.timeline.switchAt)) / 86_400_000)} days of data · ${i.waste.donatedKg} kg donated`} />
          <Counter l="Cost / employee" v={`${usd(i.costPerEmployee.now)}/mo`} s={`was ${usd(i.costPerEmployee.baseline)} · self-managed benchmark $50–150`} />
          <Counter l="People like it" v={`${Math.round(((i.satisfaction + 1) / 2) * 100)}%`} s="consumption-weighted votes" />
          <Counter l="Ramp fund left" v={usd(data.ramp.fund.limit - data.ramp.fund.spent)} s={`of ${usd(data.ramp.fund.limit)} · Office Snacks`} />
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-[1200px] gap-5 px-5 lg:grid-cols-3">
        <OrderDraft draft={draft} products={data.products} fundLeft={data.ramp.fund.limit - data.ramp.fund.spent} busy={busy}
          autoApproveUnder={data.settings.autoApproveUnder} onDraft={draftOrder} onApprove={approve} />
        {err && <div className="wash text-sm lg:col-span-3">{err}</div>}
        <div className="card">
          <div className="flex items-center justify-between"><div className="label">Ramp · Office Snacks fund</div><span className="tag">{data.ramp.mode === "mock" ? "Ramp sandbox (mock)" : "Ramp sandbox"}</span></div>
          <div className="mt-2 text-2xl tracking-tight">{usd(data.ramp.fund.limit - data.ramp.fund.spent, 2)} <span className="text-sm text-ash">left this month</span></div>
          <div className="mt-2 h-1.5 rounded-sm bg-bone"><div className="h-1.5 rounded-sm bg-highlight" style={{ width: `${Math.min(100, (data.ramp.fund.spent / data.ramp.fund.limit) * 100)}%` }} /></div>
          <div className="mt-2 text-[12px] text-ash">Groceries & food only · approved merchants: {data.ramp.fund.merchants.join(", ")}</div>
          <div className="mt-4 space-y-2">
            {data.ramp.transactions.length === 0 && <div className="text-[13px] text-ash">No agent-card charges yet this month.</div>}
            {data.ramp.transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="border-t border-hairline pt-2 text-[13px]">
                <div className="flex justify-between"><span>{t.merchant.replace("_", " ")}</span><span>{usd(t.amount, 2)}</span></div>
                <div className="text-[11px] text-ash">Receipt attached · {t.accountingCategory}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 grid max-w-[1200px] gap-5 px-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="label">Weekly spend and waste</div>
          <div className="mt-3 h-64">
            <ResponsiveContainer>
              <ComposedChart data={weekly} margin={{ left: -10, right: 10 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={AX} axisLine={false} tickLine={false} />
                <YAxis tick={AX} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v, n) => [usd(Number(v)), n]} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "none" }} />
                <Bar dataKey="spend" name="Spend" radius={[3, 3, 0, 0]}>{weekly.map((w, k) => <Cell key={k} fill={w.agent ? "#e4f222" : "#d3d3d3"} />)}</Bar>
                <Line dataKey="waste" name="Waste" stroke="#0c0a08" strokeWidth={1.5} dot={false} />
                {weekly.findIndex((w) => w.agent) > 0 && <ReferenceLine x={weekly.find((w) => w.agent)!.week} stroke="#0c0a08" strokeDasharray="3 3" label={{ value: "Snack Overflow on", fontSize: 11, fill: "#0c0a08", position: "insideTopLeft" }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[12px] text-ash"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-smoke" />before · <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-highlight" />with Snack Overflow · line = $ expired</div>
        </div>
        <div className="card">
          <div className="label">Where the savings come from · per month</div>
          <div className="mt-3 h-56">
            <ResponsiveContainer>
              <BarChart data={levers} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" tick={{ ...AX, fill: "#0c0a08" }} width={120} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => usd(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "none" }} cursor={{ fill: "#f4f2f0" }} />
                <Bar dataKey="v" fill="#0c0a08" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, fill: "#0c0a08", formatter: (v: unknown) => usd(Number(v)) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[12px] text-ash">Each lever applied in order per item, so nothing is counted twice.</div>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-[1200px] px-5">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="label">Every product</div><div className="mt-1 text-[13px] text-ash">Live stock, what people eat, what they think, and who we buy it from.</div></div>
            <div className="flex flex-wrap gap-1">
              {[["all", "All"], ["star", "Stars"], ["guilty", "Guilty pleasures"], ["aspirational", "Aspirational"], ["dud", "Dropped"], ["trial", "Trials"]].map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={`rounded-md px-2.5 py-1 text-[13px] ${filter === k ? "bg-ink text-paper" : "text-ash hover:bg-bone"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead><tr className="text-left">
                <th className="label pb-2">Product</th><th className="label pb-2">Status</th>
                <th className="label cursor-pointer pb-2" onClick={() => setSort("stock")}>On hand{sort === "stock" && " ↓"}</th>
                <th className="label cursor-pointer pb-2" onClick={() => setSort("perDay")}>Eaten / day{sort === "perDay" && " ↓"}</th>
                <th className="label cursor-pointer pb-2" onClick={() => setSort("rating")}>Liked{sort === "rating" && " ↓"}</th>
                <th className="label pb-2">8-week trend</th><th className="label pb-2">Best supplier</th><th className="label pb-2 text-right">Case</th>
              </tr></thead>
              <tbody>{rows.map((s) => { const p = prod(s.productId); const st = statusOf(s.productId); const c = cheapest(s.productId); const on = stockOf(s.productId); return (
                <tr key={s.productId} className="border-t border-hairline">
                  <td className="py-1.5"><div className="flex items-center gap-2"><Thumb src={p.image} emoji={p.emoji} size={30} /><div><div>{p.name}</div><div className="text-[11px] text-ash">{p.brand}</div></div></div></td>
                  <td>{st === "trial" ? <span className="tag-hi">Trial</span> : st === "dud" ? <span className="tag line-through">{STATUS[st]}</span> : <span className="tag">{STATUS[st]}</span>}</td>
                  <td>{on}{s.lowStock && <span className="tag-hi ml-1">low</span>}{data.restockFlags.includes(s.productId) && <span className="tag ml-1">restock asked</span>}</td>
                  <td>{s.perDay.toFixed(1)}</td>
                  <td>{s.votes ? `${Math.round(((s.netRating + 1) / 2) * 100)}%` : "–"} <span className="text-[11px] text-ash">({s.votes})</span></td>
                  <td><Spark data={s.trend} /></td>
                  <td className="text-ash">{c?.supplier.replace("_", " ")}</td>
                  <td className="text-right">{c ? usd(c.casePrice, 2) : "–"}</td>
                </tr>); })}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 grid max-w-[1200px] gap-5 px-5 lg:grid-cols-2">
        <div className="card">
          <div className="label">What people are asking for</div>
          <div className="mt-3 space-y-3">
            {data.clusters.slice(0, 6).map((c, k) => (
              <div key={c.id} className="border-t border-hairline pt-3 first:border-0 first:pt-0">
                <div className="flex items-center justify-between"><div className="text-[15px]">{c.label}</div><span className={k === 0 ? "tag-hi" : "tag"}>{c.size} requests · {c.upvotes} votes</span></div>
                <div className="mt-1 space-y-0.5">{c.requestIds.slice(0, 3).map((id) => { const r = data.requests.find((x) => x.id === id)!; return (
                  <div key={id} className="flex items-center justify-between text-[13px] text-ash"><span className="truncate">“{r.text}”{r.status === "fulfilled_from_stock" && " · in stock"}{r.status === "added" && " · added"}</span>
                    <button className="btn-ghost !h-6 shrink-0 text-[12px]" onClick={async () => { await post("/api/request", { id }, "PATCH"); refresh(); }}>▲ {r.upvotes}</button></div>); })}</div>
                {c.topProductIds[0] && <div className="mt-1 text-[12px]">Best match: {prod(c.topProductIds[0]).name}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="label">Order history</div>
          <table className="mt-3 w-full text-[13px]">
            <tbody>{history.slice(0, 12).map((o) => (
              <tr key={o.id} className="border-t border-hairline first:border-0">
                <td className="py-1.5">{when(o.createdAt).replace(/,? \d+ (AM|PM)$/, "")}</td>
                <td><span className={o.kind === "agent" ? "tag-hi" : "tag"}>{o.kind === "agent" ? "Agent" : "Manual basket"}</span></td>
                <td className="text-ash">{[...new Set(o.lines.map((l) => l.supplier.replace("_", " ")))].join(" + ")}</td>
                <td className="text-ash">{o.lines.length} SKUs</td>
                <td className="text-[11px] text-ash">{o.receiptAttached ? "receipt ✓" : "receipt missing"}</td>
                <td className="text-right">{usd(o.totalUsd)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-[1200px] px-5">
        <div className="card">
          <div className="label">Kitchen feed</div>
          <div className="mt-3 space-y-2">
            {data.feed.slice(0, 10).map((e, k) => (
              <div key={k} className="flex gap-3 border-t border-hairline pt-2 text-[13px] first:border-0 first:pt-0">
                <span className="w-14 shrink-0 text-[11px] text-ash">{new Date(e.t).toLocaleDateString(undefined, { weekday: "short" })} {new Date(e.t).getHours()}:00</span>
                <span className={e.kind === "restock_request" ? "" : "text-ink/80"}>{e.kind === "restock_request" && <span className="tag-hi mr-1">restock</span>}{e.kind === "back_in_stock" && <span className="tag mr-1">back</span>}{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-[1200px] px-5">
        <details className="card">
          <summary className="cursor-pointer text-[15px]">How we calculate this</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] text-ash">
            <li><span className="text-ink">Before:</span> a fixed weekly basket sized for full headcount ({data.office.headcount}) × 5 days with a 10% cushion, bought in whole cases from one supplier, no consumption data. Two weeks of that are in the timeline; eight more weeks of history sit behind it.</li>
            <li><span className="text-ink">With Snack Overflow:</span> demand = recent units eaten per in-office person-day × next week’s hybrid attendance ({Object.entries(data.office.inOfficeDays).map(([d, v]) => `${d} ${Math.round(v * 100)}%`).join(", ")}) + one day of safety stock, capped by shelf life. Duds (bottom velocity and net-negative votes) are dropped and donated; the top request cluster gets a trial.</li>
            <li><span className="text-ink">Time:</span> {data.settings.minutes.countPerSku} min per item to count twice a week, {data.settings.minutes.pollingPerWeek} min/week of Slack polls, {data.settings.minutes.orderingPerOrder} min per order, {data.settings.minutes.receiptPerOrder} min per order chasing receipts, {data.settings.minutes.reconciliationPerMonth} min/month reconciling.</li>
            <li><span className="text-ink">Context:</span> ZeroCater surveyed 54 Bay Area companies spending ~$14.8k/month on snacks; 59% run the program themselves. Workplace waste-tracking studies show 23–51% less food waste. Fooda finds ~20% of items cause ~80% of waste.</li>
            <li>Company, people and prices are sample data. Product photos: Open Food Facts (CC BY-SA).</li>
          </ul>
        </details>
      </section>
    </main>
  );
}

function Counter({ l, v, s, hi }: { l: string; v: string; s: string; hi?: boolean }) {
  return <div><div className="text-[10px] uppercase tracking-[0.18em] text-ash">{l}</div><div className={`mt-1 text-[28px] leading-none tracking-tight ${hi ? "text-highlight" : "text-paper"}`}>{v}</div><div className="mt-1.5 text-[11px] text-ash">{s}</div></div>;
}
function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return <div className="flex h-5 w-20 items-end gap-[2px]">{data.map((v, k) => <div key={k} className={`flex-1 rounded-[1px] ${k === data.length - 1 ? "bg-ink" : "bg-smoke"}`} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />)}</div>;
}
