import { getDB } from "@/lib/store";
import { snapshot } from "@/lib/snapshot";
import { llm } from "@/lib/llm";
import { APP_NAME } from "@/lib/types";
export async function POST() {
  const s = await snapshot(await getDB());
  const name = (id: string) => s.products.find((p) => p.id === id)?.name ?? id;
  const top = [...s.stats].sort((a, b) => b.last28 - a.last28).slice(0, 3).map((x) => name(x.productId));
  const duds = Object.entries(s.quadrants).filter(([, q]) => q === "dud").map(([id]) => name(id));
  const i = s.impact;
  const fallback = `*${APP_NAME} weekly digest — ${s.office.name}*
• Spend: $${s.ramp.fund.spent.toFixed(0)} of $${s.ramp.fund.limit} monthly Ramp fund used.
• Savings: $${i.savedMonthly.toFixed(0)}/month vs baseline (${i.savedPct.toFixed(0)}%), ${i.time.hoursPerMonth}h/month of office-manager time back.
• Waste: projected down ${i.waste.reductionPct.toFixed(0)}% ($${i.waste.baseMonthlyUsd.toFixed(0)} → $${i.waste.projectedUsd.toFixed(0)}/mo); ${i.waste.donatedKg}kg donated.
• Top movers: ${top.join(", ")}. Dropping: ${duds.join(", ") || "none"}.
• Top request theme: "${s.clusters[0]?.label}" (${s.clusters[0]?.upvotes} votes) — trialing next order.
• Cost/employee: $${i.costPerEmployee.now}/mo (benchmark $10–25).`;
  const text = await llm(`Rewrite this office snack program digest for leadership/finance in Slack markdown, under 120 words, keep all numbers:\n${fallback}`, fallback);
  return Response.json({ text });
}
