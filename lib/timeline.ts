import { catalogMeta } from "./catalog";
import { planogram } from "./layout";
import { scenario } from "./data";
import type { ConsumptionEvent, InventoryBatch, Office, Order, Product, SupplierOffer, WasteEvent } from "./types";
import { BASELINE_SUPPLIER, DAY, baselineWeeklyUnits, dayKey, rng, round2, startOfDay } from "./seed-utils";

/**
 * Two-week+ hourly simulation of the kitchen, ending in a short projected future.
 * Week 1 runs the old way (fixed headcount basket, one supplier); Snack Overflow switches on at the start of week 2.
 * Deliveries arrive Mon (full order) and Thu (perishables top-up) at 8am. Frames are every workday hour 8:00–18:00.
 */
export type TimelineEvent = {
  t: string; kind: "delivery" | "switch" | "dropped" | "added" | "expired" | "donated" | "stockout" | "restock_request" | "back_in_stock" | "scheduled";
  productId?: string; qty?: number; usd?: number; text: string; projected?: boolean;
};
export type Frame = { t: string; stock: number[]; projected: boolean };
export type Timeline = { productIds: string[]; frames: Frame[]; events: TimelineEvent[]; nowIndex: number; switchAt: string; start: string };

const HOUR_SHARE: Record<number, number> = Object.fromEntries(Object.entries(scenario.hourShare).map(([h, v]) => [Number(h), v]));
const DUDS = scenario.duds;
const TRIAL_ADD = scenario.trialAdd;

type Batch = { productId: string; qty: number; receivedAt: number; expiresAt: number };

