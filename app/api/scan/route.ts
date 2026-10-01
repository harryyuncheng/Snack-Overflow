import { getDB } from "@/lib/store";
import { liveDetect, mockDetect } from "@/lib/vision";
import type { ShelfScan, Zone } from "@/lib/types";

export async function POST(req: Request) {
  const db = await getDB();
  const body = (await req.json()) as { zone?: Zone | "all"; image?: string; apply?: boolean };
  const zone = body.zone ?? "all";
  let result;
  let mode = "mock";
  if (db.settings.visionMode === "live" && body.image && process.env.ANTHROPIC_API_KEY) {
    const [head, data] = body.image.split(",");
    result = await liveDetect(db, data, head.match(/data:(.*);/)?.[1] ?? "image/jpeg");
    mode = "live";
  } else result = mockDetect(db, zone);

  const diff = result.detections.map((d) => {
    const expected = db.inventory.filter((b) => b.productId === d.productId).reduce((a, b) => a + b.quantity, 0);
    return { productId: d.productId, delta: d.count - expected };
  });
  const skus = result.detections.length;
  const scan: ShelfScan = { id: `s${Date.now()}`, at: new Date().toISOString(), zone, detections: result.detections, diffFromExpected: diff, minutesSaved: Math.round(skus * db.settings.minutes.countPerSku * 10) / 10 };
  db.scans.unshift(scan);
  // apply: negative deltas become consumption events, inventory deducted FIFO (soonest expiry first)
  let consumed = 0;
  for (const d of diff) if (d.delta < 0) {
    let left = -d.delta;
    consumed += left;
    db.consumption.push({ id: `c${Date.now()}-${d.productId}`, productId: d.productId, quantity: left, at: scan.at, source: "camera" });
    for (const b of db.inventory.filter((x) => x.productId === d.productId).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))) {
      const take = Math.min(b.quantity, left); b.quantity -= take; left -= take; if (!left) break;
    }
  }
  db.inventory = db.inventory.filter((b) => b.quantity > 0);
  return Response.json({ scan, mode, consumed });
}
