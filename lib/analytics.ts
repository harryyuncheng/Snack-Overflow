import type { DB } from "./seed";
import { DAY, dayKey, startOfDay } from "./seed";

export const onHand = (db: DB, productId: string) => db.inventory.filter((b) => b.productId === productId).reduce((a, b) => a + b.quantity, 0);

export function personDays(db: DB, from: number, to: number) {
  let pd = 0;
  for (let t = startOfDay(from); t < to; t += DAY) { const dk = dayKey(new Date(t)); if (dk) pd += db.office.headcount * db.office.inOfficeDays[dk]; }
  return pd;
}
export const weeklyPersonDays = (db: DB) => db.office.headcount * Object.values(db.office.inOfficeDays).reduce((a, b) => a + b, 0);

export type ProductStats = ReturnType<typeof productStats>[number];

export function productStats(db: DB, now = Date.now()) {
  const from = now - 28 * DAY;
  const pd = personDays(db, from, now);
  const weekly = weeklyPersonDays(db);
  return db.products.map((p) => {
    const events = db.consumption.filter((c) => c.productId === p.id);
    // EWMA over the last 4 weekly rates (alpha 0.5), units per in-office person-day
    const rates = [3, 2, 1, 0].map((w) => {
      const a = now - (w + 1) * 7 * DAY, b = now - w * 7 * DAY;
      const units = events.filter((c) => { const t = Date.parse(c.at); return t >= a && t < b; }).reduce((s, c) => s + c.quantity, 0);
      return units / Math.max(1, personDays(db, a, b));
    });
    const rate = rates.reduce((acc, r, i) => (i === 0 ? r : 0.5 * r + 0.5 * acc), 0);
    const last28 = events.filter((c) => Date.parse(c.at) >= from).reduce((s, c) => s + c.quantity, 0);
    const trend = Array.from({ length: 8 }, (_, i) => {
      const a = now - (8 - i) * 7 * DAY, b = a + 7 * DAY;
      return events.filter((c) => { const t = Date.parse(c.at); return t >= a && t < b; }).reduce((s, c) => s + c.quantity, 0);
    });
    const votes = db.votes.filter((v) => v.productId === p.id);
    const up = votes.filter((v) => v.value === 1).length, down = votes.length - up;
    const netRating = votes.length ? (up - down) / votes.length : 0;
    const batches = db.inventory.filter((b) => b.productId === p.id && b.quantity > 0);
    const stock = batches.reduce((a, b) => a + b.quantity, 0);
    const nextExpiry = batches.length ? Math.min(...batches.map((b) => Date.parse(b.expiresAt))) : null;
    const daysToExpiry = nextExpiry ? Math.round(((nextExpiry - now) / DAY) * 10) / 10 : null;
    const dailyDemand = (rate * weekly) / 5;
    const offers = db.offers.filter((o) => o.productId === p.id);
    const bestUnit = Math.min(...offers.map((o) => o.casePrice / p.unitsPerCase));
    const wasteUnits = db.waste.filter((w) => w.productId === p.id && !w.donated).reduce((a, w) => a + w.quantity, 0);
    return {
      productId: p.id, rate, perDay: dailyDemand, last28, trend, up, down, netRating, votes: votes.length, stock,
      daysToExpiry, nearExpiry: daysToExpiry !== null && daysToExpiry <= 3, lowStock: !p.trial && stock < dailyDemand * 2 && dailyDemand > 0.5,
      eatFirst: batches.some((b) => b.eatFirst), location: batches[0]?.location ?? null, pricePerServing: bestUnit, wasteUnits, rateIn: pd,
    };
  });
}

export type Quadrant = "star" | "guilty" | "aspirational" | "dud";
export function quadrants(stats: ProductStats[], trialIds: Set<string>) {
  const live = stats.filter((s) => !trialIds.has(s.productId));
  const sorted = [...live].map((s) => s.rate).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const out: Record<string, Quadrant> = {};
  for (const s of live) {
    const hiV = s.rate >= median, hiR = s.netRating >= 0.2;
    out[s.productId] = hiV && hiR ? "star" : hiV ? "guilty" : hiR ? "aspirational" : "dud";
  }
  // duds must be genuinely low: bottom velocity AND net-negative rating
  for (const s of live) if (out[s.productId] === "dud" && !(s.rate < median * 0.25 && s.netRating < 0)) out[s.productId] = s.netRating >= 0 ? "aspirational" : "guilty";
  return out;
}
