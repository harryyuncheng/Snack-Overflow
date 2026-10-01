import { getDB } from "@/lib/store";
import { z } from "zod";
const Body = z.object({ productId: z.string(), value: z.union([z.literal(1), z.literal(-1)]), employeeId: z.string().default("e1") });
export async function POST(req: Request) {
  const db = await getDB();
  const b = Body.parse(await req.json());
  db.votes = db.votes.filter((v) => !(v.employeeId === b.employeeId && v.productId === b.productId));
  db.votes.push({ id: `v${Date.now()}`, ...b, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
