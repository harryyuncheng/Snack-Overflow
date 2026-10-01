import { describe, expect, it } from "vitest";
import { generateSeed } from "./seed";
import { productStats } from "./analytics";
import { computeLevers, timeSaved, impact } from "./savings";
import { pickSupplier } from "./forecast";

const NOW = Date.parse("2026-10-01T12:00:00Z");

describe("savings math", () => {
  const db = generateSeed(NOW);
  const stats = productStats(db, NOW);

  it("levers sum to baseline minus optimized spend", () => {
    const r = computeLevers(db, stats);
    const sum = Object.values(r.levers).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(r.baselineMonthly - r.optimizedMonthly, 0);
  });

  it("baseline matches the logged baseline orders", () => {
    const r = computeLevers(db, stats);
    const weekly = db.orders.filter((o) => o.kind === "baseline")[0].totalUsd;
    expect(r.baselineMonthly / 4.33).toBeCloseTo(weekly, -1);
  });

  it("every lever is non-negative except right-sizing may be negative for under-bought hits", () => {
    const { levers } = computeLevers(db, stats);
    expect(levers.droppedDuds).toBeGreaterThan(0);
    expect(levers.attendanceScaling).toBeGreaterThan(0);
    expect(levers.supplierSwitching).toBeGreaterThanOrEqual(0);
  });

  it("time saved uses the editable minute assumptions", () => {
    const a = timeSaved(db.settings.minutes, 39).hoursPerMonth;
    const b = timeSaved({ ...db.settings.minutes, pollingPerWeek: 0 }, 39).hoursPerMonth;
    expect(a - b).toBeCloseTo((30 * 4.33) / 60, 1);
  });

  it("impact is deterministic for a fixed seed", () => {
    expect(impact(generateSeed(NOW)).savedMonthly).toBe(impact(generateSeed(NOW)).savedMonthly);
  });
});

describe("supplier picker", () => {
  const offers = [
    { productId: "x", supplier: "amazon_business" as const, casePrice: 10, leadTimeDays: 2, minCases: 1 },
    { productId: "x", supplier: "costco" as const, casePrice: 8, leadTimeDays: 3, minCases: 2 },
  ];
  it("honors minimums for perishables", () => expect(pickSupplier(offers, 1, 7).offer.supplier).toBe("amazon_business"));
  it("bulk-buys shelf-stable items when the minimum pays off", () => expect(pickSupplier(offers, 1, 365).offer.supplier).toBe("costco"));
});
