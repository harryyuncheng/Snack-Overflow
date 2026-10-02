import { getDB } from "@/lib/store";
import { liveDetect } from "@/lib/vision";
import { CAN_IDS } from "@/lib/cans";
import { planogram } from "@/lib/layout";

// Calibration knob: a reading below this confidence is shown but does not change stock.
const MIN_CONFIDENCE = 0.5;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Set ANTHROPIC_API_KEY in .env.local" }, { status: 500 });
  const { image } = (await req.json()) as { image?: string };
  if (!image?.startsWith("data:image/")) return Response.json({ error: "image must be a data URL" }, { status: 400 });
  const db = await getDB();
  const CANS = db.products.filter((p) => CAN_IDS.includes(p.id));
  const [head, data] = image.split(",");
  const { detections } = await liveDetect(db, data, head.match(/data:(.*);/)?.[1] ?? "image/jpeg", CANS);

  const counts = Object.fromEntries(CANS.map((p) => [p.id, detections.find((d) => d.productId === p.id)?.count ?? 0]));
  const stable = detections.every((d) => d.confidence >= MIN_CONFIDENCE);

  const at = new Date().toISOString();
  const changes: { productId: string; delta: number }[] = [];
  if (stable) for (const p of CANS) {
    const batches = db.inventory.filter((b) => b.productId === p.id).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
    const delta = counts[p.id] - batches.reduce((a, b) => a + b.quantity, 0);
    if (!delta) continue;
    changes.push({ productId: p.id, delta });
    if (delta > 0) {
      db.inventory.push({ id: `b${Date.now()}-${p.id}`, productId: p.id, quantity: delta, receivedAt: at, expiresAt: new Date(Date.now() + p.shelfLifeDays * 864e5).toISOString(), location: planogram(db.products)[p.id] });
      continue;
    }
    db.consumption.push({ id: `c${Date.now()}-${p.id}`, productId: p.id, quantity: -delta, at, source: "camera" });
    let left = -delta;
    for (const b of batches) { const take = Math.min(b.quantity, left); b.quantity -= take; left -= take; if (!left) break; }
  }
  if (changes.length) {
    db.inventory = db.inventory.filter((b) => b.quantity > 0);
    db.scans.unshift({ id: `s${Date.now()}`, at, zone: "drink_fridge", detections, diffFromExpected: changes, minutesSaved: Math.round(CANS.length * db.settings.minutes.countPerSku * 10) / 10 });
  }
  return Response.json({ counts, detections, stable, changes, at });
}
