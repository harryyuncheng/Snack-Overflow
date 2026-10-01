import { getDB } from "@/lib/store";
import { draftOrder } from "@/lib/forecast";
import { llm } from "@/lib/llm";
export async function GET() { return Response.json((await getDB()).orders); }
export async function POST() {
  const db = await getDB();
  db.orders = db.orders.filter((o) => !(o.kind === "agent" && ["draft", "pending_approval"].includes(o.status)));
  const order = await draftOrder(db);
  order.rationale = await llm(
    `You are an office snack ordering agent. Rewrite these order notes as a crisp plain-English rationale for an office manager (max 8 bullets, keep numbers):\n${order.rationale}`,
    order.rationale,
  );
  db.orders.push(order);
  return Response.json(order);
}
