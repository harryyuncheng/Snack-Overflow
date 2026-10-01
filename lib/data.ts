/** Hand-written seed inputs from data/*.json, validated at import so a bad row fails loudly. */
import { z } from "zod";
import catalogJson from "../data/catalog.json";
import categoriesJson from "../data/categories.json";
import officeJson from "../data/office.json";
import suppliersJson from "../data/suppliers.json";
import requestsJson from "../data/requests.json";
import settingsJson from "../data/settings.json";
import scenarioJson from "../data/scenario.json";

const Zone = z.enum(["drink_fridge", "fresh_fridge", "pantry", "coffee_bar", "freezer", "fruit_bowl"]);
const Category = z.enum(["chips", "bars", "nuts", "candy", "fruit", "yogurt", "drinks", "coffee", "healthy", "other"]);
const Dietary = z.enum(["vegan", "vegetarian", "gluten_free", "nut_free", "dairy_free", "halal", "kosher"]);
const Supplier = z.enum(["amazon_business", "costco", "instacart_business", "local_wholesale"]);

export const CatalogRow = z.object({
  id: z.string(), name: z.string(), brand: z.string(), category: Category, zone: Zone,
  shelfLifeDays: z.number().positive(), unitsPerCase: z.number().int().positive(), basePrice: z.number().positive(),
  flavorProfile: z.array(z.string()), dietaryTags: z.array(Dietary), caloriesPerServing: z.number().optional(),
  model3d: z.object({ shape: z.enum(["bag", "box", "can", "bottle", "bar", "fruit", "cup"]), color: z.string() }),
  emoji: z.string(),
  /** units eaten per in-office person per day */ pop: z.number().min(0),
  /** -1..1 vote bias */ rating: z.number().min(-1).max(1),
  description: z.string(), trial: z.boolean().optional(),
}).strict();

const parse = <T extends z.ZodTypeAny>(name: string, schema: T, data: unknown): z.infer<T> => {
  const r = schema.safeParse(data);
  if (!r.success) throw new Error(`data/${name}.json is invalid: ${r.error.message}`);
  return r.data;
};

export const catalogRows = parse("catalog", z.array(CatalogRow), catalogJson);
export const categoryRows = parse("categories", z.array(z.object({ id: Category, name: z.string(), description: z.string() })), categoriesJson);
export const officeData = parse("office", z.object({
  office: z.object({ id: z.string(), name: z.string(), headcount: z.number().int().positive(),
    inOfficeDays: z.object({ mon: z.number(), tue: z.number(), wed: z.number(), thu: z.number(), fri: z.number() }),
    monthlyBudget: z.number().positive(), rampFundId: z.string().optional() }),
  namePool: z.array(z.string()).min(1), teamPool: z.array(z.string()).min(1), dietaryPool: z.array(z.array(Dietary)).min(1),
}), officeJson);
export const supplierRows = parse("suppliers", z.array(z.object({ id: Supplier, mult: z.number(), lead: z.number(), min: z.number() })), suppliersJson);
export const requestRows = parse("requests", z.array(z.object({ text: z.string(), upvotes: z.number().int() })), requestsJson);
export const settingsData = parse("settings", z.object({
  cadenceDays: z.union([z.literal(7), z.literal(14)]), safetyStockDays: z.number(), healthyMixTarget: z.number(), autoApproveUnder: z.number(), dietaryCoverageTarget: z.number(),
  minutes: z.object({ countPerSku: z.number(), pollingPerWeek: z.number(), orderingPerOrder: z.number(), receiptPerOrder: z.number(), reconciliationPerMonth: z.number() }),
  rampMode: z.enum(["mock", "sandbox"]), visionMode: z.enum(["mock", "live"]),
}), settingsJson);
export const scenario = parse("scenario", z.object({ duds: z.array(z.string()), trialAdd: z.string(), hourShare: z.record(z.string(), z.number()) }).passthrough(), scenarioJson);

const ids = new Set(catalogRows.map((p) => p.id));
if (ids.size !== catalogRows.length) throw new Error("data/catalog.json has duplicate ids");
for (const id of [...scenario.duds, scenario.trialAdd]) if (!ids.has(id)) throw new Error(`data/scenario.json references unknown product "${id}"`);
