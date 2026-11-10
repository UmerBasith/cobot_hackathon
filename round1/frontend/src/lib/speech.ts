/** Browser speech-to-text (Web Speech API). Chrome/Edge/Android support en-IN and ta-IN. */
import { useCallback, useEffect, useRef, useState } from "react";

type SR = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;

export function speechSupported() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** listen(lang) → live `interim` text, `onFinal(text)` called once with the full transcript. */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const finalText = useRef("");
  const cb = useRef(onFinal);
  cb.current = onFinal;

  const stop = useCallback(() => { rec.current?.stop(); }, []);
  const listen = useCallback((lang: string) => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setError("unsupported"); return; }
    try { rec.current?.abort(); } catch { /* ignore */ }
    const r = new Ctor();
    r.lang = lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    finalText.current = ""; setInterim(""); setError(null);
    r.onresult = (e) => {
      let fin = "", tmp = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else tmp += res[0].transcript;
      }
      finalText.current = fin;
      setInterim((fin + " " + tmp).trim());
    };
    r.onerror = (e) => { setError(e.error || "error"); };
    r.onend = () => {
      setListening(false);
      const t = finalText.current.trim();
      if (t) cb.current(t);
    };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError("start-failed"); setListening(false); }
  }, []);
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* ignore */ } }, []);
  return { listening, interim, error, listen, stop };
}
