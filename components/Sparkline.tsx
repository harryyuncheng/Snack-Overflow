"use client";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
export default function Sparkline({ data, color = "#0f766e" }: { data: number[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data.map((v, i) => ({ w: `wk ${i + 1}`, v }))}><Tooltip formatter={(v) => [`${v} eaten`, ""]} labelFormatter={(l) => l} /><Line dataKey="v" stroke={color} strokeWidth={2} dot={false} /></LineChart>
    </ResponsiveContainer>
  );
}
