import { z } from "zod";
import type { DB } from "./seed";
import type { Zone } from "./types";

export const Detections = z.object({ detections: z.array(z.object({ productId: z.string(), count: z.number().int().min(0), confidence: z.number().min(0).max(1) })) });
export type DetectionResult = z.infer<typeof Detections>;

/** Mock: what a camera would see now. Simulates people having taken items since the last count. */
export function mockDetect(db: DB, zone: Zone | "all"): DetectionResult {
  const ids = [...new Set(db.inventory.filter((b) => zone === "all" || b.location.zone === zone).map((b) => b.productId))];
  return {
    detections: ids.map((id, i) => {
      const expected = db.inventory.filter((b) => b.productId === id).reduce((a, b) => a + b.quantity, 0);
      const taken = Math.min(expected, Math.floor(((i * 7 + Date.now() / 60000) % 5)));
      return { productId: id, count: expected - taken, confidence: i % 6 === 4 ? 0.62 : 0.88 + ((i * 13) % 11) / 100 };
    }),
  };
}

export async function liveDetect(db: DB, imageBase64: string, mediaType: string): Promise<DetectionResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const catalog = db.products.map((p) => `${p.id}: ${p.name} (${p.model3d.shape}, ${p.brand})`).join("\n");
  const msg = await client.messages.create({
    model: "claude-sonnet-5-5", max_tokens: 1500,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 } },
      { type: "text", text: `Count the snack products visible on this office shelf. Only use these product ids:\n${catalog}\nReturn ONLY JSON: {"detections":[{"productId":string,"count":int,"confidence":0-1}]}` },
    ] }],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  return Detections.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
}
