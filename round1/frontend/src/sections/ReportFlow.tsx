/** Citizen / call-taker report flow: category tiles → quick questions → location → details → result. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Copy, Gauge, LayoutDashboard, MapPin, Plus, ShieldAlert, WifiOff,
} from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea, useToast } from "@/ui";
import { cn } from "@/lib/cn";
import { AREAS, areaByName } from "@/lib/geo";
import { mockCreate, type Category, type Hazard, type Incident, type Injuries, type ReportIn, type SeverityOut, type Vulnerable } from "@/lib/mock";
import { createIncident, previewSeverity } from "@/lib/resq";
import { STATIC } from "@/lib/static";
import { CATEGORIES, CATEGORY_META, ReasonsList, SeverityBadge, SEV_HEX, StatusBadge } from "./IncidentUI";
import { LazyMap } from "./LazyMap";

const STEPS = ["Type", "Questions", "Location", "Details"];

const empty: ReportIn = {
  title: "", description: "", category: "other", area: "", lat: null, lng: null, landmark: "",
  people_affected: 1, injured_count: 0, injuries: "none", life_threat: false, hazard: "small", active: true,
  vulnerable: [], contact_name: "", contact_phone: "",
};
const demo: ReportIn = {
  ...empty, category: "building_collapse", area: "Velachery", lat: 12.9815, lng: 80.218, landmark: "Near Velachery MRTS station",
  title: "Building collapse at Velachery", description: "Part of an old residential building collapsed after the rain. Two people are trapped inside.",
  people_affected: 6, injured_count: 2, injuries: "serious", life_threat: true, hazard: "large", vulnerable: ["elderly"],
};

export function ReportFlow({ admin = false }: { admin?: boolean }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<ReportIn>(STATIC ? demo : empty);
  const [picked, setPicked] = useState(!!STATIC);
  const [titleTouched, setTitleTouched] = useState(false);
  const [preview, setPreview] = useState<SeverityOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ inc: Incident; local: boolean } | null>(null);
  const [showErr, setShowErr] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const set = <K extends keyof ReportIn>(k: K, v: ReportIn[K]) => setF((x) => ({ ...x, [k]: v }));

  // auto-suggest title "{Category} at {Area}"
  useEffect(() => {
    if (titleTouched || !picked) return;
    const t = `${CATEGORY_META[f.category].short} at ${f.area || "…"}`;
    if (f.area) setF((x) => ({ ...x, title: t }));
  }, [f.category, f.area, titleTouched, picked]);

  // live severity preview (debounced)
  const started = picked || step > 0;
  useEffect(() => {
    if (!started) return;
    const id = setTimeout(() => {
      previewSeverity({ ...f, area: f.area || "Unknown", title: f.title || "Report", description: f.description || "…" }).then(setPreview);
    }, 250);
    return () => clearTimeout(id);
  }, [f, started]);

  const errs = useMemo(() => {
    const e: Record<string, string> = {};
    if (!f.area) e.area = "Choose an area or tap the map.";
    if (f.title.trim().length < 3) e.title = "Title needs at least 3 characters.";
    if (f.description.trim().length < 10) e.description = "Describe what is happening (at least 10 characters).";
    if (!Number.isFinite(f.people_affected) || f.people_affected < 0) e.people = "Enter how many people are affected.";
    if (f.contact_phone && !/^[+\d][\d\s-]{6,15}$/.test(f.contact_phone)) e.phone = "Phone looks invalid.";
    return e;
  }, [f]);

  const go = (n: number) => { setShowErr(false); setStep(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  function next() {
    if (step === 2 && errs.area) { setShowErr(true); return; }
    go(step + 1);
  }

  async function submit() {
    if (Object.keys(errs).length) { setShowErr(true); toast("warning", "Please complete the form", Object.values(errs)[0]); return; }
    setBusy(true);
    try {
      const inc = await createIncident(f);
      setDone({ inc, local: false }); window.scrollTo({ top: 0 });
      toast(inc.severity === "Critical" ? "warning" : "success", `Report ${inc.id} received`, `Severity ${inc.severity} (${inc.score}/100)`);
    } catch {
      const inc = mockCreate(f);
      setDone({ inc, local: true }); window.scrollTo({ top: 0 });
      toast("warning", "Server not reachable", "Saved locally (demo). Please also call 112.");
    } finally { setBusy(false); }
  }

  function reset() { setF(empty); setPicked(false); setTitleTouched(false); setPreview(null); setDone(null); setStep(0); }

  if (done) return <Result inc={done.inc} local={done.local} admin={admin} onNew={reset} />;

  return (
    <div ref={top} className="grid scroll-mt-24 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {/* progress */}
        <div className="mb-5 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => (i <= step || picked) && go(i)} className="group flex-1 text-left">
              <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-brand-500" : "bg-line")} />
              <p className={cn("mt-1.5 text-xs", i === step ? "font-semibold text-fg" : "text-muted")}>{i + 1}. {s}</p>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={STATIC ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <section>
                <h2 className="text-2xl font-semibold">What is the emergency?</h2>
                <p className="mt-1 text-sm text-muted">Tap the picture that fits best.</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CATEGORIES.map((c) => {
                    const m = CATEGORY_META[c]; const on = picked && f.category === c;
                    return (
                      <button key={c} onClick={() => { set("category", c); setPicked(true); if (!STATIC) setTimeout(() => go(1), 180); }}
                        className={cn("group relative flex aspect-[4/3.4] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-3.5 text-left text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg",
                          m.tile, on ? "ring-4 ring-brand-400 ring-offset-2 ring-offset-bg" : "")}>
                        <m.icon className="absolute -right-3 -bottom-3 size-24 opacity-20 transition group-hover:scale-110" strokeWidth={1.5} />
                        <span className="grid size-11 place-items-center rounded-xl bg-white/20 backdrop-blur"><m.icon className="size-6" /></span>
                        <span className="relative text-sm font-semibold leading-tight sm:text-base">{m.label}</span>
                        {on && <CheckCircle2 className="absolute top-3 right-3 size-5" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="space-y-5">
                <Head icon={CATEGORY_META[f.category].icon} title="Quick questions" text="Answer what you can see. It sets the priority." />
                <Question label="Is anyone unconscious, not breathing or trapped?">
                  <Choice danger value={f.life_threat} options={[[true, "Yes"], [false, "No"]]} onChange={(v) => set("life_threat", v)} />
                </Question>
                <Question label="Injuries">
                  <Choice value={f.injuries} options={[["none", "None"], ["minor", "Minor"], ["serious", "Serious"]] as [Injuries, string][]} onChange={(v) => set("injuries", v)} />
                </Question>
                <Question label="How big is the danger?">
                  <Choice value={f.hazard} options={[["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["spreading", "Spreading"]] as [Hazard, string][]} onChange={(v) => set("hazard", v)} />
                </Question>
                <Question label="Is it still happening?">
                  <Choice value={f.active} options={[[true, "Yes, still active"], [false, "No, it's over"]]} onChange={(v) => set("active", v)} />
                </Question>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <Head icon={MapPin} title="Where is it?" text="Tap the map, or pick the area from the list." />
                <LazyMap height={300} picked={f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null}
                  onPick={(p) => setF((x) => ({ ...x, lat: p.lat, lng: p.lng, area: p.area }))} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Area *" hint={showErr && errs.area ? errs.area : f.lat != null ? `Pin: ${f.lat?.toFixed(4)}, ${f.lng?.toFixed(4)}` : undefined}>
                    <Select value={f.area} className={cn(showErr && errs.area && "border-red-400")}
                      onChange={(e) => { const a = areaByName(e.target.value); setF((x) => ({ ...x, area: e.target.value, lat: a?.lat ?? x.lat, lng: a?.lng ?? x.lng })); }}
                      options={[{ value: "", label: "Select area…" }, ...AREAS.map((a) => ({ value: a.name, label: a.name }))]} />
                  </Field>
                  <Field label="Landmark (optional)">
                    <Input value={f.landmark} placeholder="e.g. near bus stand" onChange={(e) => set("landmark", e.target.value)} />
                  </Field>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <Head icon={ClipboardList} title="A few details" text="Required fields are marked *." />
                <Field label="Incident title *" hint={showErr ? errs.title : "Suggested automatically, you can edit it."}>
                  <Input value={f.title} maxLength={120} onChange={(e) => { setTitleTouched(true); set("title", e.target.value); }} />
                </Field>
                <Field label="What is happening? *" hint={showErr && errs.description ? errs.description : `${f.description.trim().length}/2000`}>
                  <Textarea value={f.description} maxLength={2000} className={cn(showErr && errs.description && "border-red-400")}
                    placeholder="e.g. Smoke coming from the 2nd floor, people shouting for help" onChange={(e) => set("description", e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="People affected *" hint={showErr ? errs.people : undefined}>
                    <Input type="number" min={0} max={100000} value={Number.isFinite(f.people_affected) ? f.people_affected : ""} onChange={(e) => set("people_affected", e.target.value === "" ? NaN : Math.max(0, Number(e.target.value)))} />
                  </Field>
                  <Field label="Injured (count)">
                    <Input type="number" min={0} max={100000} value={f.injured_count} onChange={(e) => set("injured_count", Math.max(0, Number(e.target.value) || 0))} />
                  </Field>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Vulnerable people present?</p>
                  <div className="flex flex-wrap gap-2">
                    {(["children", "elderly", "patients", "disabled", "pregnant"] as Vulnerable[]).map((v) => {
                      const on = f.vulnerable.includes(v);
                      return (
                        <button key={v} type="button" onClick={() => set("vulnerable", on ? f.vulnerable.filter((x) => x !== v) : [...f.vulnerable, v])}
                          className={cn("rounded-full px-3.5 py-1.5 text-sm capitalize ring-1 transition", on ? "bg-brand-600 text-white ring-brand-600" : "bg-surface ring-line hover:bg-surface-2")}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name (optional)"><Input value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} placeholder="e.g. Priya R." /></Field>
                  <Field label="Phone (optional)" hint={showErr ? errs.phone : undefined}><Input value={f.contact_phone} inputMode="tel" onChange={(e) => set("contact_phone", e.target.value)} placeholder="+91 98xxx xxxxx" /></Field>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {/* nav buttons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? <Button variant="outline" icon={ArrowLeft} onClick={() => go(step - 1)}>Back</Button> : <span />}
          {step < 3 ? (
            <Button iconRight={ArrowRight} disabled={step === 0 && !picked} onClick={next}>Next</Button>
          ) : (
            <Button size="lg" icon={ShieldAlert} loading={busy} onClick={submit}>Send report</Button>
          )}
        </div>
      </div>

      {/* live severity preview */}
      <aside className="pb-16 lg:sticky lg:top-24 lg:self-start lg:pb-0">
        <PreviewCard preview={started ? preview : null} />
      </aside>

      {/* phone: always-visible severity strip */}
      {started && preview && (
        <div className="glass fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line px-4 py-2.5 lg:hidden">
          <SeverityBadge severity={preview.severity} score={preview.score} />
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{[...preview.reasons].sort((a, b) => (b.rule ? 100 : b.points) - (a.rule ? 100 : a.points))[0]?.label}</span>
        </div>
      )}
    </div>
  );
}

function PreviewCard({ preview }: { preview: SeverityOut | null }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Gauge className="size-4 text-brand-600" />Live severity</p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">rules engine</span>
      </div>
      {preview ? (
        <div className="p-5">
          <div className="flex items-center gap-4">
            <ScoreRing score={preview.score} color={SEV_HEX[preview.severity]} />
            <div>
              <SeverityBadge severity={preview.severity} size="lg" />
              <p className="mt-1.5 text-xs text-muted">Score {preview.score}/100 · updates as you answer</p>
            </div>
          </div>
          <div className="mt-4 max-h-56 overflow-auto lg:max-h-none"><ReasonsList reasons={preview.reasons} compact /></div>
        </div>
      ) : (
        <p className="p-5 text-sm text-muted">Pick a category to see how urgent this is — and why.</p>
      )}
    </Card>
  );
}

export function ScoreRing({ score, color, size = 64 }: { score: number; color: string; size?: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="-rotate-90" width={size} height={size}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (Math.min(100, score) / 100) * c} style={{ transition: "stroke-dashoffset .5s ease, stroke .3s" }} />
      </svg>
      <span className="absolute font-display font-semibold tabular-nums" style={{ fontSize: Math.round(size * 0.3) }}>{score}</span>
    </div>
  );
}

function Head({ icon: Icon, title, text }: { icon: typeof MapPin; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><Icon className="size-5" /></span>
      <div><h2 className="text-2xl font-semibold leading-tight">{title}</h2><p className="text-sm text-muted">{text}</p></div>
    </div>
  );
}

function Question({ label, children }: { label: string; children: ReactNode }) {
  return <Card className="p-4"><p className="mb-3 text-sm font-medium">{label}</p>{children}</Card>;
}

function Choice<T extends string | boolean>({ value, options, onChange, danger }: { value: T; options: [T, string][]; onChange: (v: T) => void; danger?: boolean }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => {
        const on = v === value; const red = danger && v === true && on;
        return (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            className={cn("min-h-11 rounded-xl px-2 text-sm font-medium ring-1 transition",
              red ? "bg-red-600 text-white ring-red-600" : on ? "bg-brand-600 text-white ring-brand-600" : "bg-surface-2 ring-line hover:bg-surface")}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Result({ inc, local, admin, onNew }: { inc: Incident; local: boolean; admin: boolean; onNew: () => void }) {
  const toast = useToast();
  return (
    <motion.div initial={STATIC ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
      <Card className="overflow-hidden">
        <div className={cn("p-6 text-center text-white", inc.severity === "Critical" ? "bg-gradient-to-br from-red-600 to-red-800" : "bg-gradient-to-br from-brand-600 to-brand-800")}>
          <motion.div initial={STATIC ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="mx-auto grid size-16 place-items-center rounded-full bg-white/20"><CheckCircle2 className="size-9" /></motion.div>
          <h2 className="mt-3 text-2xl font-semibold">Report received</h2>
          <p className="mt-1 text-white/80">Help is being prioritised. Keep your phone nearby.</p>
          <button onClick={() => { navigator.clipboard?.writeText(inc.id); toast("info", "Reference copied", inc.id); }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 font-mono text-lg font-semibold">
            {inc.id}<Copy className="size-4 opacity-70" />
          </button>
        </div>
        {local && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <WifiOff className="size-4 shrink-0" /> Saved locally (demo) — the server was not reachable. Please also call 112.
          </div>
        )}
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <ScoreRing score={inc.score} color={SEV_HEX[inc.severity]} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{inc.title}</p>
              <div className="mt-1 flex flex-wrap gap-2"><SeverityBadge severity={inc.severity} /><StatusBadge status={inc.status} /></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Why this priority</p>
            <ReasonsList reasons={inc.reasons} compact />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button icon={Plus} variant="outline" onClick={onNew}>New report</Button>
            {admin || !local ? (
              <Link to={local ? "/app" : `/app/incidents/${inc.id}`}><Button icon={LayoutDashboard}>{admin ? "Open incident" : "Track in control room"}</Button></Link>
            ) : null}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export type { Category };
