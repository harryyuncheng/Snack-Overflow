"use client";
import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/lib/snapshot";

export function useSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const refresh = useCallback(async () => { const r = await fetch("/api/state", { cache: "no-store" }); setData(await r.json()); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, refresh };
}

export const post = async <T = unknown,>(url: string, body?: unknown, method = "POST"): Promise<T> =>
  (await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json();

export const usd = (n: number, d = 0) => `$${n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const ZONE_LABEL: Record<string, string> = { drink_fridge: "Drink fridge", fresh_fridge: "Fresh fridge", pantry: "Pantry", coffee_bar: "Coffee bar", fruit_bowl: "Fruit bowl", freezer: "Freezer" };
