import type { Embedder } from "./index";

/**
 * Offline concept embedder: tokens are expanded through a small snack ontology, then hashed
 * into a fixed 384-dim space (same width as MiniLM) with sublinear TF weighting.
 * Deterministic, instant, no model download. Swap for transformers.js / hosted via EMBEDDINGS_MODE.
 */
const CONCEPTS: Record<string, string[]> = {
  salty: ["salt", "savory", "salted"], crunchy: ["crisp", "crispy", "crunch", "crunchy"],
  sweet: ["sugar", "sugary", "dessert", "treat", "candy", "chocolate"], chocolate: ["sweet", "cocoa"],
  caffeinated: ["caffeine", "energy", "focus", "awake", "slump", "jittery", "mate", "matcha"],
  caffeine: ["caffeinated", "energy"], energy: ["caffeinated", "caffeine", "slump"], coffee: ["caffeinated", "brew", "espresso", "latte"],
  tea: ["caffeinated", "matcha", "green", "leaf"], mate: ["yerba", "caffeinated", "energy", "guayusa"], guayusa: ["mate", "caffeinated"],
  matcha: ["tea", "green", "caffeinated"], slump: ["energy", "caffeinated", "afternoon"],
  protein: ["filling", "gym", "workout", "high-protein"], fizzy: ["sparkling", "bubbly", "carbonated", "soda", "seltzer"],
  sparkling: ["fizzy", "bubbly", "water"], bubbly: ["fizzy", "sparkling"], healthy: ["light", "fresh", "nutritious", "low-calorie"],
  light: ["healthy", "low-calorie"], fresh: ["fruit", "healthy"], spicy: ["hot", "fiery", "chili", "jalapeno", "spice"],
  fiery: ["spicy", "hot"], hot: ["spicy"], chips: ["crunchy", "salty", "crisps"], crackers: ["crunchy", "salty", "cracker"],
  gluten_free: ["celiac", "gf"], vegan: ["plant-based", "dairy_free"], nut_free: ["allergy"], creamy: ["smooth", "dairy"],
  fruit: ["fresh", "sweet", "fruity"], indulgent: ["treat", "guilty"], chewy: ["gummy"], drink: ["drinks", "beverage", "can"],
  drinks: ["drink", "beverage"], water: ["sparkling", "hydration"],
};
const STOP = new Set("a an the and or of for to in on with that is isn't not but me my i something some please any more need want keeps running out options it its from like".split(" "));

export function tokenize(text: string) {
  return text.toLowerCase()
    .replace(/gluten[- ]free/g, "gluten_free").replace(/nut[- ]free/g, "nut_free").replace(/dairy[- ]free/g, "dairy_free")
    .replace(/[^a-z_\- ]+/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export class LocalLiteEmbedder implements Embedder {
  name = "local-lite (offline concept hashing)";
  dims = 384;
  async embed(texts: string[]) { return texts.map((t) => this.embedOne(t)); }
  embedOne(text: string) {
    const v = new Array(this.dims).fill(0);
    const tf: Record<string, number> = {};
    for (const tok of tokenize(text)) {
      tf[tok] = (tf[tok] ?? 0) + 1;
      const key = CONCEPTS[tok] ? tok : CONCEPTS[tok + "s"] ? tok + "s" : tok;
      for (const c of CONCEPTS[key] ?? []) tf[c] = (tf[c] ?? 0) + 0.5;
    }
    for (const [tok, f] of Object.entries(tf)) {
      const w = 1 + Math.log(1 + f);
      const h = hash(tok);
      v[h % this.dims] += (h & 1 ? 1 : -1) * w;
      v[(h >>> 9) % this.dims] += (h & 2 ? 1 : -1) * w * 0.5;
    }
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  }
}
