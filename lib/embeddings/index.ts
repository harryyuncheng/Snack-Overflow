import type { Product } from "../types";
import { LocalLiteEmbedder } from "./local-lite";

export interface Embedder { name: string; dims: number; embed(texts: string[]): Promise<number[][]> }

let embedder: Embedder | null = null;
/**
 * EMBEDDINGS_MODE=local (default) uses the zero-download concept embedder so the demo runs offline.
 * voyage/openai plug in behind the same interface.
 */
export function getEmbedder(): Embedder {
  if (embedder) return embedder;
  const mode = process.env.EMBEDDINGS_MODE ?? "local";
  if (mode === "openai" && process.env.OPENAI_API_KEY) embedder = new HostedEmbedder("openai");
  else if (mode === "voyage" && process.env.VOYAGE_API_KEY) embedder = new HostedEmbedder("voyage");
  else embedder = new LocalLiteEmbedder();
  return embedder;
}

class HostedEmbedder implements Embedder {
  dims = 0;
  constructor(public name: "openai" | "voyage") {}
  async embed(texts: string[]) {
    const isOpenAI = this.name === "openai";
    const res = await fetch(isOpenAI ? "https://api.openai.com/v1/embeddings" : "https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${isOpenAI ? process.env.OPENAI_API_KEY : process.env.VOYAGE_API_KEY}` },
      body: JSON.stringify({ model: isOpenAI ? "text-embedding-3-small" : "voyage-3-lite", input: texts }),
    });
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

export function embeddingText(p: Product) {
  return `${p.name}. ${p.brand}. Category: ${p.category}. Zone: ${p.zone.replace("_", " ")}. ${p.flavorProfile.join(", ")}. ${p.dietaryTags.join(", ")}. ${p.description}`;
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
