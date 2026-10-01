export const APP_NAME = "Snack Overflow";
export const TAGLINE = "Your office snacks, stacked by data.";

export type Zone = "drink_fridge" | "fresh_fridge" | "pantry" | "coffee_bar" | "freezer" | "fruit_bowl";
export type Dietary = "vegan" | "vegetarian" | "gluten_free" | "nut_free" | "dairy_free" | "halal" | "kosher";
export type SupplierId = "amazon_business" | "costco" | "instacart_business" | "local_wholesale";
export type Day = "mon" | "tue" | "wed" | "thu" | "fri";

export type Office = {
  id: string; name: string; headcount: number;
  /** fraction of headcount in office per weekday */
  inOfficeDays: Record<Day, number>;
  monthlyBudget: number; rampFundId?: string;
};

export type Employee = { id: string; name: string; team: string; dietary: Dietary[] };

export type Product = {
  id: string; name: string; brand: string;
  category: "chips" | "bars" | "nuts" | "candy" | "fruit" | "yogurt" | "drinks" | "coffee" | "healthy" | "other";
  dietaryTags: Dietary[]; caloriesPerServing?: number;
  shelfLifeDays: number; perishable: boolean; unitsPerCase: number; zone: Zone;
  description: string; flavorProfile: string[]; emoji: string; weightKg: number;
  embedding?: number[];
  model3d: { shape: "bag" | "box" | "can" | "bottle" | "bar" | "fruit" | "cup"; color: string };
  /** catalog-only items that have never been stocked (trial candidates) */
  trial?: boolean;
};

export type Category = { id: Product["category"]; name: string; description: string; embedding?: number[] };

export type SupplierOffer = { productId: string; supplier: SupplierId; casePrice: number; leadTimeDays: number; minCases: number };

export type InventoryBatch = {
  id: string; productId: string; quantity: number; receivedAt: string; expiresAt: string;
  location: { zone: Zone; shelf: number; slot: number }; eatFirst?: boolean;
};

export type ConsumptionEvent = { id: string; productId: string; quantity: number; at: string; source: "camera" | "manual" | "checkout" };
export type Vote = { id: string; employeeId: string; productId: string; value: 1 | -1; at: string };

export type SnackRequest = {
  id: string; employeeId: string; text: string; embedding?: number[];
  matches: { productId: string; score: number; inStock: boolean }[];
  category?: Product["category"]; clusterId?: string;
  upvotes: number; status: "open" | "fulfilled_from_stock" | "added" | "declined"; at: string;
};

export type WasteEvent = {
  id: string; productId: string; quantity: number; reason: "expired" | "spoiled" | "damaged" | "donated";
  costUsd: number; kg: number; at: string; donated?: boolean; period: "baseline" | "live";
};

export type OrderLine = { productId: string; cases: number; casePrice: number; supplier: SupplierId; note?: string };
export type Order = {
  id: string; supplier: string; lines: OrderLine[]; totalUsd: number;
  status: "draft" | "pending_approval" | "approved" | "placed" | "received";
  rampTransactionId?: string; receiptAttached: boolean; rationale: string; createdAt: string;
  kind: "baseline" | "agent"; memo?: string;
};

export type ShelfScan = {
  id: string; at: string; zone: Zone | "all";
  detections: { productId: string; count: number; confidence: number }[];
  diffFromExpected: { productId: string; delta: number }[];
  minutesSaved: number;
};

export type Settings = {
  cadenceDays: 7 | 14; safetyStockDays: number; healthyMixTarget: number;
  autoApproveUnder: number; dietaryCoverageTarget: number;
  minutes: { countPerSku: number; pollingPerWeek: number; orderingPerOrder: number; receiptPerOrder: number; reconciliationPerMonth: number };
  rampMode: "mock" | "sandbox"; visionMode: "mock" | "live";
};
