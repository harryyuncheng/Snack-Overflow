import type { Product, Zone } from "./types";

export const SLOTS_PER_SHELF: Record<Zone, number> = { drink_fridge: 4, fresh_fridge: 3, pantry: 7, coffee_bar: 3, fruit_bowl: 3, freezer: 2 };
export type Location = { zone: Zone; shelf: number; slot: number };

/** Fixed planogram: every catalog item (incl. trial items) owns a shelf slot, so the timeline can show it appear/disappear. */
export function planogram(products: Product[]) {
  const counts: Partial<Record<Zone, number>> = {};
  const out: Record<string, Location> = {};
  for (const p of products) {
    const i = (counts[p.zone] = (counts[p.zone] ?? -1) + 1);
    const per = SLOTS_PER_SHELF[p.zone];
    out[p.id] = { zone: p.zone, shelf: Math.floor(i / per), slot: i % per };
  }
  return out;
}
