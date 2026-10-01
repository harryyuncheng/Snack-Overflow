"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { post, usd, useSnapshot } from "@/components/useSnapshot";

const LEVER_LABEL: Record<string, string> = { droppedDuds: "Dropped duds", rightSizing: "Right-sized orders", attendanceScaling: "Attendance-aware", supplierSwitching: "Cheaper suppliers" };

export default function Impact() {
  const { data } = useSnapshot();
  const [digest, setDigest] = useState<string | null>(null);
  if (!data) return <div className="p-8 text-slate-500">Loading…</div>;
  const i = data.impact;
  const levers = Object.entries(i.levers).map(([k, v]) => ({ name: LEVER_LABEL[k], v }));
  const base = data.orders.filter((o) => o.kind === "baseline").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const wasteByWeek = (idx: number) => data.waste.filter((w) => w.period === "baseline" && w.id.startsWith(`w${idx}-`)).reduce((a, w) => a + w.costUsd, 0);
  const timeline = [
    ...base.map((o, idx) => ({ week: `W${idx + 1}`, spend: o.totalUsd, waste: Math.round(wasteByWeek(idx)) })),
    ...[1, 2, 3, 4].map((n) => ({ week: `W${8 + n}*`, spend: Math.round(i.optimizedMonthly / 4.33), waste: Math.round(i.waste.projectedUsd / 4.33) })),
  ];
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-end justify-between"><div><h1 className="text-2xl font-bold">Savings & impact</h1><p className="text-sm text-slate-600">Every number below is computed from stored events + the visible assumptions. <span className="chip bg-amber-100 text-amber-900">sample data</span></p></div>
        <button className="btn" onClick={async () => setDigest((await post<{ text: string }>("/api/digest")).text)}>Generate weekly digest</button></div>
      {digest && <div className="card"><div className="mb-1 flex justify-between text-sm font-semibold">Weekly digest <button className="btn-ghost !py-0.5 text-xs" onClick={() => navigator.clipboard.writeText(digest)}>Copy to Slack</button></div><pre className="whitespace-pre-wrap font-sans text-sm">{digest}</pre></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Big v={usd(i.savedMonthly)} l="saved / month" s={`${i.savedPct.toFixed(0)}% vs baseline ${usd(i.baselineMonthly)}`} />
        <Big v={`${i.time.hoursPerMonth}h`} l="hours saved / month" s="office manager time" />
        <Big v={`${i.waste.reductionPct.toFixed(0)}%`} l="waste reduced" s={`${usd(i.waste.baseMonthlyUsd - i.waste.projectedUsd)} · ${(i.waste.baseMonthlyKg - i.waste.projectedKg).toFixed(1)} kg / mo`} />
        <Big v={usd(i.costPerEmployee.now, 2)} l="cost / employee / mo" s={`was ${usd(i.costPerEmployee.baseline, 2)} · benchmark $10–25`} />
        <Big v={`${Math.round(i.satisfaction * 100)}%`} l="satisfaction" s="consumption-weighted net rating" />
        <Big v={`${Math.round((i.coverage.filter((c) => c.pct >= data.settings.dietaryCoverageTarget).length / Math.max(1, i.coverage.length)) * 100)}%`} l="dietary groups covered" s={i.coverage.map((c) => `${c.group} ${c.items}`).join(" · ")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><div className="font-semibold">$ saved per month by lever</div>
          <div className="h-64"><ResponsiveContainer><BarChart data={levers}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis /><Tooltip formatter={(v) => usd(Number(v))} /><Bar dataKey="v" name="$ / month" fill="#059669" /></BarChart></ResponsiveContainer></div>
          <p className="text-xs text-slate-500">Levers are applied sequentially per SKU (drop → right-size to full-headcount demand → scale to attendance → cheapest supplier) so nothing is double counted. Waste avoided is embedded in right-sizing and shown separately.</p>
        </div>
        <div className="card"><div className="font-semibold">Weekly spend & waste: baseline → Snack Overflow (*projected)</div>
          <div className="h-64"><ResponsiveContainer><ComposedChart data={timeline}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" fontSize={11} /><YAxis /><Tooltip formatter={(v) => usd(Number(v))} /><Legend /><ReferenceLine x="W9*" stroke="#7c3aed" label={{ value: "Snack Overflow on", fontSize: 10 }} /><Bar dataKey="spend" name="spend" fill="#64748b" /><Line dataKey="waste" name="waste $" stroke="#dc2626" strokeWidth={2} /></ComposedChart></ResponsiveContainer></div>
        </div>
        <div className="card"><div className="font-semibold">Time saved by task (minutes / month)</div>
          <table className="mt-2 w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th>Task</th><th>Before</th><th>With Snack Overflow</th></tr></thead>
            <tbody>{i.time.rows.map((r) => <tr key={r.task} className="border-t"><td className="py-1 capitalize">{r.task}</td><td>{Math.round(r.beforeMin)}</td><td className="text-emerald-700">{Math.round(r.afterMin)}</td></tr>)}</tbody></table>
          <p className="mt-1 text-xs text-slate-500">Minute assumptions are editable in <a href="/settings" className="underline">Settings</a>.</p>
        </div>
        <div className="card text-sm" id="methodology"><div className="font-semibold">📐 Methodology</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-700">
            <li><b>Baseline</b> (“before Snack Overflow”): the same office orders a fixed weekly basket sized to full headcount ({data.office.headcount}) × 5 days with a 10% cushion, from one supplier (Amazon Business pricing), with no consumption data. 8 weeks of baseline orders and waste are in the dataset.</li>
            <li><b>Snack Overflow</b>: demand = EWMA velocity per in-office person-day × expected person-days ({Object.entries(data.office.inOfficeDays).map(([d, v]) => `${d} ${Math.round(v * 100)}%`).join(", ")}) + {data.settings.safetyStockDays} day safety stock; duds (bottom-quartile velocity + net-negative votes) dropped; cheapest supplier meeting lead time & minimums.</li>
            <li><b>Waste</b>: baseline = logged expiry/damage events. Projection assumes duds removed and perishables ordered within shelf life, with 40% of residual non-dud waste remaining — conservative vs. workplace studies showing 23–51% food-waste cuts from tracking alone.</li>
            <li><b>Time</b>: manual counting {data.settings.minutes.countPerSku} min/SKU twice weekly, {data.settings.minutes.pollingPerWeek} min/week Slack polls, {data.settings.minutes.orderingPerOrder} min/order, {data.settings.minutes.receiptPerOrder} min/order receipts, {data.settings.minutes.reconciliationPerMonth} min/month reconciliation.</li>
            <li><b>Sources</b>: ZeroCater survey of 54 Bay Area companies (~$14.8k/mo avg on snacks & beverages; 59% self-managed); published budget benchmarks ($10–25/employee/mo small offices; $50–150 self-managed; $150–300 fully managed); workplace food-waste intervention studies (23–51% waste reduction, up to 39% lower cost of waste per meal); Fooda (~20% of items drive ~80% of waste).</li>
            <li>All company, employee, product and price data is <b>fictional sample data</b>.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
function Big({ v, l, s }: { v: string; l: string; s: string }) {
  return <div className="card !p-3"><div className="text-2xl font-bold text-emerald-700">{v}</div><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</div><div className="mt-1 text-[11px] text-slate-500">{s}</div></div>;
}
