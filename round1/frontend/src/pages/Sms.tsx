/** /sms — SMS fallback: report an emergency with a plain text message to 112-RESQ (no data network needed). */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight, BatteryMedium, ChevronLeft, MessageSquareText, Phone, Radar, ScanText, Send, Signal, Smartphone, WifiOff,
} from "lucide-react";
import { useToast } from "@/ui";
import { CitizenShell } from "@/sections/CitizenShell";
import { CATEGORY_META } from "@/sections/IncidentUI";
import { cn } from "@/lib/cn";
import { STATIC } from "@/lib/static";
import { usePoll } from "@/lib/usePoll";
import { getSmsLog, mockSms, sendSms, type ParseOut, type SmsLog } from "@/lib/innovation";

const NAVY = "text-[#0f1f3d] dark:text-white";
const SAMPLES = [
  "FIRE TNAGAR 5 TRAPPED",
  "FLOOD VELACHERY 4 CHILDREN STUCK",
  "ACCIDENT GST ROAD CHROMEPET 10 INJURED",
  "வேளச்சேரியில் வெள்ளம், குழந்தைகள் சிக்கி இருக்காங்க",
];
const SENDER = "+91 98400 12345";

interface Msg { id: number; me: boolean; text: string; at: Date; incident?: string | null; pending?: boolean }

