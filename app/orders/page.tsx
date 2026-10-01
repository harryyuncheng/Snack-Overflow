"use client";
import { useState } from "react";
import { post, usd, useSnapshot } from "@/components/useSnapshot";
import type { Order } from "@/lib/types";

export default function Orders() {
  const { data, refresh } = useSnapshot();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return <div className="p-8 text-slate-500">Loading…</div>;
  const draft = data.orders.find((o) => o.kind === "agent" && ["pending_approval", "approved", "draft"].includes(o.status));
  const history = data.orders.filter((o) => o !== draft);
  const name = (id: string) => { const p = data.products.find((x) => x.id === id)!; return `${p.emoji} ${p.name}`; };
  const baselinePrice = (id: string) => data.offers.find((o) => o.productId === id && o.supplier === "amazon_business")?.casePrice ?? 0;
  const generate = async () => { setBusy(true); setErr(null); await post("/api/orders"); await refresh(); setBusy(false); };
  const approve = async (o: Order) => { setBusy(true); const r = await post<{ error?: string }>(`/api/orders/${o.id}/approve`); if (r.error) setErr(r.error); await refresh(); setBusy(false); };
  return (
    <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-3">
      <div className="card space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div><h1 className="text-xl font-bold">🤖 Ordering agent</h1><p className="text-sm text-slate-600">EWMA velocity × in-office person-days until next delivery + safety stock − on hand, capped by shelf life, budget, and supplier minimums.</p></div>
          <button className="btn" onClick={generate} disabled={busy}>{busy ? "Working…" : "Draft next order"}</button>
        </div>
        {err && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        {!draft ? <div className="rounded-lg border-2 border-dashed p-8 text-center text-slate-500">No draft yet. Click “Draft next order”.</div> : (
          <>
            <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1 text-xs font-semibold uppercase text-slate-500">Rationale</div><pre className="whitespace-pre-wrap font-sans text-sm">{draft.rationale}</pre></div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th>Item</th><th>Cases</th><th>Supplier</th><th>Case $</th><th>vs baseline</th><th>Line</th></tr></thead>
              <tbody>{draft.lines.map((l) => { const save = (baselinePrice(l.productId) - l.casePrice) * l.cases; return (
                <tr key={l.productId} className="border-t" title={l.note}><td className="py-1">{name(l.productId)}{l.note?.startsWith("trial") && <span className="chip ml-1 bg-violet-100 text-violet-800">trial</span>}</td><td>{l.cases}</td><td className="text-xs">{l.supplier.replace("_", " ")}</td><td>{usd(l.casePrice, 2)}</td><td className={save > 0 ? "text-emerald-700" : "text-slate-400"}>{save > 0 ? `−${usd(save, 2)}` : "–"}</td><td>{usd(l.cases * l.casePrice, 2)}</td></tr>); })}</tbody>
            </table>
            <div className="flex items-center justify-between border-t pt-3">
              <div className="text-lg font-bold">Total {usd(draft.totalUsd, 2)} <span className="text-sm font-normal text-slate-500">· {draft.status === "approved" ? `auto-approved (under ${usd(data.settings.autoApproveUnder)})` : "needs office manager approval"}</span></div>
              <button className="btn !bg-emerald-600" onClick={() => approve(draft)} disabled={busy}>{draft.status === "approved" ? "Place on Ramp" : "Approve & pay with Ramp"}</button>
            </div>
          </>
        )}
      </div>
      <div className="space-y-4">
        <div className="card text-sm">
          <div className="flex items-center justify-between"><div className="font-semibold">💳 Ramp · {data.ramp.fund.name}</div><span className="chip bg-yellow-100 text-yellow-900">Ramp ({data.ramp.mode})</span></div>
          <div className="mt-2 text-2xl font-bold">{usd(data.ramp.fund.limit - data.ramp.fund.spent, 2)} <span className="text-sm font-normal text-slate-500">left of {usd(data.ramp.fund.limit)} / mo</span></div>
          <div className="text-xs text-slate-500">Categories: {data.ramp.fund.categories.join(", ")} · Merchants: {data.ramp.fund.merchants.join(", ")}</div>
          <div className="mt-2 space-y-1">{data.ramp.transactions.length === 0 ? <div className="text-xs text-slate-400">No transactions yet this month.</div> : data.ramp.transactions.map((t) => (
            <div key={t.id} className="rounded bg-slate-50 p-2 text-xs"><div className="flex justify-between"><b>{t.merchant.replace("_", " ")}</b><b>{usd(t.amount, 2)}</b></div><div className="text-slate-500">{t.id} · {t.accountingCategory} · {t.receiptAttached ? "🧾 receipt auto-attached" : "missing receipt"}</div><div className="text-slate-500">{t.memo}</div></div>
          ))}</div>
          <PolicyBox />
        </div>
        <div className="card">
          <div className="mb-2 font-semibold">History</div>
          {history.slice(0, 10).map((o) => (
            <div key={o.id} className="flex justify-between border-t py-1 text-xs first:border-0"><span>{new Date(o.createdAt).toLocaleDateString()} · {o.kind === "baseline" ? "baseline basket" : "agent"} · {o.lines.length} SKUs {o.receiptAttached ? "🧾" : "⚠️ no receipt"}</span><b>{usd(o.totalUsd)}</b></div>
          ))}
        </div>
      </div>
    </main>
  );
}
function PolicyBox() {
  const [a, setA] = useState<string | null>(null);
  return (
    <form className="mt-3 border-t pt-2" onSubmit={async (e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get("q") as string; const r = await post<{ allowed: boolean; reason: string }>("/api/policy", { q }); setA(`${r.allowed ? "✅" : "⛔"} ${r.reason}`); }}>
      <div className="text-xs font-semibold">Ask Ramp policy</div>
      <div className="mt-1 flex gap-1"><input name="q" defaultValue="Can I buy beer for Friday on the snack fund?" className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" /><button className="btn !py-1 text-xs">Ask</button></div>
      {a && <div className="mt-1 text-xs">{a}</div>}
    </form>
  );
}
