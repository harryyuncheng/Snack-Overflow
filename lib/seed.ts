import { catalogMeta, categories, products } from "./catalog";
import type {
  ConsumptionEvent, Day, Employee, InventoryBatch, Office, Order, Product, Settings, SnackRequest,
  SupplierId, SupplierOffer, Vote, WasteEvent, Dietary,
} from "./types";

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const DAY_KEYS: Day[] = ["mon", "tue", "wed", "thu", "fri"];
export const dayKey = (d: Date): Day | null => ([null, "mon", "tue", "wed", "thu", "fri", null] as const)[d.getDay()];
export const DAY = 86_400_000;
export const BASELINE_SUPPLIER: SupplierId = "amazon_business";
/** baseline: office manager guesses demand, buying for full headcount with a 10% cushion */
export const BASELINE_OVERBUY = 1.1;

const SUPPLIERS: { id: SupplierId; mult: number; lead: number; min: number }[] = [
  { id: "amazon_business", mult: 1.0, lead: 2, min: 1 },
  { id: "costco", mult: 0.8, lead: 3, min: 2 },
  { id: "instacart_business", mult: 1.12, lead: 1, min: 1 },
  { id: "local_wholesale", mult: 0.87, lead: 2, min: 3 },
];

export type DB = ReturnType<typeof generateSeed>;

export function generateSeed(now = Date.now()) {
  const r = rng(42);
  const office: Office = {
    id: "dm-scranton", name: "Dunder Mifflin, Scranton branch", headcount: 60,
    inOfficeDays: { mon: 0.5, tue: 0.85, wed: 0.85, thu: 0.85, fri: 0.5 }, monthlyBudget: 1500, rampFundId: "fund_snacks",
  };
  const names = ["Michael", "Dwight", "Jim", "Pam", "Ryan", "Andy", "Angela", "Kevin", "Oscar", "Stanley", "Phyllis", "Meredith", "Creed", "Kelly", "Toby", "Darryl", "Erin", "Gabe", "Holly", "Jan"];
  const teams = ["Sales", "Accounting", "Warehouse", "HR", "Customer Service", "Management"];
  const dietPool: Dietary[][] = [[], [], [], [], ["vegan", "vegetarian", "dairy_free"], ["gluten_free"], ["nut_free"], ["vegetarian"], ["gluten_free"], ["dairy_free"]];
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

  // 8 weeks of history, aggregated to one event per product per day
  const consumption: ConsumptionEvent[] = [];
  const start = startOfDay(now - 56 * DAY);
  let eid = 0;
  const live = products.filter((p) => !p.trial);
  for (let t = start; t < startOfDay(now); t += DAY) {
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
      id: `base-${w + 1}`, supplier: BASELINE_SUPPLIER, lines, totalUsd: round2(lines.reduce((a, l) => a + l.cases * l.casePrice, 0)),
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

  // current inventory
  const inventory: InventoryBatch[] = [];
  const slotByZone: Record<string, number> = {};
  let bid = 0;
  for (const p of live) {
    const m = catalogMeta[p.id];
    const idx = (slotByZone[p.zone] = (slotByZone[p.zone] ?? -1) + 1);
    const perShelf = p.zone === "pantry" ? 6 : p.zone === "fruit_bowl" ? 3 : 3;
    const location = { zone: p.zone, shelf: Math.floor(idx / perShelf), slot: idx % perShelf };
    const weekly = m.pop * office.headcount * 3.55;
    let qty = Math.round(m.rating < -0.3 ? 14 + r() * 8 : weekly * (0.3 + r() * 0.7));
    if (["sparkling-grapefruit", "protein-bar"].includes(p.id)) qty = 3; // low stock demo
    const receivedAgo = p.perishable ? Math.max(1, p.shelfLifeDays - 2 - Math.floor(r() * 2)) : 5 + Math.floor(r() * 20);
    const received = now - receivedAgo * DAY;
    inventory.push({ id: `b${bid++}`, productId: p.id, quantity: Math.max(2, qty), receivedAt: new Date(received).toISOString(), expiresAt: new Date(received + p.shelfLifeDays * DAY).toISOString(), location });
  }

  // votes correlated with rating bias
  const votes: Vote[] = [];
  let vid = 0;
  for (const e of employees) for (const p of live) {
    const m = catalogMeta[p.id];
    if (r() > 0.18 + m.pop * 1.5) continue;
    votes.push({ id: `v${vid++}`, employeeId: e.id, productId: p.id, value: r() < (m.rating + 1) / 2 ? 1 : -1, at: new Date(now - r() * 40 * DAY).toISOString() });
  }

  const reqTexts: [string, number][] = [
    ["something with caffeine that isn't coffee", 6], ["yerba mate please!", 4], ["energy drink for the 3pm slump, not coffee", 5],
    ["matcha or green tea in a can", 3], ["caffeinated sparkling water", 2], ["tea-based energy drink", 2], ["need afternoon energy but coffee makes me jittery", 3],
    ["non-coffee caffeine options", 4], ["mate or guayusa energy can", 2],
    ["more lime sparkling water", 7], ["sparkling water keeps running out", 5], ["bubbly water flavors", 3],
    ["gluten-free crackers", 2], ["high-protein snack under 200 calories", 3], ["spicy chips that are less messy", 1],
  ];
  const requests: SnackRequest[] = reqTexts.map(([text, up], i) => ({
    id: `r${i + 1}`, employeeId: employees[Math.floor(r() * employees.length)].id, text, matches: [], upvotes: up, status: "open",
    at: new Date(now - (i + 1) * 0.7 * DAY).toISOString(),
  }));

  const settings: Settings = {
    cadenceDays: 7, safetyStockDays: 1, healthyMixTarget: 0.3, autoApproveUnder: 300, dietaryCoverageTarget: 0.8,
    minutes: { countPerSku: 0.4, pollingPerWeek: 30, orderingPerOrder: 60, receiptPerOrder: 10, reconciliationPerMonth: 90 },
    rampMode: (process.env.RAMP_MODE as "mock" | "sandbox") || "mock", visionMode: (process.env.VISION_MODE as "mock" | "live") || "mock",
  };

  return {
    seededAt: now, office, employees, products: products.map((p) => ({ ...p })), categories: categories.map((c) => ({ ...c })),
    offers, inventory, consumption, votes, requests, waste, orders, scans: [] as import("./types").ShelfScan[],
    settings, feedback: [] as { productId: string; text: string; at: string }[],
  };
}

export function baselineWeeklyUnits(p: Product, headcount: number, avgPop: number) {
  const m = catalogMeta[p.id];
  return headcount * 5 * (m.pop * 0.8 + avgPop * 0.2) * BASELINE_OVERBUY;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
