"use client";
import { useState } from "react";

/** Natural-language input with optional browser speech-to-text. */
export default function AskBox({ placeholder, onSubmit, action = "Search", busy }: { placeholder: string; onSubmit: (q: string) => void; action?: string; busy?: boolean }) {
  const [q, setQ] = useState("");
  const listen = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) return alert("Speech recognition not supported in this browser");
    const r = new SR(); r.lang = "en-US";
    r.onresult = (e) => { const t = e.results[0][0].transcript; setQ(t); onSubmit(t); };
    r.start();
  };
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSubmit(q); }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400" />
      <button type="button" onClick={listen} className="btn-ghost" title="Speak">🎙️</button>
      <button className="btn" disabled={busy}>{busy ? "…" : action}</button>
    </form>
  );
}
type SpeechRec = { lang: string; start(): void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void };
