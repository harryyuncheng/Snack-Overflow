"use client";
import { useState } from "react";

/** Natural-language input with optional browser speech-to-text. */
export default function AskBox({ placeholder, onSubmit, action = "Ask", busy }: { placeholder: string; onSubmit: (q: string) => void; action?: string; busy?: boolean }) {
  const [q, setQ] = useState("");
  const listen = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.lang = "en-US";
    r.onresult = (e) => { const t = e.results[0][0].transcript; setQ(t); onSubmit(t); };
    r.start();
  };
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSubmit(q); }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="input min-w-0 flex-1" />
      <button type="button" onClick={listen} className="btn-outline !px-2.5" title="Speak" aria-label="Speak">🎙</button>
      <button className="btn !px-4" disabled={busy}>{busy ? "…" : action}</button>
    </form>
  );
}
type SpeechRec = { lang: string; start(): void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void };
