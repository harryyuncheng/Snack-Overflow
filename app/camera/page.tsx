"use client";
import { useEffect, useRef, useState } from "react";
import { post, useSnapshot } from "@/components/useSnapshot";
import { CAN_IDS } from "@/lib/cans";

type Reading = { counts: Record<string, number>; stable: boolean; changes: { productId: string; delta: number }[]; at: string; error?: string };

const FRAME_WIDTH = 640;
const INTERVAL_MS = 3000;

export default function CameraPage() {
  const CANS = useSnapshot().data?.products.filter((p) => CAN_IDS.includes(p.id)) ?? [];
  const video = useRef<HTMLVideoElement>(null);
  const running = useRef(false);
  const [on, setOn] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");

  const stop = () => {
    running.current = false;
    setOn(false);
    (video.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  };
  useEffect(() => stop, []);

  const loop = async () => {
    const v = video.current!;
    const c = document.createElement("canvas");
    while (running.current) {
      const started = Date.now();
      c.width = FRAME_WIDTH; c.height = Math.round((v.videoHeight / v.videoWidth) * FRAME_WIDTH);
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      try {
        const r = await post<Reading>("/api/camera", { image: c.toDataURL("image/jpeg", 0.7) });
        if (r.error) throw new Error(r.error);
        setError(""); setReading(r);
        if (r.changes.length) setLog((l) => [...r.changes.map((x) => `${new Date(r.at).toLocaleTimeString()} ${CANS.find((p) => p.id === x.productId)?.name ?? x.productId} ${x.delta > 0 ? "+" : ""}${x.delta}`), ...l].slice(0, 20));
      } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
      await new Promise((r) => setTimeout(r, Math.max(0, INTERVAL_MS - (Date.now() - started))));
    }
  };

  const start = async () => {
    try {
      const get = (video: MediaTrackConstraints | boolean) => navigator.mediaDevices.getUserMedia({ video, audio: false });
      const s = await get({ facingMode: { exact: "environment" } }).catch(() => get(true));
      video.current!.srcObject = s; await video.current!.play();
      running.current = true; setOn(true); loop();
    } catch (e) { setError(`Camera unavailable (${e instanceof Error ? e.message : e}). Phones need an HTTPS URL (see README).`); }
  };

  return (
    <main className="mx-auto max-w-md space-y-3 p-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-900">
        <video ref={video} className="h-full w-full object-cover" muted playsInline />
        {!on && <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">Point at the cans and press Start</div>}
        {on && <div className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">● LIVE</div>}
      </div>
      <button className="btn w-full py-3 text-base" onClick={on ? stop : start}>{on ? "Stop" : "Start camera"}</button>
      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        {CANS.map((p) => (
          <div key={p.id} className="card p-2 text-center">
            <div className="mx-auto mb-1 h-2 w-8 rounded-full" style={{ background: p.model3d.color }} />
            <div className="text-3xl font-bold">{reading?.counts[p.id] ?? "–"}</div>
            <div className="text-xs">{p.name}</div>
          </div>
        ))}
      </div>
      {reading && <div className="text-center text-xs text-slate-500">{reading.stable ? "✓ Stock synced" : "Low confidence, stock unchanged"} · {new Date(reading.at).toLocaleTimeString()}</div>}
      {log.length > 0 && <div className="card space-y-1 p-2 text-sm">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
    </main>
  );
}
