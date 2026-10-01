import { getDB } from "@/lib/store";
import { matchRequest, clusterRequests, STOCK_MATCH_THRESHOLD } from "@/lib/semantic";
import type { SnackRequest } from "@/lib/types";
import { z } from "zod";
const Body = z.object({ text: z.string().min(2), employeeId: z.string().default("e1") });
export async function POST(req: Request) {
  const db = await getDB();
  const b = Body.parse(await req.json());
  const r: SnackRequest = { id: `r${Date.now()}`, employeeId: b.employeeId, text: b.text, matches: [], upvotes: 0, status: "open", at: new Date().toISOString() };
  const s = await matchRequest(db, r);
  const hit = s.results.find((x) => x.inStock && x.score >= STOCK_MATCH_THRESHOLD);
  if (hit) r.status = "fulfilled_from_stock";
  db.requests.push(r);
  const clusters = await clusterRequests(db);
  const cluster = clusters.find((c) => c.id === r.clusterId);
  const loc = hit ? db.inventory.find((b) => b.productId === hit.productId)?.location : undefined;
  return Response.json({ request: { ...r, embedding: undefined }, fulfilledBy: hit ? { ...hit, location: loc } : null, results: s.results, category: s.category, cluster });
}
export async function PATCH(req: Request) {
  const db = await getDB();
  const { id } = (await req.json()) as { id: string };
  const r = db.requests.find((x) => x.id === id);
  if (r) r.upvotes += 1;
  return Response.json({ ok: true });
}
