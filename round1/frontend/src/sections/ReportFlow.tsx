/** Citizen / call-taker report flow — light "Report an Emergency" design.
 *  Desktop: left rail (title, vertical stepper, live severity, Call 112) + one-page two-column form card.
 *  Mobile (<768px): real 4-step wizard (Details → Location → Info → Confirm). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Gauge, HeartPulse, ImagePlus, LayoutDashboard, MapPin, Minus,
  Keyboard, Mic, Pencil, Phone, Plus, Radar, Send, Sparkles, Square, UserX, WifiOff, X,
} from "lucide-react";
import { useToast } from "@/ui";
import { cn } from "@/lib/cn";
import { AREAS, areaByName } from "@/lib/geo";
import {
  mockCreate, type Category, type Hazard, type Incident, type Injuries, type ReportIn, type Severity, type SeverityOut, type Vulnerable,
} from "@/lib/mock";
import { createIncident, previewSeverity } from "@/lib/resq";
import { STATIC } from "@/lib/static";
import { parseText, type ParseOut } from "@/lib/innovation";
import { speechSupported, useSpeech } from "@/lib/speech";
import { CATEGORY_META, ReasonsList, SeverityBadge, SEV_HEX, StatusBadge } from "./IncidentUI";
import { LazyMap } from "./LazyMap";

const RED = "#e53935";
const NAVY = "text-[#0f1f3d]";

const STEPS = [
  { short: "Details", title: "Incident Details", sub: "Type, severity and description" },
  { short: "Location", title: "Location", sub: "Pin your location" },
  { short: "Info", title: "Additional Info", sub: "Evidence and preferences" },
  { short: "Confirm", title: "Confirm & Report", sub: "Review and submit" },
];

const TILES: { c: Category; label: string; tint: string }[] = [
  { c: "fire", label: "Fire", tint: "bg-orange-50 text-orange-600" },
  { c: "medical", label: "Medical", tint: "bg-rose-50 text-rose-600" },
  { c: "road_accident", label: "Accident", tint: "bg-slate-100 text-slate-700" },
  { c: "flood", label: "Flood / Waterlogging", tint: "bg-sky-50 text-sky-600" },
  { c: "landslide", label: "Landslide", tint: "bg-amber-50 text-amber-800" },
  { c: "electrical", label: "Power Outage", tint: "bg-yellow-50 text-yellow-600" },
  { c: "building_collapse", label: "Structural Collapse", tint: "bg-stone-100 text-stone-700" },
  { c: "gas_leak", label: "Gas Leak", tint: "bg-lime-50 text-lime-700" },
  { c: "other", label: "Other", tint: "bg-violet-50 text-violet-600" },
];

const SEV_CHIPS: { s: Severity; sub: string; dot: string; on: string }[] = [
  { s: "Low", sub: "Minor", dot: "bg-emerald-500", on: "border-emerald-500 bg-emerald-50" },
  { s: "Medium", sub: "Needs attention", dot: "bg-yellow-400", on: "border-yellow-500 bg-yellow-50" },
  { s: "High", sub: "Urgent", dot: "bg-orange-500", on: "border-orange-500 bg-orange-50" },
  { s: "Critical", sub: "Life threatening", dot: "bg-red-600", on: "border-red-600 bg-red-50" },
];

const VULN: { v: Vulnerable; label: string }[] = [
  { v: "children", label: "Children" }, { v: "elderly", label: "Elderly" }, { v: "disabled", label: "Disabled" },
  { v: "patients", label: "Others (patients)" }, { v: "pregnant", label: "Pregnant" },
];

const DESC_MAX = 250;

const empty: ReportIn = {
  title: "", description: "", category: "other", area: "", lat: null, lng: null, landmark: "",
  people_affected: 1, injured_count: 0, injuries: "none", life_threat: false, hazard: "small", active: true,
  vulnerable: [], contact_name: "", contact_phone: "", reported_severity: null, anonymous: false, photo: null,
};
const demo: ReportIn = {
  ...empty, category: "building_collapse", area: "Velachery", lat: 12.9815, lng: 80.218, landmark: "Near Velachery MRTS station",
  title: "Structural collapse at Velachery", description: "Part of an old residential building collapsed after the rain. Two people are trapped inside.",
  people_affected: 6, injured_count: 2, injuries: "serious", life_threat: true, hazard: "large", vulnerable: ["elderly", "children"],
  reported_severity: "Critical",
};

function useIsMobile() {
  const q = "(max-width: 767px)";
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q); const on = () => setM(mq.matches);
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

/** Read an image file, downscale to max 1024px, return a JPEG data URL. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(new Error("read failed"));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("not an image"));
      img.onload = () => {
        const k = Math.min(1, 1024 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d")?.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/jpeg", 0.7));
      };
      img.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  });
}

export function ReportFlow({ admin = false }: { admin?: boolean }) {
  const toast = useToast();
  const isMobile = useIsMobile();
  const [params] = useSearchParams();
  const qCat = params.get("category") as Category | null;
  const initCat = qCat && qCat in CATEGORY_META ? qCat : null;
  // "Report from here" on the citizen home passes the live GPS position: /report?lat=..&lng=..&area=..
  const qLat = parseFloat(params.get("lat") ?? ""), qLng = parseFloat(params.get("lng") ?? "");
  const qArea = params.get("area");
  const base: ReportIn = Number.isFinite(qLat) && Number.isFinite(qLng)
    ? { ...empty, lat: +qLat.toFixed(5), lng: +qLng.toFixed(5), area: qArea ?? empty.area }
    : empty;

  const [f, setF] = useState<ReportIn>(STATIC ? demo : initCat ? { ...base, category: initCat } : base);
  const [picked, setPicked] = useState(!!STATIC || !!initCat);
  const [extras, setExtras] = useState(!!STATIC);
  const [titleTouched, setTitleTouched] = useState(false);
  const [mStep, setMStep] = useState(0);
  const [preview, setPreview] = useState<SeverityOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ inc: Incident; local: boolean } | null>(null);
  const [showErr, setShowErr] = useState(false);
  const [editLL, setEditLL] = useState(false);
  const [voice, setVoice] = useState<{ conf: number; text: string; how: "voice" | "typed" } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ReportIn>(k: K, v: ReportIn[K]) => setF((x) => ({ ...x, [k]: v }));
  const setX = <K extends keyof ReportIn>(k: K, v: ReportIn[K]) => { setExtras(true); set(k, v); };

  // auto title "{Category} at {Area}"
  useEffect(() => {
    if (titleTouched || !picked || !f.area) return;
    const label = TILES.find((t) => t.c === f.category)?.label ?? CATEGORY_META[f.category].short;
    setF((x) => ({ ...x, title: `${label} at ${f.area}` }));
  }, [f.category, f.area, titleTouched, picked]);

  // live severity preview (debounced)
  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => {
      previewSeverity({ ...f, photo: null, area: f.area || "Unknown", title: f.title || "Report", description: f.description || "…" }).then(setPreview);
    }, 250);
    return () => clearTimeout(id);
  }, [f, picked]);

  const errs = useMemo(() => {
    const e: Record<string, string> = {};
    if (!picked) e.category = "Choose what the emergency is.";
    if (f.description.trim().length < 10) e.description = "Describe what is happening (at least 10 characters).";
    if (!f.area) e.area = "Choose an area or tap the map.";
    if (!Number.isFinite(f.people_affected) || f.people_affected < 0) e.people = "Enter how many people are affected.";
    if (!f.anonymous && f.contact_phone && !/^[+\d][\d\s-]{6,15}$/.test(f.contact_phone)) e.phone = "Phone looks invalid.";
    return e;
  }, [f, picked]);

  // desktop rail progress
  const d1 = picked && !errs.description, d2 = !errs.area;
  const cur = !d1 ? 0 : !d2 ? 1 : !extras ? 2 : 3;
  const active = isMobile ? mStep : cur;

  const go = (n: number) => { setShowErr(false); setMStep(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  function next() {
    if (mStep === 0 && (errs.category || errs.description)) { setShowErr(true); toast("warning", "Almost there", errs.category ?? errs.description); return; }
    if (mStep === 1 && errs.area) { setShowErr(true); toast("warning", "Location needed", errs.area); return; }
    if (mStep === 2 && errs.phone) { setShowErr(true); return; }
    if (mStep === 2) setExtras(true);
    go(mStep + 1);
  }

  /** Speak-to-Report: fill the whole form from one sentence (voice or typed). */
  function applyParse(p: ParseOut, text: string, how: "voice" | "typed") {
    const x = p.fields;
    const a = x.area ? areaByName(x.area) : undefined;
    setF((cur) => ({
      ...cur, category: x.category, people_affected: Math.max(1, x.people_affected || 1), life_threat: x.life_threat,
      injuries: x.injuries, injured_count: x.injured_count, hazard: x.hazard, active: x.active, vulnerable: x.vulnerable,
      description: text.slice(0, DESC_MAX),
      ...(a ? { area: a.name, lat: a.lat, lng: a.lng } : {}),
      reported_severity: x.life_threat ? "Critical" : cur.reported_severity,
    }));
    setPicked(true); setExtras(true); setTitleTouched(false); setShowErr(false);
    setVoice({ conf: p.confidence, text, how });
    toast("success", how === "voice" ? "Filled from your voice" : "Filled from your text",
      `${CATEGORY_META[x.category]?.short ?? x.category}${a ? ` · ${a.name}` : " · pick your area"} · ${Math.round(p.confidence * 100)}% confident`);
  }

  async function submit() {
    if (Object.keys(errs).length) {
      setShowErr(true); toast("warning", "Please complete the form", Object.values(errs)[0]);
      if (isMobile) go(errs.category || errs.description ? 0 : errs.area ? 1 : 2);
      return;
    }
    const label = TILES.find((t) => t.c === f.category)?.label ?? "Emergency";
    const body: ReportIn = {
      ...f, title: f.title.trim().length >= 3 ? f.title.trim() : `${label} at ${f.area}`,
      contact_name: f.anonymous ? "" : f.contact_name, contact_phone: f.anonymous ? "" : f.contact_phone,
    };
    if (voice) (body as ReportIn & { source?: string }).source = "voice";
    setBusy(true);
    try {
      const inc = await createIncident(body);
      setDone({ inc, local: false }); window.scrollTo({ top: 0 });
      toast(inc.severity === "Critical" ? "warning" : "success", `Report ${inc.id} received`, `Severity ${inc.severity} (${inc.score}/100)`);
    } catch {
      const inc = mockCreate(body);
      setDone({ inc, local: true }); window.scrollTo({ top: 0 });
      toast("warning", "Server not reachable", "Saved locally (demo). Please also call 112.");
    } finally { setBusy(false); }
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast("warning", "Images only", "PNG or JPG please."); return; }
    if (file.size > 8 * 1024 * 1024) { toast("warning", "File too large", "Max 2 MB after compression — pick a smaller photo."); return; }
    try { const url = await readImage(file); setX("photo", url); toast("success", "Photo attached", "It will be sent with your report."); }
    catch { toast("error", "Could not read photo", "Try another image."); }
  }

  function reset() { setF(empty); setPicked(false); setExtras(false); setTitleTouched(false); setPreview(null); setDone(null); setMStep(0); setShowErr(false); setVoice(null); }

  if (done) return <Result inc={done.inc} local={done.local} admin={admin} onNew={reset} />;

  const err = (k: string) => (showErr ? errs[k] : undefined);
  const show = (n: number) => !isMobile || mStep === n;

  /* ---------- sections ---------- */
  const secType = (
    <div className="space-y-6">
      <VoicePanel onParsed={applyParse} />
      {voice && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Filled from your {voice.how === "voice" ? "voice" : "words"} — please check</p>
            <p className="mt-0.5 truncate text-xs opacity-80">"{voice.text}"</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:ring-amber-700">{Math.round(voice.conf * 100)}% sure</span>
        </div>
      )}
      <div>
        <Label icon={<AlertTriangle className="size-4 text-[#e53935]" />}>What's the emergency? <Req /></Label>
        <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
          {TILES.map((t) => {
            const m = CATEGORY_META[t.c]; const on = picked && f.category === t.c;
            return (
              <button key={t.c} type="button" onClick={() => { set("category", t.c); setPicked(true); }}
                className={cn("relative flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-1 py-2.5 text-center transition hover:-translate-y-0.5 hover:shadow-md",
                  on ? "border-[#e53935] shadow-[0_0_0_3px_rgba(229,57,53,.15)]" : "border-slate-200 hover:border-slate-300")}>
                <span className={cn("grid size-9 place-items-center rounded-full sm:size-10", on ? "bg-[#e53935] text-white" : t.tint)}><m.icon className="size-[18px] sm:size-5" /></span>
                <span className={cn("text-[11px] font-medium leading-tight sm:text-xs", on ? "text-[#e53935]" : NAVY)}>{t.label}</span>
                {on && <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-[#e53935] text-white shadow"><Check className="size-3" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
        {err("category") && <ErrText>{errs.category}</ErrText>}
      </div>

      <div>
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <p className={cn("text-sm font-semibold", NAVY)}>Severity <span className="font-normal text-slate-500">(How serious is it?)</span></p>
          {picked && preview && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Gauge className="size-3.5" />Our rules say: <SeverityBadge severity={preview.severity} score={preview.score} /></span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEV_CHIPS.map((c) => {
            const on = f.reported_severity === c.s;
            return (
              <button key={c.s} type="button" onClick={() => set("reported_severity", on ? null : c.s)}
                className={cn("relative flex items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition", on ? c.on : "border-slate-200 bg-white hover:border-slate-300")}>
                <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", c.dot)} />
                <span className="min-w-0"><span className={cn("block text-sm font-semibold leading-tight", NAVY)}>{c.s}</span><span className="block text-[11px] leading-tight text-slate-500">{c.sub}</span></span>
                {on && <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-[#e53935] text-white shadow"><Check className="size-3" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Q label="Anyone trapped, unconscious or not breathing?">
          <Choice danger value={f.life_threat} options={[[true, "Yes"], [false, "No"]]} onChange={(v) => set("life_threat", v)} />
        </Q>
        <Q label="Injuries">
          <Choice value={f.injuries} options={[["none", "None"], ["minor", "Minor"], ["serious", "Serious"]] as [Injuries, string][]} onChange={(v) => set("injuries", v)} />
        </Q>
        <Q label="How big is the danger?">
          <Choice value={f.hazard} options={[["small", "Small"], ["medium", "Med"], ["large", "Large"], ["spreading", "Spread"]] as [Hazard, string][]} onChange={(v) => set("hazard", v)} />
        </Q>
        <Q label="Is it still happening?">
          <Choice value={f.active} options={[[true, "Still active"], [false, "It's over"]]} onChange={(v) => set("active", v)} />
        </Q>
      </div>

      <div>
        <Label>Brief Description <Req /></Label>
        <div className="relative">
          <textarea value={f.description} maxLength={DESC_MAX} rows={4} onChange={(e) => set("description", e.target.value)}
            placeholder="e.g. Smoke coming from the 2nd floor, people shouting for help near the stairs."
            className={cn("w-full resize-none rounded-xl border bg-white px-3.5 py-3 pb-7 text-sm text-[#0f1f3d] outline-none placeholder:text-slate-400 focus:border-[#e53935] focus:ring-4 focus:ring-red-100",
              err("description") ? "border-red-400" : "border-slate-200")} />
          <span className="pointer-events-none absolute right-3 bottom-2.5 font-mono text-[11px] text-slate-400">{f.description.length} / {DESC_MAX}</span>
        </div>
        {err("description") && <ErrText>{errs.description}</ErrText>}
        {!isMobile && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-slate-500">Title (auto-filled, you can edit)</p>
            <input value={f.title} maxLength={120} onChange={(e) => { setTitleTouched(true); set("title", e.target.value); }} placeholder="Filled in when you pick type + area"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#0f1f3d] outline-none focus:border-[#e53935] focus:ring-4 focus:ring-red-100" />
          </div>
        )}
      </div>
    </div>
  );

  const secLoc = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label icon={<MapPin className="size-4 text-[#e53935]" />} className="mb-0">Location <Req /></Label>
        <select value={f.area} aria-label="Area"
          onChange={(e) => { const a = areaByName(e.target.value); setF((x) => ({ ...x, area: e.target.value, lat: a?.lat ?? x.lat, lng: a?.lng ?? x.lng })); }}
          className={cn("h-9 max-w-[60%] rounded-lg border bg-white px-2.5 text-sm font-medium text-[#1e63d6] outline-none focus:ring-4 focus:ring-blue-100",
            err("area") ? "border-red-400" : "border-slate-200")}>
          <option value="">Chennai, Tamil Nadu — select area</option>
          {AREAS.map((a) => <option key={a.name} value={a.name}>{a.name}, Chennai</option>)}
        </select>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <LazyMap height={isMobile ? 260 : 230} picked={f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null}
          onPick={(p) => setF((x) => ({ ...x, lat: p.lat, lng: p.lng, area: p.area }))} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1 font-mono text-slate-600"><MapPin className="size-3.5 text-[#e53935]" />
          {f.lat != null && f.lng != null ? `Lat: ${f.lat.toFixed(4)}° N, Long: ${f.lng.toFixed(4)}° E` : "Tap the map to drop a pin"}</span>
        <button type="button" onClick={() => setEditLL((v) => !v)} className="inline-flex items-center gap-1 font-medium text-[#1e63d6] hover:underline"><Pencil className="size-3" />{editLL ? "Done" : "Edit"}</button>
        {f.area && <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 font-medium text-[#1e63d6]">{f.area}</span>}
      </div>
      {editLL && (
        <div className="grid grid-cols-2 gap-2">
          <NumIn label="Latitude" value={f.lat} onChange={(v) => set("lat", v)} />
          <NumIn label="Longitude" value={f.lng} onChange={(v) => set("lng", v)} />
        </div>
      )}
      {err("area") && <ErrText>{errs.area}</ErrText>}
      <input value={f.landmark} onChange={(e) => set("landmark", e.target.value)} placeholder="Landmark (optional) — e.g. near bus stand"
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#0f1f3d] outline-none placeholder:text-slate-400 focus:border-[#e53935] focus:ring-4 focus:ring-red-100" />
    </div>
  );

  const secInfo = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>People Affected <span className="font-normal text-slate-500">(Est.)</span></Label>
          <Counter value={Number.isFinite(f.people_affected) ? f.people_affected : 0} onChange={(v) => setX("people_affected", v)} />
          {err("people") && <ErrText>{errs.people}</ErrText>}
        </div>
        <div>
          <Label>Injured</Label>
          <Counter value={f.injured_count} onChange={(v) => setX("injured_count", v)} />
        </div>
      </div>
      <div>
        <Label>Vulnerable Individuals</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {VULN.map(({ v, label }) => {
            const on = f.vulnerable.includes(v);
            return (
              <label key={v} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition", on ? "border-[#e53935] bg-red-50" : "border-slate-200 bg-white hover:border-slate-300")}>
                <input type="checkbox" checked={on} className="size-4 accent-[#e53935]"
                  onChange={() => setX("vulnerable", on ? f.vulnerable.filter((x) => x !== v) : [...f.vulnerable, v])} />
                <span className={NAVY}>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <Label>Add Evidence <span className="font-normal text-slate-500">(Optional)</span></Label>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {f.photo ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
            <div className="relative">
              <img src={f.photo} alt="Attached evidence" className="size-16 rounded-lg object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => set("photo", null)} className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-[#0f1f3d] text-white shadow"><X className="size-3.5" /></button>
            </div>
            <div className="text-sm"><p className={cn("font-medium", NAVY)}>Photo attached</p><p className="text-xs text-slate-500">Compressed to JPEG, sent with the report.</p></div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
            className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-5 text-center transition hover:border-[#e53935] hover:bg-red-50/40">
            <ImagePlus className="size-6 text-[#1e63d6]" />
            <span className={cn("text-sm font-semibold", NAVY)}>Upload Photos / Videos</span>
            <span className="text-xs text-slate-500">PNG, JPG (Max 2 MB)</span>
          </button>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><UserX className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className={cn("text-sm font-semibold", NAVY)}>Report Anonymously</p><p className="text-xs text-slate-500">Your identity will be hidden from responders.</p></div>
          <button type="button" role="switch" aria-checked={!!f.anonymous} aria-label="Report anonymously" onClick={() => setX("anonymous", !f.anonymous)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition", f.anonymous ? "bg-[#e53935]" : "bg-slate-300")}>
            <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", f.anonymous && "translate-x-5")} />
          </button>
        </div>
        {!f.anonymous && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={f.contact_name} onChange={(e) => setX("contact_name", e.target.value)} placeholder="Your name (optional)"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#0f1f3d] outline-none placeholder:text-slate-400 focus:border-[#e53935] focus:ring-4 focus:ring-red-100" />
            <input value={f.contact_phone} inputMode="tel" onChange={(e) => setX("contact_phone", e.target.value)} placeholder="Phone (optional)"
              className={cn("h-10 rounded-xl border bg-white px-3 text-sm text-[#0f1f3d] outline-none placeholder:text-slate-400 focus:border-[#e53935] focus:ring-4 focus:ring-red-100", err("phone") ? "border-red-400" : "border-slate-200")} />
            {err("phone") && <ErrText>{errs.phone}</ErrText>}
          </div>
        )}
      </div>
    </div>
  );

  const label = TILES.find((t) => t.c === f.category)?.label ?? "—";
  const secConfirm = (
    <div className="space-y-4">
      <PreviewCard preview={picked ? preview : null} reported={f.reported_severity ?? null} />
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
        <Row k="Type" v={picked ? label : "—"} />
        <Row k="Location" v={[f.area, f.landmark].filter(Boolean).join(" · ") || "—"} />
        <Row k="People / injured" v={`${f.people_affected} affected · ${f.injured_count} injured`} />
        <Row k="Vulnerable" v={f.vulnerable.length ? f.vulnerable.join(", ") : "None"} />
        <Row k="Evidence" v={f.photo ? "1 photo" : "None"} />
        <Row k="Identity" v={f.anonymous ? "Anonymous" : f.contact_name || f.contact_phone ? [f.contact_name, f.contact_phone].filter(Boolean).join(" · ") : "Not given"} />
      </div>
      <div>
        <p className="mb-1 text-xs text-slate-500">Title (auto-filled, you can edit)</p>
        <input value={f.title} maxLength={120} onChange={(e) => { setTitleTouched(true); set("title", e.target.value); }}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#0f1f3d] outline-none focus:border-[#e53935] focus:ring-4 focus:ring-red-100" />
      </div>
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{f.description || "No description yet."}</p>
    </div>
  );

  const submitBtn = (
    <button type="button" onClick={submit} disabled={busy}
      className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#e53935] px-5 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(229,57,53,.6)] transition hover:bg-[#d32f2f] active:scale-[.99] disabled:opacity-70">
      {busy ? <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="size-5" />}
      {busy ? "Sending…" : "Report Emergency"}
    </button>
  );

  return (
    <div ref={top} className="scroll-mt-20">
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-8">
        {/* ---------- left rail ---------- */}
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <h1 className={cn("font-display text-[28px] font-bold leading-tight tracking-tight sm:text-4xl", NAVY)}>Report an <span className="text-[#e53935]">Emergency</span></h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-[15px]">
            <span className="md:hidden">Get help to the right place, right time.</span>
            <span className="hidden md:inline">Send a real-time incident report to the control room and get the right help, faster.</span>
          </p>

          {/* horizontal stepper (mobile + tablet) */}
          <ol className="mt-5 flex items-start lg:hidden">
            {STEPS.map((s, i) => (
              <li key={s.short} className="relative flex flex-1 flex-col items-center">
                {i > 0 && <span className={cn("absolute top-3.5 right-1/2 h-0.5 w-full -translate-x-3.5", i <= active ? "bg-[#e53935]" : "bg-slate-200")} />}
                <button type="button" disabled={!isMobile || i > mStep} onClick={() => go(i)}
                  className={cn("relative z-10 grid size-7 place-items-center rounded-full text-xs font-bold transition",
                    i < active ? "bg-[#e53935] text-white" : i === active ? "bg-[#e53935] text-white ring-4 ring-red-100" : "bg-white text-slate-400 ring-1 ring-slate-200")}>
                  {i < active ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </button>
                <span className={cn("mt-1.5 text-[11px]", i === active ? "font-semibold text-[#e53935]" : "text-slate-500")}>{s.short}</span>
              </li>
            ))}
          </ol>

          {/* vertical stepper (desktop) */}
          <ol className="mt-8 hidden lg:block">
            {STEPS.map((s, i) => {
              const ok = i < cur, on = i === cur;
              return (
                <li key={s.title} className="relative flex gap-3.5 pb-7 last:pb-0">
                  {i < 3 && <span className={cn("absolute top-9 left-[17px] h-[calc(100%-36px)] w-0.5", ok ? "bg-[#e53935]" : "bg-slate-200")} />}
                  <span className={cn("relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold transition",
                    ok ? "bg-[#e53935] text-white" : on ? "bg-[#e53935] text-white ring-4 ring-red-100" : "bg-white text-slate-400 ring-1 ring-slate-200")}>
                    {ok ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="pt-1">
                    <p className={cn("text-sm font-semibold", on ? "text-[#e53935]" : ok ? NAVY : "text-slate-500")}>{s.title}</p>
                    <p className="text-xs text-slate-500">{s.sub}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 hidden lg:block"><PreviewCard preview={picked ? preview : null} reported={f.reported_severity ?? null} compact /></div>
          <div className="mt-4 hidden lg:block"><Call112Card /></div>
        </aside>

        {/* ---------- form card ---------- */}
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,31,61,.04),0_12px_32px_-12px_rgba(15,31,61,.12)]">
          <div className="border-b border-slate-100 px-4 pt-4 pb-3.5 sm:px-6 sm:pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className={cn("text-base font-semibold sm:text-lg", NAVY)}>
                <span className="text-slate-500">Step {active + 1} of 4:</span> {STEPS[active].title}
              </p>
              <span className="hidden text-xs text-slate-500 sm:inline">{STEPS[active].sub}</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {STEPS.map((s, i) => <span key={s.short} className={cn("h-1.5 rounded-full transition-colors duration-300", i <= active ? "bg-[#e53935]" : "bg-slate-100")} />)}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {isMobile ? (
              <AnimatePresence mode="wait">
                <motion.div key={mStep} initial={STATIC ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                  {mStep === 0 && secType}
                  {mStep === 1 && secLoc}
                  {mStep === 2 && secInfo}
                  {mStep === 3 && secConfirm}
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="grid gap-8 xl:grid-cols-2">
                {show(0) && secType}
                <div className="space-y-6">
                  {secLoc}
                  <div className="border-t border-slate-100 pt-5">{secInfo}</div>
                </div>
              </div>
            )}

            <div className="mt-6">
              {isMobile ? (
                <div className="flex gap-2.5">
                  {mStep > 0 && (
                    <button type="button" onClick={() => go(mStep - 1)} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f1f3d]">
                      <ArrowLeft className="size-4" />Back
                    </button>
                  )}
                  {mStep < 3 ? (
                    <button type="button" onClick={next} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e53935] text-[15px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(229,57,53,.6)] active:scale-[.99]">
                      Next: {STEPS[mStep + 1].title.replace("Confirm & Report", "Confirm")}<ArrowRight className="size-4" />
                    </button>
                  ) : <div className="flex-1">{submitBtn}</div>}
                </div>
              ) : submitBtn}
              <p className="mt-3 text-center text-xs text-slate-500">By reporting, your location and details are shared with the emergency control room.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 lg:hidden"><Call112Card /></div>
    </div>
  );
}

/* ---------- Speak to Report ---------- */

function VoicePanel({ onParsed }: { onParsed: (p: ParseOut, text: string, how: "voice" | "typed") => void }) {
  const [lang, setLang] = useState<"en-IN" | "ta-IN">("en-IN");
  const [typed, setTyped] = useState("");
  const [parsing, setParsing] = useState(false);
  const [showType, setShowType] = useState(false);
  const supported = useMemo(() => speechSupported(), []);
  async function run(text: string, how: "voice" | "typed") {
    if (text.trim().length < 3) return;
    setParsing(true);
    try { onParsed(await parseText(text.trim()), text.trim(), how); if (how === "typed") setTyped(""); }
    finally { setParsing(false); }
  }
  const sp = useSpeech((t) => run(t, "voice"));
  const typeOpen = showType || !supported || !!sp.error;
  const errMsg = sp.error === "not-allowed" ? "Microphone permission was blocked." : sp.error === "no-speech" ? "We didn't hear anything — try again." :
    sp.error === "unsupported" ? "Voice isn't supported in this browser." : sp.error ? "Voice didn't work here." : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-blue-50 p-3.5 sm:p-4 dark:border-red-900/50 dark:from-red-950/30 dark:via-slate-900 dark:to-blue-950/30">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={parsing || !supported} onClick={() => (sp.listening ? sp.stop() : sp.listen(lang))}
          aria-label={sp.listening ? "Stop listening" : "Speak your emergency"}
          className={cn("relative flex h-14 min-w-0 flex-1 basis-full sm:basis-auto items-center justify-center gap-2.5 rounded-xl px-4 text-[15px] font-semibold text-white transition active:scale-[.99] disabled:opacity-60",
            sp.listening ? "bg-[#0f1f3d]" : "bg-[#e53935] shadow-[0_10px_24px_-8px_rgba(229,57,53,.6)] hover:bg-[#d32f2f]")}>
          {sp.listening && <span className="absolute inset-0 animate-pulse rounded-xl ring-4 ring-red-300/60" />}
          {parsing ? <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : sp.listening ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
          <span className="truncate">{parsing ? "Understanding…" : sp.listening ? "Listening… tap to stop" : "Speak your emergency"}</span>
        </button>
        <div className="inline-flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700" role="group" aria-label="Voice language">
          {([["en-IN", "English"], ["ta-IN", "தமிழ்"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setLang(v)}
              className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition", lang === v ? "bg-[#0f1f3d] text-white" : "text-slate-600 hover:text-[#0f1f3d] dark:text-slate-300")}>{l}</button>
          ))}
        </div>
      </div>
      {(sp.listening || sp.interim) && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm text-[#0f1f3d] ring-1 ring-slate-200 dark:bg-slate-900/80 dark:text-slate-100 dark:ring-slate-700">
          {sp.listening && <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-[#e53935]" />}
          <span className="min-w-0 break-words">{sp.interim || <span className="text-slate-400">Say what happened, where, and how many people…</span>}</span>
        </p>
      )}
      <p className="mt-2.5 text-xs text-slate-500">
        One sentence fills the whole form — type, area, people, injuries, danger. e.g. <i>"Fire in T Nagar, 5 people trapped"</i>.
        {errMsg && <b className="ml-1 text-amber-700 dark:text-amber-400">{errMsg} Type it instead below.</b>}
      </p>
      {typeOpen ? (
        <div className="mt-2.5 flex gap-2">
          <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={2} maxLength={500} aria-label="Type it instead"
            placeholder={lang === "ta-IN" ? "வேளச்சேரியில் வெள்ளம், குழந்தைகள் சிக்கி இருக்காங்க" : "Type it instead — e.g. flood in Velachery, 4 children stuck"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(typed, "typed"); } }}
            className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0f1f3d] outline-none placeholder:text-slate-400 focus:border-[#e53935] focus:ring-4 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          <button type="button" aria-label="Fill form" disabled={parsing || typed.trim().length < 3} onClick={() => run(typed, "typed")}
            className="flex shrink-0 items-center gap-1.5 self-stretch rounded-xl bg-[#0f1f3d] px-3.5 text-sm font-semibold text-white disabled:opacity-40">
            <Sparkles className="size-4" /><span className="hidden min-[400px]:inline">Fill form</span>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowType(true)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e63d6] hover:underline">
          <Keyboard className="size-3.5" />Type it instead
        </button>
      )}
    </div>
  );
}

/* ---------- small pieces ---------- */

function Req() { return <span className="text-[#e53935]">*</span>; }
function ErrText({ children }: { children: ReactNode }) { return <p className="mt-1.5 text-xs font-medium text-red-600">{children}</p>; }
function Label({ children, icon, className }: { children: ReactNode; icon?: ReactNode; className?: string }) {
  return <p className={cn("mb-2.5 flex items-center gap-1.5 text-sm font-semibold", NAVY, className)}>{icon}{children}</p>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 px-3.5 py-2.5"><span className="text-slate-500">{k}</span><span className={cn("text-right font-medium capitalize", NAVY)}>{v}</span></div>;
}

function NumIn({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <label className="text-xs text-slate-500">{label}
      <input type="number" step="0.0001" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-sm text-[#0f1f3d] outline-none focus:border-[#e53935]" />
    </label>
  );
}

function Counter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const btn = "grid size-10 place-items-center rounded-lg text-[#0f1f3d] transition hover:bg-slate-100 disabled:opacity-40";
  return (
    <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-1">
      <button type="button" aria-label="Decrease" className={btn} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}><Minus className="size-4" /></button>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
        className="w-14 bg-transparent text-center font-semibold text-[#0f1f3d] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <button type="button" aria-label="Increase" className={btn} onClick={() => onChange(Math.min(100000, value + 1))}><Plus className="size-4" /></button>
    </div>
  );
}

function Q({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3"><p className={cn("mb-2 text-xs font-medium", NAVY)}>{label}</p>{children}</div>;
}

function Choice<T extends string | boolean>({ value, options, onChange, danger }: { value: T; options: [T, string][]; onChange: (v: T) => void; danger?: boolean }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l]) => {
        const on = v === value; const red = danger && v === true && on;
        return (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            className={cn("min-h-10 rounded-lg px-1.5 text-xs font-semibold ring-1 transition sm:text-[13px]",
              red ? "bg-[#e53935] text-white ring-[#e53935]" : on ? "bg-[#0f1f3d] text-white ring-[#0f1f3d]" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300")}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Call112Card() {
  return (
    <a href="tel:112" className="flex items-center gap-3.5 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4 transition hover:shadow-md">
      <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-[#e53935] text-white shadow-[0_8px_20px_-6px_rgba(229,57,53,.7)]">
        {!STATIC && <span className="absolute inset-0 animate-ping rounded-full bg-[#e53935]/30" />}
        <Phone className="relative size-5" />
      </span>
      <div>
        <p className={cn("text-sm", NAVY)}>Not sure? <b className="text-[#e53935]">Call 112</b></p>
        <p className="text-xs text-slate-500">National Emergency Helpline</p>
      </div>
    </a>
  );
}

function PreviewCard({ preview, reported, compact }: { preview: SeverityOut | null; reported: Severity | null; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <p className={cn("flex items-center gap-2 text-sm font-semibold", NAVY)}><Gauge className="size-4 text-[#1e63d6]" />Live severity</p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">rules engine</span>
      </div>
      {preview ? (
        <div className="p-4">
          <div className="flex items-center gap-3.5">
            <ScoreRing score={preview.score} color={SEV_HEX[preview.severity]} size={compact ? 54 : 64} />
            <div className="min-w-0">
              <SeverityBadge severity={preview.severity} size="lg" />
              <p className="mt-1 text-xs text-slate-500">Score {preview.score}/100{reported ? <> · you said <b>{reported}</b></> : null}</p>
            </div>
          </div>
          <div className={cn("mt-3 overflow-auto", compact ? "max-h-64" : "max-h-72")}><ReasonsList reasons={preview.reasons} compact /></div>
        </div>
      ) : (
        <p className="p-4 text-sm text-slate-500">Pick a category to see how urgent this is — and why.</p>
      )}
    </div>
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

function Result({ inc, local, admin, onNew }: { inc: Incident; local: boolean; admin: boolean; onNew: () => void }) {
  const toast = useToast();
  return (
    <motion.div initial={STATIC ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,31,61,.18)]">
        <div className="bg-gradient-to-br from-[#e53935] to-[#b71c1c] p-6 text-center text-white">
          <motion.div initial={STATIC ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="mx-auto grid size-16 place-items-center rounded-full bg-white/20"><CheckCircle2 className="size-9" /></motion.div>
          <h2 className="mt-3 text-2xl font-semibold">Report received</h2>
          <p className="mt-1 text-white/85">Help is being prioritised. Keep your phone nearby.</p>
          <button onClick={() => { navigator.clipboard?.writeText(inc.id); toast("info", "Reference copied", inc.id); }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 font-mono text-lg font-semibold">
            {inc.id}<Copy className="size-4 opacity-70" />
          </button>
        </div>
        {local && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm text-amber-800">
            <WifiOff className="size-4 shrink-0" /> Saved locally (demo) — the server was not reachable. Please also call 112.
          </div>
        )}
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <ScoreRing score={inc.score} color={SEV_HEX[inc.severity]} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-semibold", NAVY)}>{inc.title}</p>
              <div className="mt-1 flex flex-wrap gap-2"><SeverityBadge severity={inc.severity} /><StatusBadge status={inc.status} />
                {inc.reported_severity && <span className="text-xs text-slate-500">you said {inc.reported_severity}</span>}</div>
            </div>
          </div>
          {(() => {
            const vols = ((inc as Incident & { volunteers?: { id: string; name: string; status: string; distance_m: number; eta_min: number }[] }).volunteers ?? []).filter((v) => v.status !== "declined");
            if (!vols.length) return null;
            const eta = Math.max(1, Math.round(Math.min(...vols.map((v) => v.eta_min))));
            return (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300"><HeartPulse className="size-5 shrink-0" />{vols.length} CPR hero{vols.length > 1 ? "es" : ""} nearby {vols.length > 1 ? "were" : "was"} alerted — help may arrive in ~{eta} min</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {vols.map((v) => (
                    <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-emerald-900">
                      <span className="size-1.5 rounded-full bg-emerald-500" />{v.name} · {v.distance_m < 1000 ? `${Math.round(v.distance_m)} m` : `${(v.distance_m / 1000).toFixed(1)} km`}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-emerald-700/80 dark:text-emerald-400/80">Verified CPR-trained citizens. Stay with the person and keep them visible.</p>
              </div>
            );
          })()}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Why this priority</p>
            <ReasonsList reasons={inc.reasons} compact />
          </div>
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            {!local && (
              <Link to={`/track/${inc.id}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e53935] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(229,57,53,.6)] hover:bg-[#d32f2f]">
                <Radar className="size-4" />Track this report
              </Link>
            )}
            <button type="button" onClick={onNew} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-semibold text-[#0f1f3d] hover:bg-slate-50">
              <Plus className="size-4" />Report another
            </button>
            {admin && (
              <Link to={local ? "/admin" : `/admin/incidents/${inc.id}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-semibold text-[#1e63d6] hover:bg-slate-50 sm:col-span-2">
                <LayoutDashboard className="size-4" />{local ? "Control room" : "Open incident"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export type { Category };
