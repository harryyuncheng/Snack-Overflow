"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/snapshot";

export function useSnapshot(pollMs?: number) {
  const [data, setData] = useState<Snapshot | null>(null);
  const last = useRef("");
  const refresh = useCallback(async () => {
    const text = await (await fetch("/api/state", { cache: "no-store" })).text();
    if (text !== last.current) { last.current = text; setData(JSON.parse(text)); }
  }, []);
  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);
  return { data, refresh };
}

export const post = async <T = unknown,>(url: string, body?: unknown, method = "POST"): Promise<T> =>
  (await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json();

export const usd = (n: number, d = 0) => `$${n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const ZONE_LABEL: Record<string, string> = { drink_fridge: "Drink fridge", fresh_fridge: "Fresh fridge", pantry: "Pantry", coffee_bar: "Coffee bar", fruit_bowl: "Fruit bowl", freezer: "Freezer" };
export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric" });
