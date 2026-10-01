import { getDB } from "@/lib/store";
import { semanticSearch } from "@/lib/semantic";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return Response.json({ results: [] });
  const { embedding: _e, ...rest } = await semanticSearch(await getDB(), q, { k: 8 });
  return Response.json(rest);
}
