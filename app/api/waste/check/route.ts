import { getDB } from "@/lib/store";
import { DAY, round2 } from "@/lib/seed";
import { z } from "zod";
export async function GET(req: Request) {
  const db = await getDB();
  const days = Number(new URL(req.url).searchParams.get("days") ?? 3);
  const now = Date.now();
  return Response.json(db.inventory.filter((b) => b.quantity > 0 && Date.parse(b.expiresAt) - now <= days * DAY).map((b) => ({ ...b, daysLeft: round2((Date.parse(b.expiresAt) - now) / DAY) })));
}
const Body = z.object({ batchId: z.string(), action: z.enum(["eat_first", "donate", "expire"]) });
export async function POST(req: Request) {
  const db = await getDB();
  const { batchId, action } = Body.parse(await req.json());
  const b = db.inventory.find((x) => x.id === batchId);
  if (!b) return Response.json({ error: "not found" }, { status: 404 });
  const p = db.products.find((x) => x.id === b.productId)!;
  if (action === "eat_first") { b.eatFirst = true; b.location = { ...b.location, slot: 0 }; return Response.json({ ok: true, notification: `🍽️ #office-snacks: ${b.quantity} × ${p.name} expire soon. Eat me first! (${p.zone.replace("_", " ")}, shelf ${b.location.shelf + 1})` }); }
  const unit = Math.min(...db.offers.filter((o) => o.productId === p.id).map((o) => o.casePrice / p.unitsPerCase));
  db.waste.push({ id: `w${Date.now()}`, productId: p.id, quantity: b.quantity, reason: action === "donate" ? "donated" : "expired", costUsd: round2(b.quantity * unit), kg: round2(b.quantity * p.weightKg), at: new Date().toISOString(), donated: action === "donate", period: "live" });
  b.quantity = 0;
  db.inventory = db.inventory.filter((x) => x.quantity > 0);
  return Response.json({ ok: true });
}
