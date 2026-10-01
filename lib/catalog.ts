import type { Category, Dietary, Product } from "./types";

// Sample data: fictional generic products. Prices are plausible estimates, not quotes.
type Row = [
  id: string, name: string, brand: string, category: Product["category"], zone: Product["zone"],
  shelfLifeDays: number, unitsPerCase: number, basePrice: number,
  flavor: string, dietary: string, cals: number, shape: Product["model3d"]["shape"], color: string, emoji: string,
  /** units eaten per in-office person per day */ pop: number, /** -1..1 vote bias */ rating: number,
  description: string, trial?: boolean,
];

const rows: Row[] = [
  // drink fridge
  ["sparkling-lime", "Lime Sparkling Water", "Fizzwell", "drinks", "drink_fridge", 270, 24, 9.5, "fizzy light fresh", "vegan gluten_free nut_free", 0, "can", "#7ed957", "🥤", 0.2, 0.8, "Unsweetened lime sparkling water. Zero calories, crisp and bubbly."],
  ["sparkling-grapefruit", "Grapefruit Sparkling Water", "Fizzwell", "drinks", "drink_fridge", 270, 24, 9.5, "fizzy light sour", "vegan gluten_free nut_free", 0, "can", "#ff8a65", "🥤", 0.12, 0.6, "Grapefruit sparkling water, zero sugar, bright and tart."],
  ["cola", "Classic Cola", "Generic", "drinks", "drink_fridge", 270, 24, 11, "fizzy sweet caffeinated", "vegan gluten_free nut_free", 140, "can", "#c62828", "🥤", 0.08, 0.1, "Full-sugar cola soda with caffeine. A classic sweet fizzy drink."],
  ["cold-brew", "Cold Brew Can", "Nightshift", "coffee", "drink_fridge", 180, 12, 27, "caffeinated creamy", "vegan gluten_free nut_free", 20, "can", "#4e342e", "☕", 0.1, 0.7, "Ready-to-drink black cold brew coffee in a can. Strong caffeine kick."],
  ["kombucha", "Ginger Kombucha", "Brewtiful", "drinks", "drink_fridge", 60, 12, 36, "fizzy sour fresh", "vegan gluten_free nut_free", 50, "bottle", "#ffb74d", "🍾", 0.03, 0.5, "Fermented ginger tea with probiotics, lightly fizzy and tangy."],
  ["iced-tea", "Peach Iced Tea", "Leafly", "drinks", "drink_fridge", 270, 12, 15, "sweet fresh caffeinated", "vegan gluten_free nut_free", 90, "bottle", "#ffcc80", "🧋", 0.04, 0.2, "Bottled black tea with peach. Light caffeine, sweet."],
  ["yerba-mate", "Yerba Mate Can", "Andes Leaf", "drinks", "drink_fridge", 270, 12, 30, "caffeinated fresh fizzy", "vegan gluten_free nut_free", 30, "can", "#9ccc65", "🧉", 0, 0.6, "Sparkling yerba mate: plant-based caffeine energy that isn't coffee, smooth focus for the afternoon slump.", true],
  ["matcha-latte", "Matcha Latte Can", "Kyoto Greens", "drinks", "drink_fridge", 180, 12, 34, "caffeinated creamy sweet", "vegetarian gluten_free nut_free", 110, "can", "#8bc34a", "🍵", 0, 0.5, "Green tea matcha latte, gentle caffeine from tea instead of coffee.", true],
  // fresh fridge
  ["greek-yogurt", "Greek Yogurt Cup", "Dairy Hill", "yogurt", "fresh_fridge", 14, 12, 14, "creamy protein", "vegetarian gluten_free nut_free", 120, "cup", "#e3f2fd", "🥛", 0.06, 0.6, "Plain high-protein Greek yogurt cup. Creamy and filling."],
  ["berry-yogurt", "Berry Yogurt Cup", "Dairy Hill", "yogurt", "fresh_fridge", 14, 12, 12, "creamy sweet", "vegetarian gluten_free nut_free", 150, "cup", "#f8bbd0", "🍓", 0.05, 0.4, "Strawberry blueberry yogurt cup, sweet and creamy."],
  ["hummus-cups", "Hummus Snack Cups", "Mezze Co", "healthy", "fresh_fridge", 10, 12, 15, "savory creamy", "vegan gluten_free nut_free dairy_free", 160, "cup", "#d7ccc8", "🫘", 0.04, 0.5, "Classic hummus cups with pretzel dippers. Savory plant protein."],
  ["cheese-sticks", "String Cheese", "Dairy Hill", "healthy", "fresh_fridge", 21, 24, 13, "savory protein chewy", "vegetarian gluten_free nut_free", 80, "bar", "#fff59d", "🧀", 0.07, 0.6, "Mozzarella string cheese, a quick protein snack."],
  ["salad-cups", "Garden Salad Cup", "Greenbox", "healthy", "fresh_fridge", 5, 8, 28, "fresh light crunchy", "vegan gluten_free nut_free dairy_free", 90, "cup", "#a5d6a7", "🥗", 0.012, 0.7, "Prepared garden salad cup with vinaigrette. Fresh and light."],
  ["veggie-sticks", "Carrot & Celery Sticks", "Greenbox", "healthy", "fresh_fridge", 7, 12, 14, "fresh crunchy light", "vegan gluten_free nut_free dairy_free", 35, "bag", "#ff9800", "🥕", 0.01, 0.8, "Pre-cut carrot and celery sticks. The aspirational healthy snack.", false],
  // pantry
  ["sea-salt-chips", "Sea Salt Kettle Chips", "Crunchtown", "chips", "pantry", 120, 24, 17, "salty crunchy savory", "vegan gluten_free nut_free", 150, "bag", "#ffd54f", "🥔", 0.11, 0.7, "Thick-cut kettle potato chips with sea salt."],
  ["bbq-chips", "BBQ Potato Chips", "Crunchtown", "chips", "pantry", 120, 24, 17, "salty smoky crunchy savory sweet", "vegan gluten_free nut_free", 150, "bag", "#8d6e63", "🥔", 0.06, 0.4, "Smoky barbecue potato chips."],
  ["cheese-puffs", "Fiery Cheese Puffs", "Blaze", "chips", "pantry", 90, 24, 16, "spicy crunchy salty indulgent", "vegetarian nut_free", 160, "bag", "#ff5722", "🔥", 0.09, -0.4, "Hot chili cheese puffs. Messy, spicy, indulgent: the guilty pleasure."],
  ["popcorn", "Sea Salt Popcorn", "Poplite", "healthy", "pantry", 180, 24, 18, "salty crunchy light", "vegan gluten_free nut_free", 110, "bag", "#fff8e1", "🍿", 0.07, 0.7, "Air-popped popcorn with sea salt, a lighter crunchy alternative to potato chips."],
  ["pretzels", "Mini Pretzels", "Twistee", "chips", "pantry", 180, 24, 13, "salty crunchy", "vegan nut_free", 110, "bag", "#a1887f", "🥨", 0.04, 0.3, "Crunchy salted mini pretzel twists."],
  ["kale-crisps", "Kale Crisps", "Greenly", "healthy", "pantry", 60, 12, 30, "savory crunchy light", "vegan gluten_free nut_free", 120, "bag", "#2e7d32", "🥬", 0.003, -0.6, "Baked kale chips with nutritional yeast. Earthy, crumbly."],
  ["beet-chips", "Beet Chips", "Greenly", "healthy", "pantry", 90, 12, 28, "crunchy sweet light", "vegan gluten_free nut_free", 130, "bag", "#880e4f", "🫚", 0.004, -0.5, "Thin baked beetroot chips. Sweet and earthy."],
  ["rice-crackers", "Rice Crackers", "Kumo", "chips", "pantry", 240, 12, 16, "salty crunchy light", "vegan gluten_free nut_free dairy_free", 120, "box", "#eceff1", "🍘", 0.03, 0.4, "Gluten-free crispy rice crackers lightly salted."],
  ["protein-bar", "Chocolate Protein Bar", "Liftbar", "bars", "pantry", 270, 12, 22, "protein sweet chewy", "vegetarian gluten_free", 210, "bar", "#5d4037", "🍫", 0.07, 0.5, "20g protein chocolate bar. Chewy, filling, gym-friendly."],
  ["granola-bar", "Oat Granola Bar", "Meadow", "bars", "pantry", 270, 24, 14, "sweet chewy", "vegan dairy_free nut_free", 140, "bar", "#d4a373", "🌾", 0.06, 0.4, "Chewy oat and honey-free granola bar."],
  ["nut-bar", "Almond Fruit & Nut Bar", "Kindly", "bars", "pantry", 270, 12, 18, "sweet crunchy protein", "vegetarian gluten_free dairy_free", 200, "bar", "#bcaaa4", "🥜", 0.05, 0.6, "Whole almonds and dried fruit bar. Contains tree nuts."],
  ["prune-bar", "Prune Fiber Bar", "Regulus", "bars", "pantry", 270, 12, 24, "sweet chewy", "vegan gluten_free nut_free", 160, "bar", "#4a148c", "🟣", 0.002, -0.7, "High-fiber prune bar. Nobody's first choice."],
  ["quinoa-bar", "Quinoa Superfood Bar", "Ancient", "healthy", "pantry", 200, 12, 30, "light sweet protein", "vegan gluten_free nut_free", 170, "bar", "#c5e1a5", "🌱", 0.008, 0.8, "Quinoa, chia and berry superfood bar. Voted up, rarely eaten."],
  ["almonds", "Roasted Almonds Pack", "Kindly", "nuts", "pantry", 240, 24, 26, "salty crunchy protein", "vegan gluten_free dairy_free", 170, "bag", "#a1887f", "🌰", 0.04, 0.5, "Lightly salted roasted almonds in single-serve packs."],
  ["trail-mix", "Trail Mix", "Kindly", "nuts", "pantry", 180, 24, 22, "sweet salty crunchy", "vegetarian gluten_free", 180, "bag", "#ffb300", "🥜", 0.05, 0.4, "Peanuts, raisins, and chocolate candies."],
  ["seaweed", "Roasted Seaweed Snacks", "Kumo", "healthy", "pantry", 240, 24, 20, "salty crunchy light savory", "vegan gluten_free nut_free dairy_free", 30, "box", "#1b5e20", "🌊", 0.02, 0.3, "Crispy roasted seaweed sheets with sea salt."],
  ["choc-candy", "Chocolate Candy Bar", "Cocoa Co", "candy", "pantry", 300, 36, 30, "sweet indulgent chewy", "vegetarian", 220, "bar", "#6d4c41", "🍫", 0.07, 0.3, "Milk chocolate caramel candy bar."],
  ["gummy-bears", "Gummy Bears", "Chewy Co", "candy", "pantry", 365, 24, 15, "sweet chewy", "gluten_free nut_free dairy_free", 140, "bag", "#e91e63", "🐻", 0.05, 0.2, "Fruit-flavored gummy bears."],
  ["carob-clusters", "Carob Clusters", "Greenly", "candy", "pantry", 120, 12, 26, "sweet crunchy", "vegan gluten_free", 150, "bag", "#795548", "🟤", 0.002, -0.6, "Carob-coated sunflower clusters, a chocolate substitute."],
  // coffee bar
  ["coffee-pods", "Medium Roast Coffee Pods", "Nightshift", "coffee", "coffee_bar", 240, 48, 32, "caffeinated", "vegan gluten_free nut_free", 5, "box", "#3e2723", "☕", 0.22, 0.6, "Medium roast single-serve coffee pods."],
  ["oat-milk", "Oat Milk Barista", "Oatly-ish", "coffee", "coffee_bar", 30, 6, 21, "creamy", "vegan gluten_free nut_free dairy_free", 120, "box", "#f5f5dc", "🥛", 0.03, 0.6, "Barista oat milk for lattes. Dairy-free creamer."],
  ["green-tea", "Green Tea Bags", "Leafly", "coffee", "coffee_bar", 540, 100, 12, "caffeinated fresh light", "vegan gluten_free nut_free", 0, "box", "#66bb6a", "🍵", 0.04, 0.4, "Green tea bags. Lighter caffeine, not coffee."],
  // fruit bowl
  ["bananas", "Bananas", "Local farm", "fruit", "fruit_bowl", 6, 40, 14, "sweet fresh light", "vegan gluten_free nut_free dairy_free", 105, "fruit", "#ffeb3b", "🍌", 0.11, 0.6, "Fresh bananas. Quick natural sugar."],
  ["apples", "Honeycrisp Apples", "Local farm", "fruit", "fruit_bowl", 21, 40, 30, "sweet crunchy fresh", "vegan gluten_free nut_free dairy_free", 95, "fruit", "#e53935", "🍎", 0.06, 0.6, "Crisp honeycrisp apples."],
  ["clementines", "Clementines", "Local farm", "fruit", "fruit_bowl", 10, 50, 22, "sweet sour fresh", "vegan gluten_free nut_free dairy_free", 35, "fruit", "#ff9800", "🍊", 0.05, 0.7, "Easy-peel seedless clementines."],
  // freezer
  ["ice-cream-bar", "Vanilla Ice Cream Bar", "Frosty", "candy", "freezer", 180, 24, 22, "sweet creamy indulgent", "vegetarian nut_free", 200, "bar", "#fffde7", "🍦", 0.03, 0.7, "Chocolate-dipped vanilla ice cream bar."],
  ["fruit-pops", "Mango Fruit Pops", "Frosty", "fruit", "freezer", 270, 24, 20, "sweet fresh light", "vegan gluten_free nut_free dairy_free", 70, "bar", "#ffa726", "🥭", 0.015, 0.4, "Frozen real-mango fruit pops."],
];

