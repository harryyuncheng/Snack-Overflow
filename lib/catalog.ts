import type { Category, Product } from "./types";
import { catalogRows, categoryRows } from "./data";
import { IMAGES } from "./images";

// Sample data (data/catalog.json): real snack brands with product photos from Open Food Facts (public/snacks). Prices are plausible estimates, not quotes.
export type CatalogMeta = { pop: number; rating: number; basePrice: number };
export const catalogMeta: Record<string, CatalogMeta> = {};

export const products: Product[] = catalogRows.map((r) => {
  const { id, name, brand, category, zone, shelfLifeDays, unitsPerCase, basePrice, flavorProfile, dietaryTags, caloriesPerServing, model3d, emoji, pop, rating, description, trial } = r;
  catalogMeta[id] = { pop, rating, basePrice };
  return {
    id, name, brand, category, zone, shelfLifeDays, unitsPerCase, perishable: shelfLifeDays <= 21,
    flavorProfile, dietaryTags, caloriesPerServing, description, emoji,
    weightKg: category === "drinks" || zone === "drink_fridge" ? 0.36 : category === "fruit" ? 0.15 : 0.06,
    model3d, trial: trial ?? false,
    image: IMAGES.has(id) ? `/snacks/${id}.jpg` : undefined,
  };
});

export const categories: Category[] = categoryRows.map((c) => ({ ...c }));
