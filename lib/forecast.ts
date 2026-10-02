import type { DB } from "./seed";
import { DAY, round2 } from "./seed";
import type { Order, OrderInsight, OrderLine, SupplierOffer } from "./types";
import { personDays, productStats, quadrants, weeklyPersonDays } from "./analytics";
import { clusterRequests, substitutes } from "./semantic";

/** Cheapest offer for a quantity, honoring minimum cases and a lead-time ceiling. */
export function pickSupplier(offers: SupplierOffer[], casesNeeded: number, shelfLifeDays = 365, maxLead = 3) {
  // bulk break-even: extra cases forced by a minimum only count as waste when they can't be eaten before expiry
  const carry = shelfLifeDays >= 60 ? 0.9 : 0;
  return offers.filter((o) => o.leadTimeDays <= maxLead)
    .map((o) => { const cases = Math.max(casesNeeded, o.minCases); return { offer: o, cases, total: cases * o.casePrice, effective: cases * o.casePrice - (cases - casesNeeded) * o.casePrice * carry }; })
    .sort((a, b) => a.effective - b.effective)[0];
}

export function monthSpend(db: DB, now = Date.now()) {
  const m = new Date(now); m.setDate(1); m.setHours(0, 0, 0, 0);
  return db.orders.filter((o) => o.kind === "agent" && ["placed", "received", "approved"].includes(o.status) && Date.parse(o.createdAt) >= m.getTime()).reduce((a, o) => a + o.totalUsd, 0);
}

