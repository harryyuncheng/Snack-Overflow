import { beforeEach, expect, it, vi } from "vitest";

const reading = vi.hoisted(() => ({ counts: {} as Record<string, number> }));
vi.mock("@/lib/vision", () => ({
  liveDetect: async () => ({ detections: Object.entries(reading.counts).map(([productId, count]) => ({ productId, count, confidence: 0.9 })) }),
}));
process.env.ANTHROPIC_API_KEY = "test";

const { POST } = await import("@/app/api/camera/route");
const { getDB } = await import("./store");
const frame = (counts: Record<string, number>) => {
  reading.counts = counts;
  return POST(new Request("http://x", { method: "POST", body: JSON.stringify({ image: "data:image/jpeg;base64,AA" }) })).then((r) => r.json());
};
const stock = async (id: string) => (await getDB()).inventory.filter((b) => b.productId === id).reduce((a, b) => a + b.quantity, 0);

beforeEach(() => { reading.counts = {}; });

it("sets stock from each confident reading, logging consumption on decrease", async () => {
  expect(await stock("coke")).toBe(0);
  expect((await frame({ coke: 4, "canada-dry": 2 })).changes).toEqual([{ productId: "coke", delta: 4 }, { productId: "canada-dry", delta: 2 }]);
  expect(await stock("coke")).toBe(4);
  expect(await stock("canada-dry")).toBe(2);

  await frame({ coke: 1, "canada-dry": 2 });
  expect(await stock("coke")).toBe(1);
  const db = await getDB();
  expect(db.consumption.filter((c) => c.productId === "coke" && c.source === "camera").reduce((a, c) => a + c.quantity, 0)).toBe(3);
  expect(db.inventory.find((b) => b.productId === "coke")!.location.zone).toBe("drink_fridge");
});
