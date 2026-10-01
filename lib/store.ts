import { generateSeed, type DB } from "./seed";
import { embeddingText, getEmbedder } from "./embeddings";
import { createRamp, type RampAdapter } from "./ramp";

type G = { __snack?: { db: DB; ready: Promise<void>; ramp: RampAdapter } };
const g = globalThis as unknown as G;

function boot() {
  const db = generateSeed();
  const ramp = createRamp(db);
  const ready = (async () => {
    const e = getEmbedder();
    const pv = await e.embed(db.products.map(embeddingText));
    db.products.forEach((p, i) => (p.embedding = pv[i]));
    const cv = await e.embed(db.categories.map((c) => `${c.name}. ${c.description}`));
    db.categories.forEach((c, i) => (c.embedding = cv[i]));
    const { matchRequest, clusterRequests } = await import("./semantic");
    for (const r of db.requests) await matchRequest(db, r);
    await clusterRequests(db);
  })();
  g.__snack = { db, ready, ramp };
}

export async function getDB() {
  if (!g.__snack) boot();
  await g.__snack!.ready;
  return g.__snack!.db;
}
export async function getRamp() { await getDB(); return g.__snack!.ramp; }
export async function resetDB() { g.__snack = undefined; return getDB(); }
