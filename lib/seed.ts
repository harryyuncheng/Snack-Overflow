import { catalogMeta, categories, products } from "./catalog";
import type {
  ConsumptionEvent, Employee, Office, Order, Settings, SnackRequest,
  SupplierOffer, Vote, WasteEvent,
} from "./types";

export { rng, DAY_KEYS, dayKey, DAY, BASELINE_SUPPLIER, BASELINE_OVERBUY, baselineWeeklyUnits, round2, startOfDay } from "./seed-utils";
import { rng, dayKey, DAY, BASELINE_SUPPLIER, baselineWeeklyUnits, round2, startOfDay } from "./seed-utils";
import { simulate } from "./timeline";
import { officeData, requestRows, settingsData, supplierRows } from "./data";

const SUPPLIERS = supplierRows;

export type DB = ReturnType<typeof generateSeed>;

export function generateSeed(now = Date.now()) {
  const r = rng(42);
  const office: Office = { ...officeData.office, inOfficeDays: { ...officeData.office.inOfficeDays } };
  const { namePool: names, teamPool: teams, dietaryPool: dietPool } = officeData;
  const employees: Employee[] = Array.from({ length: office.headcount }, (_, i) => ({
    id: `e${i + 1}`, name: `${names[i % names.length]}${i >= names.length ? ` ${String.fromCharCode(65 + Math.floor(i / names.length))}.` : ""}`,
    team: teams[i % teams.length], dietary: dietPool[Math.floor(r() * dietPool.length)],
  }));

  const offers: SupplierOffer[] = [];
  for (const p of products) {
    const base = catalogMeta[p.id].basePrice;
    for (const s of SUPPLIERS) {
      if (s.id !== BASELINE_SUPPLIER && r() < 0.3) continue;
      offers.push({ productId: p.id, supplier: s.id, casePrice: round2(base * s.mult * (0.95 + r() * 0.1)), leadTimeDays: s.lead, minCases: s.min });
    }
  }

  const sim = simulate({ now, office, products, offers });
  const simStart = Date.parse(sim.timeline.start);
  // 8 weeks of daily history before the hourly simulation window
  const consumption: ConsumptionEvent[] = [];
  const start = startOfDay(simStart - 56 * DAY);
  let eid = 0;
  const live = products.filter((p) => !p.trial);
  for (let t = start; t < simStart; t += DAY) {
    const dk = dayKey(new Date(t));
    if (!dk) continue;
    const pd = office.headcount * office.inOfficeDays[dk] * (0.9 + r() * 0.2);
    for (const p of live) {
      const mean = catalogMeta[p.id].pop * pd;
      const q = Math.max(0, Math.round(mean * (0.7 + r() * 0.6)));
      if (q > 0) consumption.push({ id: `c${eid++}`, productId: p.id, quantity: q, at: new Date(t + 13 * 3600_000).toISOString(), source: "checkout" });
    }
  }

  // baseline orders: weekly basket by headcount, one supplier
  const orders: Order[] = [];
  const avgPop = live.reduce((a, p) => a + catalogMeta[p.id].pop, 0) / live.length;
  const waste: WasteEvent[] = [];
  for (let w = 0; w < 8; w++) {
    const at = start + w * 7 * DAY;
    const lines = live.map((p) => {
      const units = baselineWeeklyUnits(p, office.headcount, avgPop);
      const offer = offers.find((o) => o.productId === p.id && o.supplier === BASELINE_SUPPLIER)!;
      return { productId: p.id, cases: Math.max(1, Math.round(units / p.unitsPerCase)), casePrice: offer.casePrice, supplier: BASELINE_SUPPLIER };
    });
    orders.push({
      id: `base-hist-${w + 1}`, supplier: BASELINE_SUPPLIER, lines, totalUsd: round2(lines.reduce((a, l) => a + l.cases * l.casePrice, 0)),
      status: "received", receiptAttached: r() < 0.4, rationale: "Baseline: fixed weekly basket by headcount (pre-Snack Overflow).", createdAt: new Date(at).toISOString(), kind: "baseline",
    });
    // expiry waste in the baseline concentrated in perishables & duds
    for (const p of live) {
      const m = catalogMeta[p.id];
      const bought = baselineWeeklyUnits(p, office.headcount, avgPop);
      const eaten = m.pop * office.headcount * 3.55;
      const surplus = Math.max(0, bought - eaten);
      const spoilRate = p.perishable ? 0.75 : m.rating < 0 ? 0.5 : 0.05;
      const q = Math.round(surplus * spoilRate * (0.8 + r() * 0.4));
      if (q > 0) {
        const unit = offers.find((o) => o.productId === p.id && o.supplier === BASELINE_SUPPLIER)!.casePrice / p.unitsPerCase;
        waste.push({ id: `w${w}-${p.id}`, productId: p.id, quantity: q, reason: p.perishable ? "expired" : r() < 0.8 ? "expired" : "damaged", costUsd: round2(q * unit), kg: round2(q * p.weightKg), at: new Date(at + 6 * DAY).toISOString(), period: "baseline" });
      }
    }
  }

  // votes correlated with rating bias
  const votes: Vote[] = [];
  let vid = 0;
  for (const e of employees) for (const p of live) {
    const m = catalogMeta[p.id];
    if (r() > 0.18 + m.pop * 1.5) continue;
    votes.push({ id: `v${vid++}`, employeeId: e.id, productId: p.id, value: r() < (m.rating + 1) / 2 ? 1 : -1, at: new Date(now - r() * 40 * DAY).toISOString() });
  }

  const requests: SnackRequest[] = requestRows.map(({ text, upvotes: up }, i) => ({
    id: `r${i + 1}`, employeeId: employees[Math.floor(r() * employees.length)].id, text, matches: [], upvotes: up, status: "open",
    at: new Date(now - (i + 1) * 0.7 * DAY).toISOString(),
  }));

  const settings: Settings = {
    ...settingsData, minutes: { ...settingsData.minutes },
    rampMode: (process.env.RAMP_MODE as Settings["rampMode"]) || settingsData.rampMode,
    visionMode: (process.env.VISION_MODE as Settings["visionMode"]) || settingsData.visionMode,
  };

  return {
    seededAt: now, office, employees, products: products.map((p) => ({ ...p, trial: p.trial && !sim.activeIds.includes(p.id) })), categories: categories.map((c) => ({ ...c })),
    offers, inventory: sim.inventory, consumption: [...consumption, ...sim.consumption], votes, requests,
    waste: [...waste, ...sim.waste], orders: [...orders, ...sim.orders.filter((o) => o.status !== "draft")], timeline: sim.timeline, activeIds: sim.activeIds, scans: [] as import("./types").ShelfScan[],
    settings, feedback: [] as { productId: string; text: string; at: string }[],
    notifications: [] as { id: string; t: string; kind: string; productId?: string; text: string }[], restockFlags: [] as string[],
  };
}

