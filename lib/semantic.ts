import type { DB } from "./seed";
import type { Dietary, Product, SnackRequest } from "./types";
import { cosine, getEmbedder } from "./embeddings";
import { tokenize } from "./embeddings/local-lite";
import { onHand } from "./analytics";

const DIET_TOKENS: Dietary[] = ["vegan", "vegetarian", "gluten_free", "nut_free", "dairy_free", "halal", "kosher"];

/** "isn't chips", "not coffee", "without nuts" → terms to penalize */
export function negatedTerms(q: string) {
  const out: string[] = [];
  const re = /\b(?:isn'?t|not|no|without|except|but not)\s+(?:a |an |the |too )?([a-z\-]+)/gi;
  for (const m of q.toLowerCase().matchAll(re)) out.push(...tokenize(m[1]));
  return out;
}

export function sharedAttributes(q: string, p: Product) {
  const qt = new Set(tokenize(q));
  return [...p.flavorProfile, ...p.dietaryTags, p.category].filter((a) => qt.has(a) || qt.has(a.replace("_", "-")));
}

export async function semanticSearch(db: DB, query: string, opts: { k?: number; dietary?: Dietary[] } = {}) {
  // multi-ask: "I want meat, beef jerky and protein" → each ask must be satisfied (min over parts)
  const parts = query.split(/,|;|\+|\band\b|\balso\b/i).map((x) => x.trim()).filter((x) => tokenize(x).length > 0 && !/^(?:isn'?t|not|no|without)\b/i.test(x));
  const [qv, ...pv] = await getEmbedder().embed([query, ...(parts.length > 1 ? parts : [])]);
  const neg = negatedTerms(query);
  const required = new Set<Dietary>([...(opts.dietary ?? []), ...DIET_TOKENS.filter((d) => tokenize(query).includes(d))]);
  const results = db.products
    .filter((p) => [...required].every((d) => p.dietaryTags.includes(d)))
    .map((p) => {
      const whole = cosine(qv, p.embedding!);
      const partScores = pv.map((v) => cosine(v, p.embedding!));
      let score = partScores.length ? 0.5 * whole + 0.5 * Math.min(...partScores) : whole;
      const inName = neg.some((n) => tokenize(p.name).includes(n));
      const inCategory = neg.some((n) => tokenize(p.category).includes(n));
      const penalized = inName || inCategory;
      score -= inName ? 0.35 : inCategory ? 0.15 : 0;
      // light popularity prior from votes so well-liked items win near-ties
      const votes = db.votes.filter((v) => v.productId === p.id);
      if (votes.length) score += 0.06 * (votes.reduce((a, v) => a + v.value, 0) / votes.length);
      const stock = onHand(db, p.id);
      return { productId: p.id, name: p.name, emoji: p.emoji, zone: p.zone, score: Math.round(score * 1000) / 1000, inStock: stock > 0, stock,
        why: { shared: sharedAttributes(query, p), penalized: penalized ? neg : [], parts: partScores.length ? parts.map((q, i) => ({ q, s: Math.round(partScores[i] * 100) / 100 })) : [] } };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.k ?? 6);
  const [cat] = db.categories.map((c) => ({ id: c.id, s: cosine(qv, c.embedding!) })).sort((a, b) => b.s - a.s);
  return { results, category: cat.id, negated: neg, dietary: [...required], parts: pv.length ? parts : [], embedding: qv };
}

export const STOCK_MATCH_THRESHOLD = 0.3;

export async function matchRequest(db: DB, r: SnackRequest) {
  const emp = db.employees.find((e) => e.id === r.employeeId);
  const s = await semanticSearch(db, r.text, { k: 5, dietary: emp?.dietary });
  r.embedding = s.embedding;
  r.category = s.category;
  r.matches = s.results.map(({ productId, score, inStock }) => ({ productId, score, inStock }));
  return s;
}

const CLUSTER_LABELS: [string[], string][] = [
  [["caffeine", "caffeinated", "energy", "mate", "matcha", "tea"], "Non-coffee caffeine"],
  [["sparkling", "bubbly", "fizzy", "water"], "More sparkling water"],
  [["protein"], "High-protein snacks"], [["gluten_free", "cracker"], "Gluten-free crunch"], [["spicy"], "Spicy snacks"],
];

/** Greedy single-pass clustering on cosine similarity, centroid updated as members join. */
export async function clusterRequests(db: DB, threshold = 0.2) {
  const open = db.requests.filter((r) => r.embedding && r.status !== "declined");
  const clusters: { id: string; centroid: number[]; members: SnackRequest[] }[] = [];
  for (const r of open) {
    let best = -1, bestS = threshold;
    clusters.forEach((c, i) => { const s = cosine(r.embedding!, c.centroid); if (s > bestS) { bestS = s; best = i; } });
    if (best === -1) clusters.push({ id: `k${clusters.length + 1}`, centroid: [...r.embedding!], members: [r] });
    else {
      const c = clusters[best];
      c.members.push(r);
      c.centroid = c.centroid.map((x, i) => x + (r.embedding![i] - x) / c.members.length);
    }
  }
  return clusters.map((c) => {
    c.members.forEach((m) => (m.clusterId = c.id));
    const toks = c.members.flatMap((m) => tokenize(m.text));
    const label = CLUSTER_LABELS.find(([keys]) => toks.filter((t) => keys.includes(t)).length >= Math.max(1, c.members.length / 2))?.[1]
      ?? c.members[0].text.slice(0, 40);
    const topMatch = new Map<string, number>();
    c.members.forEach((m) => m.matches.slice(0, 3).forEach((x) => topMatch.set(x.productId, (topMatch.get(x.productId) ?? 0) + x.score)));
    const top = [...topMatch.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return { id: c.id, label, size: c.members.length, upvotes: c.members.reduce((a, m) => a + m.upvotes + 1, 0), requestIds: c.members.map((m) => m.id), topProductIds: top.slice(0, 3) };
  }).sort((a, b) => b.upvotes - a.upvotes);
}

export function substitutes(db: DB, productId: string, k = 4) {
  const p = db.products.find((x) => x.id === productId)!;
  return db.products.filter((x) => x.id !== productId && !x.trial)
    .map((x) => ({ productId: x.id, name: x.name, emoji: x.emoji, score: Math.round(cosine(p.embedding!, x.embedding!) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score).slice(0, k);
}