export type CatalogMeta = { pop: number; rating: number; basePrice: number };
export const catalogMeta: Record<string, CatalogMeta> = {};

export const products: Product[] = rows.map((r) => {
  const [id, name, brand, category, zone, shelfLifeDays, unitsPerCase, basePrice, flavor, dietary, cals, shape, color, emoji, pop, rating, description, trial] = r;
  catalogMeta[id] = { pop, rating, basePrice };
  const dietaryTags = dietary.split(" ").filter(Boolean) as Dietary[];
  return {
    id, name, brand, category, zone, shelfLifeDays, unitsPerCase, perishable: shelfLifeDays <= 21,
    flavorProfile: flavor.split(" "), dietaryTags, caloriesPerServing: cals, description, emoji,
    weightKg: category === "drinks" || zone === "drink_fridge" ? 0.36 : category === "fruit" ? 0.15 : 0.06,
    model3d: { shape, color }, trial: trial ?? false,
  };
});

export const categories: Category[] = [
  { id: "chips", name: "Chips & salty", description: "Chips, popcorn, pretzels, crackers: salty crunchy savory snacks" },
  { id: "bars", name: "Bars", description: "Granola, protein, and fruit bars: chewy filling on-the-go snacks" },
  { id: "nuts", name: "Nuts", description: "Almonds, trail mix: protein-rich crunchy nuts" },
  { id: "candy", name: "Candy & treats", description: "Chocolate, gummies, ice cream: sweet indulgent treats and dessert" },
  { id: "fruit", name: "Fruit", description: "Fresh fruit: bananas, apples, clementines, sweet natural healthy" },
  { id: "yogurt", name: "Yogurt", description: "Yogurt cups: creamy dairy protein breakfast" },
  { id: "drinks", name: "Drinks", description: "Sparkling water, soda, tea, kombucha, energy drinks, fizzy beverages" },
  { id: "coffee", name: "Coffee & caffeine", description: "Coffee, cold brew, pods, tea, milk: caffeine for focus and energy" },
  { id: "healthy", name: "Healthy", description: "Veggies, hummus, salad, seaweed, light healthy low-calorie snacks" },
  { id: "other", name: "Other", description: "Everything else" },
];
