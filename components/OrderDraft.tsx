"use client";
import { useState } from "react";
import Thumb from "@/components/Thumb";
import { usd } from "@/components/useSnapshot";
import type { Order, OrderInsight, Product } from "@/lib/types";

const SUPPLIER: Record<string, string> = { amazon_business: "Amazon Business", costco: "Costco", instacart_business: "Instacart Business", local_wholesale: "Local Wholesale" };
const REASON: Record<string, { label: string; hi?: boolean }> = {
  trial: { label: "Trial · requested", hi: true }, restock: { label: "Staff restock", hi: true }, low_stock: { label: "Runs out before Monday" }, forecast: { label: "Forecast" },
};

type Props = {
  draft: Order | undefined; products: Product[]; fundLeft: number; busy: boolean; autoApproveUnder: number;
  onDraft: () => void; onApprove: (o: Order) => void;
};

export default function OrderDraft({ draft, products, fundLeft, busy, autoApproveUnder, onDraft, onApprove }: Props) {
  const [why, setWhy] = useState(false);
  const prod = (id: string) => products.find((p) => p.id === id)!;

  if (!draft) {
    return (
      <div className="card flex flex-col gap-4 lg:col-span-2">
        <div className="label">Next order · drafted by the agent</div>
        <div className="max-w-xl text-[28px] leading-[1.1] tracking-tight">Next Monday’s order, forecast from what people actually eat.</div>
        <p className="max-w-xl text-sm text-ash">Uses consumption per in-office person-day, hybrid attendance, shelf life, votes and the request board. Picks the cheapest supplier and stays inside the Ramp fund.</p>
        <div><button className="btn" onClick={onDraft} disabled={busy}>{busy ? "Forecasting…" : "Draft next order"}</button></div>
      </div>
    );
  }

  const ins = draft.insights ?? [];
  const forecast = ins.find((i): i is Extract<OrderInsight, { kind: "forecast" }> => i.kind === "forecast");
  const dropped = ins.filter((i): i is Extract<OrderInsight, { kind: "dropped" }> => i.kind === "dropped");
  const trial = ins.find((i): i is Extract<OrderInsight, { kind: "trial" }> => i.kind === "trial");
  const trimmed = ins.filter((i): i is Extract<OrderInsight, { kind: "trimmed" }> => i.kind === "trimmed");
  const cases = draft.lines.reduce((a, l) => a + l.cases, 0);
  const oldPrice = draft.lines.reduce((a, l) => a + l.cases * (l.baselineCasePrice ?? l.casePrice), 0);
  const saved = Math.max(0, oldPrice - draft.totalUsd);
  const bySupplier = Object.entries(draft.lines.reduce<Record<string, typeof draft.lines>>((a, l) => ((a[l.supplier] ??= []).push(l), a), {}))
    .sort((a, b) => b[1].length - a[1].length);
  const deliver = new Date(draft.deliveryAt ?? forecast?.deliveryAt ?? Date.now()).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const pctFund = Math.min(100, (draft.totalUsd / Math.max(1, fundLeft)) * 100);

  return (
    <div className="card !p-0 lg:col-span-2">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-4">
        <div>
          <div className="label">Next order · drafted by the agent · arrives {deliver}</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-[40px] leading-none tracking-tight">{usd(draft.totalUsd, 2)}</span>
            {saved > 0.5 && <span className="tag-hi">{usd(saved)} less than the old supplier</span>}
          </div>
          <div className="mt-2 text-[13px] text-ash">{draft.lines.length} {draft.lines.length === 1 ? "item" : "items"} · {cases} cases · {bySupplier.length} {bySupplier.length === 1 ? "supplier" : "suppliers"}{forecast && <> · sized for {forecast.personDays} in-office person-days, not {forecast.headcount} × 5</>}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button className="btn !h-11 !px-6" onClick={() => onApprove(draft)} disabled={busy}>{busy ? "Paying…" : "Approve & pay with Ramp"}</button>
          <button className="text-[12px] text-ash underline-offset-2 hover:text-ink hover:underline" onClick={onDraft} disabled={busy}>Re-run forecast</button>
        </div>
      </div>

      {/* fund impact */}
      <div className="mx-5 rounded-xl bg-bone p-3">
        <div className="flex justify-between text-[12px]"><span className="text-ash">Office Snacks fund</span><span>{usd(draft.totalUsd)} of {usd(fundLeft)} left this month</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-paper"><div className="h-full bg-ink" style={{ width: `${pctFund}%` }} /></div>
        <div className="mt-1.5 text-[11px] text-ash">{draft.totalUsd <= autoApproveUnder ? `Under the ${usd(autoApproveUnder)} auto-approve limit` : `Over the ${usd(autoApproveUnder)} auto-approve limit, so it needs your approval`} · paid by agent card · receipts auto-attached</div>
      </div>

      {/* what changed */}
      {(dropped.length > 0 || trial) && (
        <div className="grid gap-3 p-5 md:grid-cols-2">
          {dropped.length > 0 && (
            <div className="rounded-xl border border-hairline p-3">
              <div className="label">Not reordering · nobody eats them</div>
              <div className="mt-2 space-y-2">
                {dropped.map((d) => { const p = prod(d.productId); const s = d.substituteId ? prod(d.substituteId) : null; return (
                  <div key={d.productId} className="flex items-center gap-2 text-[13px]">
                    <Thumb src={p.image} emoji={p.emoji} size={30} />
                    <div className="min-w-0 flex-1"><div className="truncate line-through decoration-ash">{p.name}</div><div className="text-[11px] text-ash">{d.eaten} eaten in 4 wks · {Math.round(((d.netRating + 1) / 2) * 100)}% liked{d.wasted ? ` · ${d.wasted} wasted` : ""}</div></div>
                    {s && <><span className="text-ash">→</span><Thumb src={s.image} emoji={s.emoji} size={30} /></>}
                  </div>); })}
              </div>
              <div className="mt-2 text-[11px] text-ash">Arrow = closest well-liked swap by snack embeddings</div>
            </div>
          )}
          {trial && (() => { const p = prod(trial.productId); return (
            <div className="rounded-xl border border-hairline p-3">
              <div className="label">Trying something new · from the request board</div>
              <div className="mt-2 flex items-center gap-3">
                <Thumb src={p.image} emoji={p.emoji} size={52} />
                <div><div className="text-[15px]">{p.name}</div><div className="text-[12px] text-ash">Best match for “{trial.cluster}”</div><div className="mt-1"><span className="tag-hi">{trial.requests} requests · {trial.votes} votes</span></div></div>
              </div>
              <div className="mt-2 text-[11px] text-ash">One case only. It stays if people eat it.</div>
            </div>); })()}
        </div>
      )}

      {/* lines by supplier */}
      <div className="px-5 pb-2">
        {bySupplier.map(([supplier, ls]) => {
          const sub = ls.reduce((a, l) => a + l.cases * l.casePrice, 0);
          const subOld = ls.reduce((a, l) => a + l.cases * (l.baselineCasePrice ?? l.casePrice), 0);
          return (
            <div key={supplier} className="border-t border-hairline py-3 first:border-0">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-[15px]">{SUPPLIER[supplier] ?? supplier} <span className="text-[12px] text-ash">· {ls.length} items</span></div>
                <div className="text-[13px]">{usd(sub, 2)}{subOld - sub > 0.5 && <span className="ml-2 text-[12px] text-ash">saves {usd(subOld - sub)}</span>}</div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ls.map((l) => { const p = prod(l.productId); const r = REASON[l.reason ?? "forecast"]; return (
                  <div key={l.productId} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-bone">
                    <Thumb src={p.image} emoji={p.emoji} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">{p.name}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-ash">
                        <span>{l.cases} × {p.unitsPerCase} @ {usd(l.casePrice, 2)}</span>
                        {l.reason && l.reason !== "forecast" && <span className={r.hi ? "tag-hi !py-0 !text-[10px]" : "tag !py-0 !text-[10px]"}>{r.label}</span>}
                      </div>
                    </div>
                    <div className="text-[13px]">{usd(l.cases * l.casePrice, 2)}</div>
                  </div>); })}
              </div>
            </div>
          );
        })}
        {trimmed.length > 0 && <div className="pb-2 text-[12px] text-ash">Held back to stay inside the budget: {trimmed.map((t) => prod(t.productId).name).join(", ")}</div>}
      </div>

      {/* reasoning */}
      <div className="border-t border-hairline px-5 py-3">
        <button className="text-[12px] text-ash hover:text-ink" onClick={() => setWhy(!why)}>{why ? "Hide" : "Show"} the agent’s reasoning</button>
        {why && <div className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-ash">{draft.rationale}</div>}
      </div>
    </div>
  );
}
