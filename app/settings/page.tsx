"use client";
import { post, useSnapshot } from "@/components/useSnapshot";

export default function SettingsPage() {
  const { data, refresh } = useSnapshot();
  if (!data) return <div className="p-8 text-slate-500">Loading…</div>;
  const s = data.settings;
  const save = async (body: unknown) => { await post("/api/settings", body); refresh(); };
  const num = (label: string, value: number, onChange: (v: number) => void, step = 1) => (
    <label className="flex items-center justify-between gap-2 text-sm"><span>{label}</span><input type="number" step={step} defaultValue={value} onBlur={(e) => onChange(+e.target.value)} className="w-28 rounded border px-2 py-1" /></label>
  );
  return (
    <main className="mx-auto grid max-w-4xl gap-4 p-4 md:grid-cols-2">
      <div className="card space-y-2"><div className="font-semibold">Budget & ordering</div>
        {num("Monthly budget ($)", data.office.monthlyBudget, (v) => save({ office: { monthlyBudget: v } }))}
        <label className="flex items-center justify-between text-sm"><span>Cadence</span><select defaultValue={s.cadenceDays} onChange={(e) => save({ settings: { cadenceDays: +e.target.value } })} className="rounded border px-2 py-1"><option value={7}>weekly</option><option value={14}>biweekly</option></select></label>
        {num("Safety stock (days)", s.safetyStockDays, (v) => save({ settings: { safetyStockDays: v } }), 0.5)}
        {num("Auto-approve under ($)", s.autoApproveUnder, (v) => save({ settings: { autoApproveUnder: v } }))}
        {num("Healthy mix target", s.healthyMixTarget, (v) => save({ settings: { healthyMixTarget: v } }), 0.05)}
        {num("Dietary coverage target", s.dietaryCoverageTarget, (v) => save({ settings: { dietaryCoverageTarget: v } }), 0.05)}
      </div>
      <div className="card space-y-2"><div className="font-semibold">Time assumptions (minutes)</div>
        {(Object.entries(s.minutes) as [keyof typeof s.minutes, number][]).map(([k, v]) => num(k, v, (x) => save({ settings: { minutes: { [k]: x } } }), 0.1))}
      </div>
      <div className="card space-y-1 text-sm md:col-span-2"><div className="font-semibold">Integrations</div>
        <div>Ramp: <b>{data.ramp.mode}</b> (RAMP_MODE=mock|sandbox) · fund “{data.ramp.fund.name}”</div>
        <div>Vision: <b>{s.visionMode}</b> (VISION_MODE=mock|live, needs ANTHROPIC_API_KEY)</div>
        <div>Embeddings: EMBEDDINGS_MODE=local (offline concept embedder, default) | voyage | openai</div>
        <p className="text-xs text-slate-500">Set these in <code>.env.local</code>. The app runs fully in mock/local mode.</p>
      </div>
    </main>
  );
}
