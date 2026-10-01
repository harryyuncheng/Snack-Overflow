import type { Zone } from "@/lib/types";

/** Inner storage volume of each station: origin = left/back/floor corner. */
export const ZONES: Record<Zone, { origin: [number, number, number]; width: number; shelfY: number[]; depth: number; label: string }> = {
  drink_fridge: { origin: [-6.2, 0, -1.6], width: 1.8, shelfY: [0.32, 1.02, 1.72, 2.42], depth: 0.72, label: "Drink fridge" },
  fresh_fridge: { origin: [-3.6, 0, -1.6], width: 1.8, shelfY: [0.32, 1.02, 1.72, 2.42], depth: 0.72, label: "Fresh fridge" },
  pantry: { origin: [-1.3, 0, -1.7], width: 3.6, shelfY: [0.32, 0.92, 1.52, 2.12], depth: 0.44, label: "Pantry" },
  coffee_bar: { origin: [3.15, 0, -1.68], width: 1.5, shelfY: [0.945, 1.62], depth: 0.42, label: "Coffee bar" },
  fruit_bowl: { origin: [0.05, 0, 3.35], width: 1.1, shelfY: [1.0], depth: 0.5, label: "Fruit bowl" },
  freezer: { origin: [7.45, 0, -1.6], width: 1.2, shelfY: [0.32, 1.02, 1.72], depth: 0.72, label: "Freezer" },
};

export const ISLAND = { x: 0.6, z: 3.6, w: 2.6, d: 1.1, h: 0.94 };
export const BOWL = { x: 0.6, y: 0.98, z: 3.6, r: 0.42 };

/** Standing positions (eye) + look targets for each station. */
export const STATIONS: Record<Zone | "overview", { pos: [number, number, number]; look: [number, number, number] }> = {
  overview: { pos: [0.9, 2.1, 8.6], look: [0.9, 1.15, -1.5] },
  drink_fridge: { pos: [-5.3, 1.6, 1.95], look: [-5.3, 1.3, -1.4] },
  fresh_fridge: { pos: [-2.7, 1.6, 1.95], look: [-2.7, 1.3, -1.4] },
  pantry: { pos: [0.5, 1.6, 2.45], look: [0.5, 1.2, -1.5] },
  coffee_bar: { pos: [3.9, 1.6, 1.4], look: [3.9, 1.15, -1.45] },
  fruit_bowl: { pos: [0.6, 1.7, 5.1], look: [0.6, 0.95, 3.6] },
  freezer: { pos: [8.0, 1.75, 1.3], look: [8.0, 0.6, -1.0] },
};

/** Station framing; the freezer adapts to its current geometry (chest vs upright glass-door unit). */
export function stationFor(zone: Zone | "overview") {
  if (zone !== "freezer") return STATIONS[zone];
  const f = ZONES.freezer;
  const cx = f.origin[0] + f.width / 2, front = f.origin[2] + f.depth;
  const top = Math.max(...f.shelfY);
  if (f.shelfY.length > 1 || top > 1.1) {
    const mid = (Math.min(...f.shelfY) + top) / 2 + 0.2;
    return { pos: [cx, 1.6, front + 2.3] as [number, number, number], look: [cx, mid, f.origin[2]] as [number, number, number] };
  }
  // chest freezer: stand close and look down through the lid
  return { pos: [cx, 2.35, front + 0.95] as [number, number, number], look: [cx, top, f.origin[2] + f.depth * 0.4] as [number, number, number] };
}

export const BOUNDS = { minX: -7.1, maxX: 9.0, minZ: 0.55, maxZ: 9.6, minY: 1.2, maxY: 2.8 };