export default function Sms() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [parsed, setParsed] = useState<ParseOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, reloadLog] = usePoll<SmsLog[]>(getSmsLog, 8000);
  const scroller = useRef<HTMLDivElement>(null);
  const seq = useRef(1);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: STATIC ? "auto" : "smooth" }); }, [msgs]);
  // screenshot mode: show a finished exchange
  useEffect(() => { if (STATIC) send(SAMPLES[1]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function send(t = text) {
    const body = t.trim();
    if (body.length < 2 || busy) return;
    setText(""); setBusy(true);
    const mine: Msg = { id: seq.current++, me: true, text: body, at: new Date() };
    const typing: Msg = { id: seq.current++, me: false, text: "", at: new Date(), pending: true };
    setMsgs((m) => [...m, mine, typing]);
    const r = STATIC ? mockSms(body) : await sendSms(SENDER, body); // screenshot mode: no side effects
    setMsgs((m) => m.map((x) => (x.id === typing.id ? { ...x, text: r.reply, pending: false, incident: r.incident?.id ?? null, at: new Date() } : x)));
    setParsed(r.parsed);
    setBusy(false);
    reloadLog();
    if (r.ok && r.incident) toast("success", `SMS → incident ${r.incident.id}`, "Created from a plain text message. No internet needed.");
    else toast("warning", "Area not recognised", "The reply SMS tells the citizen the format to use.");
  }

  return (
    <CitizenShell>
      <main className="mx-auto max-w-7xl px-4 pt-5 pb-10 sm:pt-8 md:px-6">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#1e63d6] ring-1 ring-blue-100 dark:bg-blue-950/50 dark:ring-blue-900">
            <WifiOff className="size-3.5" />SMS fallback · works without internet
          </span>
          <h1 className={cn("mt-3 font-display text-[28px] font-bold leading-tight tracking-tight sm:text-4xl", NAVY)}>
            No data? No smartphone? <span className="text-[#e53935]">Just text 112-RESQ.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-[15px]">
            In floods the mobile data network is the first thing to fail. A plain SMS still gets through — ResQNet reads it,
            creates a prioritised incident and texts back a tracking ID.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-8">
          {/* ---------- phone ---------- */}
          <div className="min-w-0">
            <div className="mx-auto w-full max-w-[360px] rounded-[2.4rem] bg-[#0f172a] p-2.5 shadow-[0_30px_60px_-20px_rgba(15,31,61,.45)] ring-1 ring-slate-700">
              <div className="overflow-hidden rounded-[1.9rem] bg-[#eef1f6] dark:bg-slate-900">
                {/* status bar */}
                <div className="relative flex items-center justify-between bg-white px-5 pt-2.5 pb-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <span>9:41</span>
                  <span className="absolute top-1.5 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-[#0f172a]" />
                  <span className="flex items-center gap-1"><Signal className="size-3" />2G<WifiOff className="size-3 text-red-500" /><BatteryMedium className="size-3.5" /></span>
                </div>
                {/* chat header */}
                <div className="flex items-center gap-2.5 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                  <ChevronLeft className="size-5 text-[#1e63d6]" />
                  <span className="grid size-9 place-items-center rounded-full bg-[#e53935] text-xs font-bold text-white">112</span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className={cn("text-sm font-semibold", NAVY)}>112-RESQ</p>
                    <p className="text-[11px] text-slate-500">ResQNet SMS gateway · Text message</p>
                  </div>
                  <Phone className="size-4 text-[#1e63d6]" />
                </div>
                {/* messages */}
                <div ref={scroller} className="h-[380px] space-y-2 overflow-y-auto px-3 py-3">
                  <p className="text-center text-[10px] font-medium text-slate-400">Today · SMS / Text message</p>
                  {msgs.length === 0 && (
                    <div className="mx-auto mt-6 max-w-[250px] rounded-2xl bg-white/80 p-3 text-center text-xs text-slate-500 dark:bg-slate-800/70">
                      Type an emergency below, or tap a sample. Format:<br />
                      <b className="font-mono text-[#0f1f3d] dark:text-white">KEYWORD AREA COUNT DETAILS</b>
                    </div>
                  )}
                  {msgs.map((m) => (
                    <motion.div key={m.id} initial={STATIC ? false : { opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn("flex", m.me ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm",
                        m.me ? "rounded-br-md bg-[#1e63d6] text-white" : "rounded-bl-md bg-white text-[#0f1f3d] dark:bg-slate-800 dark:text-slate-100")}>
                        {m.pending ? (
                          <span className="flex gap-1 py-1">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
                        ) : (<>
                          <p className="break-words whitespace-pre-wrap">{m.text}</p>
                          {m.incident && (
                            <Link to={`/track/${m.incident}`} className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-[#e53935] hover:bg-red-100 dark:bg-red-950/50">
                              <Radar className="size-3.5" />Track {m.incident}<ArrowRight className="size-3" />
                            </Link>
                          )}
                          <p className={cn("mt-0.5 text-right text-[10px]", m.me ? "text-white/70" : "text-slate-400")}>
                            {m.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{m.me ? " · Delivered" : ""}
                          </p>
                        </>)}
                      </div>
                    </motion.div>
                  ))}
                </div>
                {/* samples */}
                <div className="flex gap-1.5 overflow-x-auto border-t border-slate-200 bg-white/70 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                  {SAMPLES.map((s) => (
                    <button key={s} type="button" disabled={busy} onClick={() => send(s)}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-[#0f1f3d] transition hover:border-[#1e63d6] hover:text-[#1e63d6] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {s}
                    </button>
                  ))}
                </div>
                {/* composer */}
                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 bg-white px-2.5 pt-1.5 pb-4 dark:bg-slate-950">
                  <input value={text} onChange={(e) => setText(e.target.value)} maxLength={480} placeholder="Text message" aria-label="SMS text"
                    className="h-10 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-[#0f1f3d] outline-none placeholder:text-slate-400 focus:border-[#1e63d6] dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  <button type="submit" disabled={busy || text.trim().length < 2} aria-label="Send SMS"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1e63d6] text-white transition hover:bg-[#1853b5] disabled:opacity-40">
                    <Send className="size-4" />
                  </button>
                </form>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">Simulated phone · messages go to the real ResQNet SMS gateway API</p>
          </div>

          {/* ---------- explanation + parsed + log ---------- */}
          <div className="min-w-0 space-y-5">
            <ParsedCard parsed={parsed} />

            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className={cn("flex items-center gap-2 text-lg font-semibold", NAVY)}><MessageSquareText className="size-5 text-[#1e63d6]" />How it works</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: WifiOff, t: "No data network needed", d: "SMS runs on the voice network — it works when 4G and Wi-Fi are down." },
                  { icon: Smartphone, t: "Works on ₹1,000 feature phones", d: "No app, no login, no smartphone. Any phone that can text." },
                  { icon: ScanText, t: "Understands loose text", d: "English, Tamil script and Tanglish. Area names, counts and danger words are extracted." },
                ].map((x) => (
                  <div key={x.t} className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                    <x.icon className="size-5 text-[#e53935]" />
                    <p className={cn("mt-2 text-sm font-semibold", NAVY)}>{x.t}</p>
                    <p className="mt-1 text-xs text-slate-500">{x.d}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3.5 dark:border-slate-700">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Format</p>
                <p className="mt-1 flex flex-wrap gap-1.5 font-mono text-sm">
                  {[["KEYWORD", "bg-red-50 text-[#e53935]"], ["AREA", "bg-blue-50 text-[#1e63d6]"], ["COUNT", "bg-amber-50 text-amber-700"], ["DETAILS", "bg-slate-100 text-slate-700"]].map(([k, c]) => (
                    <span key={k} className={cn("rounded-md px-2 py-0.5 font-semibold", c)}>{k}</span>
                  ))}
                </p>
                <p className="mt-2 text-xs text-slate-500">e.g. <b className="font-mono text-[#0f1f3d] dark:text-white">FIRE TNAGAR 5 TRAPPED</b> → Fire · T. Nagar · 5 people · life threat → incident + reply SMS with tracking ID.</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
                <h2 className={cn("text-base font-semibold", NAVY)}>Recent SMS received</h2>
                <span className="text-xs text-slate-500">{log ? `${log.length} message${log.length === 1 ? "" : "s"}` : "loading…"}</span>
              </div>
              {log && log.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No SMS yet — send one from the phone.</p>}
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {(log ?? []).slice().reverse().slice(0, 12).map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-[#1e63d6] dark:bg-blue-950/50"><MessageSquareText className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-mono text-[13px] break-words", NAVY)}>{s.text}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{maskPhone(s.sender)} · {fmtTime(s.at)}</p>
                    </div>
                    {s.incident_id ? (
                      <Link to={`/track/${s.incident_id}`} className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700 hover:underline dark:bg-emerald-950/50 dark:text-emerald-300">{s.incident_id}</Link>
                    ) : <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">needs area</span>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </CitizenShell>
  );
}

function ParsedCard({ parsed }: { parsed: ParseOut | null }) {
  const f = parsed?.fields;
  const conf = Math.round((parsed?.confidence ?? 0) * 100);
  const meta = f ? CATEGORY_META[f.category] : null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-16px_rgba(15,31,61,.18)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={cn("flex items-center gap-2 text-lg font-semibold", NAVY)}><ScanText className="size-5 text-[#e53935]" />What ResQNet understood</h2>
        {parsed && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Confidence {conf}%</span>}
      </div>
      {!f ? (
        <p className="mt-3 text-sm text-slate-500">Send an SMS — the extracted fields appear here.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <Field k="Category" v={<span className="inline-flex items-center gap-1.5">{meta && <meta.icon className="size-4 text-[#e53935]" />}{meta?.short ?? f.category}</span>} />
            <Field k="Area" v={f.area ?? <span className="text-amber-600">not found</span>} />
            <Field k="People" v={String(f.people_affected)} />
            <Field k="Life threat" v={f.life_threat ? <span className="text-[#e53935]">YES</span> : "No"} />
            <Field k="Vulnerable" v={f.vulnerable.length ? f.vulnerable.join(", ") : "—"} className="col-span-2 sm:col-span-1" />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-700" style={{ width: `${conf}%` }} />
          </div>
        </>
      )}
    </section>
  );
}

function Field({ k, v, className }: { k: string; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{k}</p>
      <p className={cn("mt-0.5 truncate text-sm font-semibold capitalize", NAVY)}>{v}</p>
    </div>
  );
}

const maskPhone = (p: string) => (p && p.length > 5 ? `${p.slice(0, -5).replace(/\d/g, "•")}${p.slice(-5)}` : p || "unknown");
function fmtTime(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
