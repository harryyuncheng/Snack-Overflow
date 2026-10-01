import { getDB } from "@/lib/store";
import { substitutes } from "@/lib/semantic";
export async function GET(_: Request, { params }: { params: Promise<{ productId: string }> }) {
  return Response.json(substitutes(await getDB(), (await params).productId, 4));
}
