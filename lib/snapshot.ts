import type { DB } from "./seed";
import { productStats, quadrants } from "./analytics";
import { clusterRequests } from "./semantic";
import { impact } from "./savings";
import { getRamp } from "./store";

export async function snapshot(db: DB) {
  const stats = productStats(db);
  const quad = quadrants(stats, new Set(db.products.filter((p) => p.trial).map((p) => p.id)));
  const ramp = await getRamp();
  const [fund] = await ramp.getFunds();
  return {
    office: db.office, settings: db.settings, employees: db.employees.slice(0, 60),
    products: db.products.map(({ embedding: _e, ...p }) => p),
    categories: db.categories.map(({ embedding: _e, ...c }) => c),
    offers: db.offers, stats, quadrants: quad,
    inventory: db.inventory,
    requests: db.requests.map(({ embedding: _e, ...r }) => r).sort((a, b) => b.at.localeCompare(a.at)),
    clusters: await clusterRequests(db),
    orders: [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    waste: db.waste, scans: db.scans, impact: impact(db),
    ramp: { mode: ramp.mode, fund, transactions: await ramp.listTransactions(fund.id) },
  };
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
