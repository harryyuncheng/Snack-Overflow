import type { DB } from "./seed";
import { BASELINE_SUPPLIER, baselineWeeklyUnits, round2 } from "./seed";
import { catalogMeta } from "./catalog";
import { productStats, quadrants, weeklyPersonDays, type ProductStats } from "./analytics";
import type { Settings } from "./types";

export const WEEKS_PER_MONTH = 4.33;
export const BENCHMARK = { smallOfficeLow: 10, smallOfficeHigh: 25, source: "ZeroCater / industry budget benchmarks" };

export type Levers = { droppedDuds: number; rightSizing: number; attendanceScaling: number; supplierSwitching: number };

/**
 * Monthly $ saved vs baseline ("fixed weekly basket by headcount, one supplier").
 * Levers are applied sequentially per product so they never double count.
 */
export function computeLevers(db: DB, stats: ProductStats[]) {
  const trial = new Set(db.products.filter((p) => p.trial).map((p) => p.id));
  const quad = quadrants(stats, trial);
  const live = db.products.filter((p) => !p.trial);
  const avgPop = live.reduce((a, p) => a + catalogMeta[p.id].pop, 0) / live.length;
  const wpd = weeklyPersonDays(db);
  const lev: Levers = { droppedDuds: 0, rightSizing: 0, attendanceScaling: 0, supplierSwitching: 0 };
  let baseline = 0, optimized = 0;
  for (const p of live) {
    const s = stats.find((x) => x.productId === p.id)!;
    const offers = db.offers.filter((o) => o.productId === p.id);
    const baseUnit = offers.find((o) => o.supplier === BASELINE_SUPPLIER)!.casePrice / p.unitsPerCase;
    const bestUnit = Math.min(...offers.map((o) => o.casePrice / p.unitsPerCase));
    // baseline buys whole cases, exactly as the logged baseline orders did
    const baseUnits = Math.max(1, Math.round(baselineWeeklyUnits(p, db.office.headcount, avgPop) / p.unitsPerCase)) * p.unitsPerCase;
    baseline += baseUnits * baseUnit;
    if (quad[p.id] === "dud") { lev.droppedDuds += baseUnits * baseUnit; continue; }
    const safety = 1 + db.settings.safetyStockDays / 5;
    const fullHeadcount = s.rate * db.office.headcount * 5 * safety;
    const actual = s.rate * wpd * safety;
    lev.rightSizing += (baseUnits - fullHeadcount) * baseUnit;
    lev.attendanceScaling += (fullHeadcount - actual) * baseUnit;
    lev.supplierSwitching += actual * (baseUnit - bestUnit);
    optimized += actual * bestUnit;
  }
  const m = (x: number) => round2(x * WEEKS_PER_MONTH);
  return {
    baselineMonthly: m(baseline), optimizedMonthly: m(optimized),
    levers: { droppedDuds: m(lev.droppedDuds), rightSizing: m(lev.rightSizing), attendanceScaling: m(lev.attendanceScaling), supplierSwitching: m(lev.supplierSwitching) } as Levers,
  };
}

export function timeSaved(minutes: Settings["minutes"], skuCount: number) {
  const baselineWeekly = { counting: skuCount * minutes.countPerSku * 2, polling: minutes.pollingPerWeek, ordering: minutes.orderingPerOrder, receipts: minutes.receiptPerOrder };
  const withUsWeekly = { counting: 2 * 0.5, polling: 0, ordering: 5, receipts: 0 }; // two 30s scans, one-click approve, auto receipts
  const rows: { task: string; beforeMin: number; afterMin: number }[] = (Object.keys(baselineWeekly) as (keyof typeof baselineWeekly)[]).map((k) => ({
    task: k, beforeMin: round2(baselineWeekly[k] * WEEKS_PER_MONTH), afterMin: round2(withUsWeekly[k] * WEEKS_PER_MONTH),
  }));
  rows.push({ task: "reconciliation", beforeMin: minutes.reconciliationPerMonth, afterMin: 10 });
  const saved = rows.reduce((a, r) => a + r.beforeMin - r.afterMin, 0);
  return { rows, hoursPerMonth: round2(saved / 60) };
}

export function wasteSummary(db: DB) {
  const weeks = 8;
  const base = db.waste.filter((w) => w.period === "baseline");
  const baseMonthlyUsd = (base.reduce((a, w) => a + w.costUsd, 0) / weeks) * WEEKS_PER_MONTH;
  const baseMonthlyKg = (base.reduce((a, w) => a + w.kg, 0) / weeks) * WEEKS_PER_MONTH;
  return { baseMonthlyUsd: round2(baseMonthlyUsd), baseMonthlyKg: round2(baseMonthlyKg) };
}

/** Projected waste under Snack Overflow: duds dropped, perishables ordered to shelf life, so only residual spoilage remains. */
export function projectedWaste(db: DB, stats: ProductStats[], residual = 0.1) {
  const quad = quadrants(stats, new Set(db.products.filter((p) => p.trial).map((p) => p.id)));
  const base = db.waste.filter((w) => w.period === "baseline" && quad[w.productId] !== "dud");
  const live = db.waste.filter((w) => w.period === "live" && !w.donated);
  const usd = (base.reduce((a, w) => a + w.costUsd, 0) / 8) * WEEKS_PER_MONTH * residual * 4 + live.reduce((a, w) => a + w.costUsd, 0);
  const kg = (base.reduce((a, w) => a + w.kg, 0) / 8) * WEEKS_PER_MONTH * residual * 4 + live.reduce((a, w) => a + w.kg, 0);
  return { monthlyUsd: round2(usd), monthlyKg: round2(kg) };
}

export function impact(db: DB) {
  const stats = productStats(db);
  const { baselineMonthly, optimizedMonthly, levers } = computeLevers(db, stats);
  const saved = Object.values(levers).reduce((a, b) => a + b, 0);
  const time = timeSaved(db.settings.minutes, db.products.filter((p) => !p.trial).length);
  const w = wasteSummary(db);
  const pw = projectedWaste(db, stats);
  const donated = db.waste.filter((x) => x.donated);
  const groups = [...new Set(db.employees.flatMap((e) => e.dietary))];
  const coverage = groups.map((g) => {
    const n = db.products.filter((p) => p.dietaryTags.includes(g) && (stats.find((s) => s.productId === p.id)?.stock ?? 0) > 0).length;
    return { group: g, items: n, pct: Math.min(1, n / 6), people: db.employees.filter((e) => e.dietary.includes(g)).length };
  });
  const eaten = stats.reduce((a, s) => a + s.last28, 0);
  const satisfaction = stats.reduce((a, s) => a + s.netRating * s.last28, 0) / Math.max(1, eaten);
  return {
    baselineMonthly, optimizedMonthly, savedMonthly: round2(saved), savedPct: round2((saved / baselineMonthly) * 100), levers,
    time, waste: { ...w, projectedUsd: pw.monthlyUsd, projectedKg: pw.monthlyKg, reductionPct: round2((1 - pw.monthlyUsd / w.baseMonthlyUsd) * 100),
      donatedKg: round2(donated.reduce((a, x) => a + x.kg, 0)), donatedUsd: round2(donated.reduce((a, x) => a + x.costUsd, 0)) },
    costPerEmployee: { baseline: round2(baselineMonthly / db.office.headcount), now: round2(optimizedMonthly / db.office.headcount), benchmark: BENCHMARK },
    satisfaction: round2(satisfaction), coverage,
  };
}
