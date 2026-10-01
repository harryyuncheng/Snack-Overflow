import { getDB, getRamp } from "@/lib/store";
import { DAY } from "@/lib/seed";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDB();
  const ramp = await getRamp();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return Response.json({ error: "not found" }, { status: 404 });
  const bySupplier = new Map<string, number>();
  o.lines.forEach((l) => bySupplier.set(l.supplier, (bySupplier.get(l.supplier) ?? 0) + l.cases * l.casePrice));
  const txIds: string[] = [];
  try {
    for (const [supplier, amount] of bySupplier) {
      const memo = `Snack Overflow order ${o.id}: ${o.lines.filter((l) => l.supplier === supplier).length} SKUs for ${db.office.name}`;
      const tx = await ramp.purchase({ fundId: db.office.rampFundId!, merchant: supplier, amount, memo, rationale: "Approved weekly snack restock within monthly fund" });
      txIds.push(tx.id);
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  o.status = "received";
  o.rampTransactionId = txIds.join(",");
  o.receiptAttached = true;
  o.memo = `Paid on Ramp "Office Snacks" fund via agent card (${txIds.length} txns).`;
  // receive immediately for the demo: create batches with expiry dates
  const now = Date.now();
  for (const l of o.lines) {
    const p = db.products.find((x) => x.id === l.productId)!;
    const existing = db.inventory.find((b) => b.productId === p.id);
    const zoneCount = new Set(db.inventory.filter((b) => b.location.zone === p.zone).map((b) => b.productId)).size;
    const location = existing?.location ?? { zone: p.zone, shelf: Math.floor(zoneCount / (p.zone === "pantry" ? 6 : 3)), slot: zoneCount % (p.zone === "pantry" ? 6 : 3) };
    db.inventory.push({ id: `b${now}-${p.id}`, productId: p.id, quantity: l.cases * p.unitsPerCase, receivedAt: new Date(now).toISOString(), expiresAt: new Date(now + p.shelfLifeDays * DAY).toISOString(), location });
    if (p.trial) db.requests.filter((r) => r.matches[0]?.productId === p.id || r.matches.some((m) => m.productId === p.id && m.score > 0.3)).forEach((r) => (r.status = "added"));
  }
  return Response.json(o);
}
