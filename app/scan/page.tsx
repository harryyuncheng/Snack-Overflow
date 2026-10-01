"use client";
import { useEffect, useRef, useState } from "react";
import { post, useSnapshot, ZONE_LABEL } from "@/components/useSnapshot";
import type { ShelfScan } from "@/lib/types";

export default function ScanPage() {
  const { data, refresh } = useSnapshot();
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState(false);
  const [zone, setZone] = useState("pantry");
  const [img, setImg] = useState<string | null>(null);
  const [res, setRes] = useState<{ scan: ShelfScan; mode: string; consumed: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { (video.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop()); }, []);
  const start = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); if (video.current) { video.current.srcObject = s; await video.current.play(); setCam(true); } }
    catch { alert("Camera unavailable — mock scan still works."); }
  };
  const scan = async () => {
    setBusy(true);
    let image = img;
    if (cam && video.current) { const c = document.createElement("canvas"); c.width = video.current.videoWidth; c.height = video.current.videoHeight; c.getContext("2d")!.drawImage(video.current, 0, 0); image = c.toDataURL("image/jpeg", 0.8); setImg(image); }
    setRes(await post("/api/scan", { zone, image })); setBusy(false); refresh();
  };
  const name = (id: string) => data?.products.find((p) => p.id === id);
  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-2">
      <div className="card space-y-3">
        <h1 className="text-xl font-bold">📸 Camera shelf scan</h1>
        <p className="text-sm text-slate-600">Point a webcam (or upload a photo) at a shelf. A vision model returns structured counts, which update inventory and log consumption — no clipboard counting.</p>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
          <video ref={video} className={`h-full w-full object-cover ${cam ? "" : "hidden"}`} muted playsInline />
          {!cam && (img ? <img src={img} alt="shelf" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm text-slate-400">Camera off · mock mode uses bundled shelf detections</div>)}
          {busy && <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">Scanning…</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={zone} onChange={(e) => setZone(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
            <option value="all">All zones</option>{Object.entries(ZONE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-ghost" onClick={start}>Start camera</button>
          <label className="btn-ghost cursor-pointer">Upload photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setImg(r.result as string); r.readAsDataURL(f); }} /></label>
          <button className="btn" onClick={scan} disabled={busy}>Scan shelf</button>
        </div>
        <p className="text-xs text-slate-500">Vision mode: <b>{data?.settings.visionMode}</b> (set VISION_MODE=live + ANTHROPIC_API_KEY for Claude vision). Assumption: manual count ≈ {data?.settings.minutes.countPerSku} min per SKU.</p>
      </div>
      <div className="card space-y-3">
        {!res ? <div className="text-sm text-slate-500">Run a scan to see detections.</div> : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 p-2"><div className="text-2xl font-bold text-emerald-700">{res.scan.minutesSaved} min</div><div className="text-xs">counting saved</div></div>
              <div className="rounded-lg bg-slate-50 p-2"><div className="text-2xl font-bold">{res.scan.detections.length}</div><div className="text-xs">SKUs detected</div></div>
              <div className="rounded-lg bg-slate-50 p-2"><div className="text-2xl font-bold">{res.consumed}</div><div className="text-xs">items logged eaten</div></div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th>Item</th><th>Count</th><th>Δ vs expected</th><th>Confidence</th></tr></thead>
              <tbody>{res.scan.detections.map((d) => { const diff = res.scan.diffFromExpected.find((x) => x.productId === d.productId)!; const p = name(d.productId); return (
                <tr key={d.productId} className="border-t"><td className="py-1">{p?.emoji} {p?.name}</td><td>{d.count}</td><td className={diff.delta < 0 ? "text-amber-700" : ""}>{diff.delta}</td>
                  <td>{d.confidence < 0.7 ? <button className="chip bg-amber-100 text-amber-900">⚠ {Math.round(d.confidence * 100)}% · confirm</button> : `${Math.round(d.confidence * 100)}%`}</td></tr>); })}</tbody>
            </table>
            <div className="text-xs text-slate-500">Scan mode: {res.mode}. Negative deltas are written as camera consumption events (FIFO by expiry).</div>
          </>
        )}
      </div>
    </main>
  );
}
