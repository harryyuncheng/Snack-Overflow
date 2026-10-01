"use client";
import { useEffect, useRef, useState } from "react";

/** Natural-language input with optional browser speech-to-text. */
export default function AskBox({ placeholder, onSubmit, busy }: { placeholder: string; onSubmit: (q: string) => void; busy?: boolean }) {
  const [q, setQ] = useState("");
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const SR = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    return W.SpeechRecognition ?? W.webkitSpeechRecognition;
  };
  useEffect(() => { setCanListen(!!SR()); return () => rec.current?.abort(); }, []);

  const toggleListen = () => {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = SR();
    if (!Ctor) return;
    const r = new Ctor(); r.lang = "en-US"; r.interimResults = true;
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      setQ(res[0].transcript);
      if (res.isFinal) onSubmit(res[0].transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSubmit(q); }}
      className="flex h-[42px] items-center gap-1 rounded-xl border border-hairline bg-paper/95 pl-3 pr-1 transition-colors focus-within:border-ink">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ash" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? "Listening…" : placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-[13px] text-ink outline-none placeholder:text-ash" />
      {canListen && (
        <button type="button" onClick={toggleListen} aria-label={listening ? "Stop listening" : "Search by voice"} aria-pressed={listening} title={listening ? "Stop" : "Search by voice"}
          className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${listening ? "bg-ink text-paper" : "text-ash hover:bg-bone hover:text-ink"}`}>
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-ink/30" />}
          <svg viewBox="0 0 24 24" className="relative h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      )}
      <button disabled={busy || !q.trim()} aria-label="Ask" title="Ask"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-highlight text-ink transition hover:brightness-95 disabled:bg-bone disabled:text-ash">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </form>
  );
}
type SpeechRec = {
  lang: string; interimResults: boolean; start(): void; stop(): void; abort(): void;
  onresult: (e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onend: () => void; onerror: () => void;
};