export async function draftOrder(db: DB, now = Date.now()): Promise<Order> {
  const stats = productStats(db, now);
  const trialIds = new Set(db.products.filter((p) => p.trial).map((p) => p.id));
  const quad = quadrants(stats, trialIds);
  const cycle = db.settings.cadenceDays;
  const pdCycle = (weeklyPersonDays(db) * cycle) / 7;
  const notes: string[] = [];
  const insights: OrderInsight[] = [];
  // next delivery: the coming Monday 8am; stock keeps being eaten until then
  const delivery = new Date(now); delivery.setHours(8, 0, 0, 0);
  do delivery.setDate(delivery.getDate() + 1); while (delivery.getDay() !== 1);
  const pdUntilDelivery = personDays(db, now, delivery.getTime());
  const lines: (OrderLine & { value: number })[] = [];
  const baseCase = (id: string) => db.offers.find((o) => o.productId === id && o.supplier === "amazon_business")?.casePrice;

  for (const s of stats) {
    const p = db.products.find((x) => x.id === s.productId)!;
    if (p.trial) continue;
    if (quad[p.id] === "dud") {
      const sub = substitutes(db, p.id, 6).find((x) => quad[x.productId] === "star" || quad[x.productId] === "aspirational");
      insights.push({ kind: "dropped", productId: p.id, eaten: s.last28, netRating: s.netRating, wasted: s.wasteUnits, substituteId: sub?.productId, similarity: sub?.score });
      notes.push(`Dropped ${p.name}: ${s.last28} eaten in 4 weeks, net rating ${Math.round(s.netRating * 100)}%${s.wasteUnits ? `, ${s.wasteUnits} units wasted` : ""}.${sub ? ` Closest well-liked substitute: ${sub.name} (similarity ${sub.score}).` : ""}`);
      continue;
    }
    // demand until next delivery, capped at what can be eaten before expiry
    const horizonPD = Math.min(pdCycle, (weeklyPersonDays(db) * p.shelfLifeDays) / 7);
    const demand = s.rate * horizonPD;
    const safety = s.rate * (weeklyPersonDays(db) / 5) * db.settings.safetyStockDays;
    const onHand = db.inventory.filter((b) => b.productId === p.id && Date.parse(b.expiresAt) > delivery.getTime() + 2 * DAY).reduce((a, b) => a + b.quantity, 0);
    const usable = Math.max(0, Math.round(onHand - s.rate * pdUntilDelivery)); // what will be left when the truck arrives
    let need = demand + safety - usable;
    if (quad[p.id] === "aspirational") need *= 0.7; // try smaller quantity
    const flagged = db.restockFlags.includes(p.id);
    if (flagged) need = Math.max(need, p.unitsPerCase);
    if (need < p.unitsPerCase * 0.25) continue;
    const pick = pickSupplier(db.offers.filter((o) => o.productId === p.id), Math.ceil(need / p.unitsPerCase), p.shelfLifeDays);
    if (!pick) continue;
    lines.push({ productId: p.id, cases: pick.cases, casePrice: pick.offer.casePrice, supplier: pick.offer.supplier, value: ((s.netRating + 1.5) * s.rate) / pick.offer.casePrice,
      reason: flagged ? "restock" : usable === 0 ? "low_stock" : "forecast", units: Math.round(need), onHand, baselineCasePrice: baseCase(p.id),
      note: `${flagged ? "restock flagged by staff · " : ""}need ${Math.round(need)} units (${s.rate.toFixed(3)}/person-day × ${Math.round(horizonPD)} person-days + safety − ${usable} on hand)` });
  }

  // trial the top item from the biggest request cluster
  const clusters = await clusterRequests(db);
  const big = clusters[0];
  const trialId = big?.topProductIds.find((id) => trialIds.has(id)) ?? big?.topProductIds[0];
  if (big && trialId && !lines.some((l) => l.productId === trialId)) {
    const p = db.products.find((x) => x.id === trialId)!;
    const pick = pickSupplier(db.offers.filter((o) => o.productId === trialId), 1, 0);
    if (pick) {
      lines.push({ productId: trialId, cases: pick.cases, casePrice: pick.offer.casePrice, supplier: pick.offer.supplier, value: 99, note: `trial for cluster "${big.label}"`, reason: "trial", baselineCasePrice: baseCase(trialId) });
      insights.push({ kind: "trial", productId: trialId, cluster: big.label, requests: big.size, votes: big.upvotes });
      notes.push(`Trialing ${p.name}: top match for "${big.label}" (${big.size} requests, ${big.upvotes} votes).`);
    }
  }

  // budget guard: trim lowest value-per-$ lines first
  const remaining = db.office.monthlyBudget - monthSpend(db, now);
  const cap = Math.min(remaining, (db.office.monthlyBudget * cycle) / 30.4);
  lines.sort((a, b) => b.value - a.value);
  let total = lines.reduce((a, l) => a + l.cases * l.casePrice, 0);
  while (total > cap && lines.length) {
    const l = lines[lines.length - 1];
    if (l.cases > 1) l.cases -= 1; else lines.pop();
    total = lines.reduce((a, x) => a + x.cases * x.casePrice, 0);
    if (!lines.includes(l)) insights.push({ kind: "trimmed", productId: l.productId });
    notes.push(`Trimmed ${db.products.find((p) => p.id === l.productId)!.name} to stay under budget.`);
  }

  const bySupplier = Object.entries(lines.reduce<Record<string, number>>((a, l) => ((a[l.supplier] = (a[l.supplier] ?? 0) + l.cases * l.casePrice), a), {}));
  const baselinePrice = lines.reduce((a, l) => a + l.cases * (db.offers.find((o) => o.productId === l.productId && o.supplier === "amazon_business")?.casePrice ?? l.casePrice), 0);
  notes.push(`Supplier mix ${bySupplier.map(([s, v]) => `${s.replace("_", " ")} $${v.toFixed(0)}`).join(", ")}: saves $${(baselinePrice - total).toFixed(0)} vs single-supplier pricing.`);
  insights.unshift({ kind: "forecast", personDays: Math.round(pdCycle), headcount: db.office.headcount, deliveryAt: delivery.toISOString() });
  insights.push({ kind: "suppliers", split: bySupplier.map(([supplier, usd]) => ({ supplier, usd: round2(usd) })), savedUsd: round2(baselinePrice - total) });
  notes.unshift(`Forecast for ${Math.round(pdCycle)} in-office person-days next ${cycle === 7 ? "week" : "2 weeks"} (hybrid attendance, not headcount ${db.office.headcount}).`);

  return {
    id: `ord-${Date.now().toString(36)}`, supplier: bySupplier.length > 1 ? "multi" : bySupplier[0]?.[0] ?? "-",
    lines: lines.map(({ value: _v, ...l }) => l), totalUsd: round2(total), status: total <= db.settings.autoApproveUnder ? "approved" : "pending_approval",
    receiptAttached: false, rationale: notes.map((n) => `• ${n}`).join("\n"), createdAt: new Date(now).toISOString(), kind: "agent",
    insights, deliveryAt: delivery.toISOString(), budgetCap: round2(cap),
  };
}
