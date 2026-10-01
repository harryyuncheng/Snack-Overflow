import { catalogMeta } from "./catalog";
import type { Day, Product, SupplierId } from "./types";

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
export function baselineWeeklyUnits(p: Product, headcount: number, avgPop: number) {
  const m = catalogMeta[p.id];
  return headcount * 5 * (m.pop * 0.8 + avgPop * 0.2) * BASELINE_OVERBUY;
}
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