export function simulate(args: { now: number; office: Office; products: Product[]; offers: SupplierOffer[] }) {
  const { now, office, products, offers } = args;
  const r = rng(7);
  const monday = (t: number) => { const d = new Date(startOfDay(t)); return d.getTime() - ((d.getDay() + 6) % 7) * DAY; };
  const start = monday(now - 14 * DAY);
  const switchAt = start + 7 * DAY + 8 * 3600_000;
  const nextMonday = monday(now) + 7 * DAY;
  const end = nextMonday + 2 * DAY + 18 * 3600_000; // project through next Wednesday
  const ids = products.map((p) => p.id);
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const avgPop = products.filter((p) => !p.trial).reduce((a, p) => a + catalogMeta[p.id].pop, 0) / products.filter((p) => !p.trial).length;
  const active = new Set(products.filter((p) => !p.trial).map((p) => p.id));
  const batches: Batch[] = [];
  const events: TimelineEvent[] = [];
  const frames: Frame[] = [];
  const consumption: ConsumptionEvent[] = [];
  const waste: WasteEvent[] = [];
  const orders: Order[] = [];
  const stockOf = (id: string) => batches.filter((b) => b.productId === id).reduce((a, b) => a + b.qty, 0);
  const iso = (t: number) => new Date(t).toISOString();
  const unitPrice = (id: string, supplier = BASELINE_SUPPLIER) => (offers.find((o) => o.productId === id && o.supplier === supplier)?.casePrice ?? 0) / byId[id].unitsPerCase;
  const cheapest = (id: string) => offers.filter((o) => o.productId === id).sort((a, b) => a.casePrice - b.casePrice)[0];
  const rate = (id: string) => catalogMeta[id].pop;
  const pdBetween = (a: number, b: number) => { let pd = 0; for (let t = startOfDay(a); t < b; t += DAY) { const k = dayKey(new Date(t)); if (k) pd += office.headcount * office.inOfficeDays[k]; } return pd; };

  // opening stock: last week's leftovers, duds piling up
  for (const p of products) {
    if (p.trial) continue;
    const qty = DUDS.includes(p.id) ? 18 + Math.floor(r() * 8) : Math.round(rate(p.id) * office.headcount * (0.6 + r() * 0.8));
    if (qty > 0) batches.push({ productId: p.id, qty, receivedAt: start - 4 * DAY, expiresAt: start - 4 * DAY + p.shelfLifeDays * DAY });
  }

  const deliver = (t: number, projected: boolean) => {
    const agent = t >= switchAt;
    const thursday = new Date(t).getDay() === 4;
    const lines: Order["lines"] = [];
    if (agent && t === switchAt) {
      events.push({ t: iso(t), kind: "switch", text: "Snack Overflow switched on: orders now follow consumption, votes and requests." });
      for (const id of DUDS) {
        active.delete(id);
        const left = stockOf(id);
        events.push({ t: iso(t + 3600_000), kind: "dropped", productId: id, text: `Dropped ${byId[id].name}: ${Math.round(rate(id) * 100 * office.headcount * 5) / 100} eaten/week, net-negative votes.` });
        if (left) {
          batches.splice(0, batches.length, ...batches.filter((b) => b.productId !== id));
          waste.push({ id: `wd-${id}`, productId: id, quantity: left, reason: "donated", costUsd: round2(left * unitPrice(id)), kg: round2(left * byId[id].weightKg), at: iso(t + 2 * 3600_000), donated: true, period: "live" });
          events.push({ t: iso(t + 2 * 3600_000), kind: "donated", productId: id, qty: left, text: `Donated ${left} × ${byId[id].name} to the Scranton food bank before expiry.` });
        }
      }
      active.add(TRIAL_ADD);
      events.push({ t: iso(t), kind: "added", productId: TRIAL_ADD, text: `Trialing ${byId[TRIAL_ADD].name}: top match for the "Non-coffee caffeine" request cluster (9 requests).` });
    }
    for (const id of active) {
      const p = byId[id];
      if (thursday && !p.perishable) continue;
      let units: number;
      if (!agent) units = thursday ? baselineWeeklyUnits(p, office.headcount, avgPop) * 0.5 : baselineWeeklyUnits(p, office.headcount, avgPop);
      else {
        // non-perishables only arrive on Mondays; perishables also get a Thursday top-up
        const until = thursday || !p.perishable ? t + (thursday ? 4 : 7) * DAY : t + 3 * DAY;
        const horizon = Math.min(until, t + p.shelfLifeDays * DAY);
        const usable = batches.filter((b) => b.productId === id && b.expiresAt > until).reduce((a, b) => a + b.qty, 0);
        units = rate(id) * pdBetween(t, horizon) * (p.perishable ? 1.05 : 1.25) - usable;
        if (units < p.unitsPerCase * 0.2) continue;
      }
      const offer = agent ? cheapest(id) : offers.find((o) => o.productId === id && o.supplier === BASELINE_SUPPLIER)!;
      const cases = agent && p.perishable ? Math.max(1, Math.floor(units / p.unitsPerCase + 0.35)) : Math.max(1, Math.round(units / p.unitsPerCase) || 1);
      lines.push({ productId: id, cases, casePrice: offer.casePrice, supplier: offer.supplier });
      batches.push({ productId: id, qty: cases * p.unitsPerCase, receivedAt: t, expiresAt: t + p.shelfLifeDays * DAY });
    }
    const total = round2(lines.reduce((a, l) => a + l.cases * l.casePrice, 0));
    const suppliers = [...new Set(lines.map((l) => l.supplier))];
    orders.push({
      id: `${agent ? "ord" : "base"}-${new Date(t).toISOString().slice(0, 10)}`, supplier: suppliers.length > 1 ? "multi" : suppliers[0], lines, totalUsd: total,
      status: projected ? "draft" : "received", receiptAttached: agent, rationale: agent ? "Agent order: forecast from consumption, attendance and requests." : "Baseline: fixed basket by headcount (pre-Snack Overflow).",
      createdAt: iso(t), kind: agent ? "agent" : "baseline", memo: agent && !projected ? "Paid on Ramp \"Office Snacks\" fund via agent card; receipt auto-attached." : undefined,
    });
    events.push({ t: iso(t), kind: projected ? "scheduled" : "delivery", qty: lines.reduce((a, l) => a + l.cases, 0), usd: total, projected,
      text: `${projected ? "Scheduled" : "Delivered"}: ${thursday ? "perishables top-up" : "weekly order"}, ${lines.length} SKUs, $${total.toFixed(0)}${agent ? ` via ${suppliers.map((s) => s.replace("_", " ")).join(" + ")}` : " from amazon business"}.` });
  };

  const out = new Set<string>();
  let snapshot: Batch[] = [];
  for (let day = start; day <= end; day += DAY) {
    const dk = dayKey(new Date(day));
    if (!dk) continue;
    for (let h = 8; h <= 18; h++) {
      const t = day + h * 3600_000;
      const projected = t > now;
      const dow = new Date(day).getDay();
      if (h === 8 && (dow === 1 || dow === 4)) deliver(t, projected);
      // expiries
      for (const b of [...batches]) if (b.expiresAt <= t && b.qty > 0) {
        const p = byId[b.productId];
        if (!projected) waste.push({ id: `wx-${b.productId}-${t}`, productId: b.productId, quantity: b.qty, reason: "expired", costUsd: round2(b.qty * unitPrice(b.productId)), kg: round2(b.qty * p.weightKg), at: iso(t), period: b.receivedAt < switchAt ? "baseline" : "live" });
        events.push({ t: iso(t), kind: "expired", productId: b.productId, qty: b.qty, projected, text: `${b.qty} × ${p.name} expired${b.receivedAt < switchAt ? " (bought under the old fixed basket)" : ""}.` });
        batches.splice(batches.indexOf(b), 1);
      }
      // consumption during the previous hour
      if (HOUR_SHARE[h - 1]) for (const id of ids) {
        if (!batches.some((b) => b.productId === id)) continue;
        const mean = rate(id) * office.headcount * office.inOfficeDays[dk] * HOUR_SHARE[h - 1];
        const want = projected ? mean : mean * (0.5 + r());
        let q = Math.floor(want) + (r() < want % 1 ? 1 : 0);
        if (!q) continue;
        let taken = 0;
        for (const b of batches.filter((x) => x.productId === id).sort((a, c) => a.expiresAt - c.expiresAt)) {
          const k = Math.min(b.qty, q); b.qty -= k; q -= k; taken += k; if (!q) break;
        }
        for (let i = batches.length - 1; i >= 0; i--) if (batches[i].qty <= 0) batches.splice(i, 1);
        if (taken && !projected) consumption.push({ id: `h-${id}-${t}`, productId: id, quantity: taken, at: iso(t - 1800_000), source: "checkout" });
        if (!stockOf(id) && !out.has(id)) {
          out.add(id);
          events.push({ t: iso(t), kind: "stockout", productId: id, projected, text: `${byId[id].name} ran out at ${h}:00.` });
          if (!projected && rate(id) > 0.05) events.push({ t: iso(t + 600_000), kind: "restock_request", productId: id, text: `Someone asked for more ${byId[id].name}.` });
        }
      }
      for (const id of [...out]) if (stockOf(id) > 0) { out.delete(id); events.push({ t: iso(t), kind: "back_in_stock", productId: id, projected, text: `${byId[id].name} is back in stock.` }); }
      frames.push({ t: iso(t), stock: ids.map(stockOf), projected });
      if (t <= now) snapshot = batches.map((b) => ({ ...b }));
    }
  }
  const layout = planogram(products);
  const inventory: InventoryBatch[] = snapshot.map((b, i) => ({
    id: `b${i}`, productId: b.productId, quantity: b.qty, receivedAt: iso(b.receivedAt), expiresAt: iso(b.expiresAt), location: layout[b.productId],
  }));
  const nowIndex = Math.max(0, frames.findLastIndex((f) => !f.projected));
  events.sort((a, b) => a.t.localeCompare(b.t));
  const timeline: Timeline = { productIds: ids, frames, events, nowIndex, switchAt: iso(switchAt), start: iso(start) };
  return { timeline, inventory, consumption, waste, orders, activeIds: [...active] };
}
