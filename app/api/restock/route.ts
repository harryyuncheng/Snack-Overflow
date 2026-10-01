import { getDB } from "@/lib/store";
import { z } from "zod";
const Body = z.object({ productId: z.string() });
/** Anyone can flag an item; it shows in the shared feed and is guaranteed a line in the next agent order. */
export async function POST(req: Request) {
  const db = await getDB();
  const { productId } = Body.parse(await req.json());
  const p = db.products.find((x) => x.id === productId);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  if (!db.restockFlags.includes(productId)) db.restockFlags.push(productId);
  const n = { id: `n${Date.now()}`, t: new Date().toISOString(), kind: "restock_request", productId, text: `Restock requested: ${p.name}. Added to next order.` };
  db.notifications.unshift(n);
  return Response.json(n);
}
