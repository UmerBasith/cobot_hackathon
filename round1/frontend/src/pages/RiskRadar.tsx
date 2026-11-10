/** /admin/risk — Predictive Risk Radar: forecast rain + flood-prone areas + open incidents + unit distance
 *  → ranked risk per area, with one-click "Pre-position now" for the recommended rescue unit. */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  AlertTriangle, ArrowRightLeft, Calculator, CloudRain, Droplets, Map as MapIcon, MapPin, Radar, RefreshCw, Satellite, ShieldAlert, Siren,
  Truck, Zap,
} from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton, useToast } from "@/ui";
import { LazyMap } from "@/sections/LazyMap";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import { STATIC } from "@/lib/static";
import { getRisk, preposition, RISK_HEX, RISK_METHOD, RISK_WEIGHTS, RISK_ZONE, type RiskArea, type RiskLevel, type RiskOut } from "@/lib/innovation";

const LEVEL_PILL: Record<RiskLevel, string> = {
  severe: "bg-red-600 text-white", high: "bg-orange-500 text-white",
  elevated: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};
const LEVELS: RiskLevel[] = ["severe", "high", "elevated", "low"];

export default function RiskRadar() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const heavy = STATIC || params.get("scenario") === "heavy_rain";
  const [data, reload, at] = usePoll<RiskOut>(() => getRisk(heavy), 30000, [heavy]);
  const [moving, setMoving] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setMoved({}), [heavy]);

  const setMode = (h: boolean) => {
    const p = new URLSearchParams(params);
    if (h) p.set("scenario", "heavy_rain"); else p.delete("scenario");
    setParams(p, { replace: true });
  };

  const areas = data?.areas ?? [];
  const top = areas[0];
  const atRisk = areas.filter((a) => a.level === "severe" || a.level === "high").length;
  const maxRain = areas.reduce((m, a) => Math.max(m, a.rain_mm_6h), 0);
  const toMove = areas.filter((a) => a.recommendation?.team_id && (a.nearest_unit_km ?? 0) > 1 && !moved[a.area]).length;
  const live = (data?.source ?? "").startsWith("live");
  const unavailable = (data?.source ?? "") === "unavailable";

  const zones = useMemo(() => areas.map((a) => ({ id: a.area, lat: a.lat, lng: a.lng, status: RISK_ZONE[a.level], label: `${a.area} · risk ${a.risk}` })), [areas]);

  async function doMove(a: RiskArea) {
    const r = a.recommendation;
    if (!r?.team_id) return;
    setMoving(a.area);
    try {
      await preposition(a.area, r.team_id);
      setMoved((m) => ({ ...m, [a.area]: r.team_name }));
      toast("success", `${r.team_name.split(" · ")[0]} moved to ${a.area}`, `${r.team_name} is now on standby at ${a.area} — before the water rises.`);
      reload();
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      toast(msg.startsWith("409") ? "warning" : "error", msg.startsWith("409") ? "Unit not available" : "Could not move unit",
        msg.startsWith("409") ? `${r.team_name} is busy on an incident. Pick another unit from Teams.` : "Backend not reachable — try again.");
    } finally { setMoving(null); }
  }

  return (
    <div className="min-w-0">
      {/* ---------- hero header ---------- */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0b1730] via-[#10234a] to-[#1b1240] p-5 text-white shadow-soft sm:p-6">
        <RadarSweep />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-sky-200 uppercase ring-1 ring-white/15">
              <Radar className="size-3.5" />Predictive Risk Radar · next 6 hours
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">
              Every other system reacts. <span className="bg-gradient-to-r from-sky-300 to-orange-300 bg-clip-text text-transparent">ResQNet predicts.</span>
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Rain forecast + flood-prone areas + open incidents + distance to free rescue units → a risk score per area,
              and which unit to move <b className="text-white">before</b> the calls come in.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="inline-flex rounded-xl bg-white/10 p-1 ring-1 ring-white/15" role="tablist" aria-label="Forecast source">
              <button type="button" onClick={() => setMode(false)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", !heavy ? "bg-white text-[#0b1730] shadow" : "text-slate-200 hover:text-white")}>
                <Satellite className="size-3.5" />Live forecast (Open-Meteo)
              </button>
              <button type="button" onClick={() => setMode(true)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", heavy ? "bg-orange-500 text-white shadow" : "text-slate-200 hover:text-white")}>
                <CloudRain className="size-3.5" />Demo: heavy rain scenario
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ring-1",
                live ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30" : unavailable ? "bg-amber-500/15 text-amber-200 ring-amber-400/30" : "bg-orange-500/15 text-orange-200 ring-orange-400/30")}>
                <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-400" : unavailable ? "bg-amber-400" : "bg-orange-400")} />
                Source: {data ? (unavailable ? "live forecast unavailable (offline) — rain = 0" : data.source) : "loading…"}
              </span>
              <span>{at ? `updated ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · auto 30 s` : ""}</span>
              <button type="button" onClick={reload} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-white/10" aria-label="Refresh"><RefreshCw className="size-3" />Refresh</button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- tiles ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (<>
          <Tile icon={Siren} label="Highest-risk area" tone={top ? RISK_HEX[top.level] : "#64748b"}
            value={top ? top.area : "—"} sub={top ? <><b style={{ color: RISK_HEX[top.level] }}>{top.risk}/100</b> · {top.level}</> : "no data"} />
          <Tile icon={ShieldAlert} label="Areas at high / severe" tone={atRisk ? "#ea580c" : "#16a34a"} value={String(atRisk)} sub={`of ${areas.length} areas watched`} />
          <Tile icon={CloudRain} label="Max rain expected (6 h)" tone="#2563eb" value={`${maxRain.toFixed(1)} mm`}
            sub={maxRain >= 64.5 ? "IMD: heavy rain" : maxRain >= 15.6 ? "moderate rain" : "light / none"} />
          <Tile icon={Truck} label="Units to pre-position" tone="#7c3aed" value={String(toMove)} sub={Object.keys(moved).length ? `${Object.keys(moved).length} moved this session` : "one click each"} />
        </>) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}
      </div>

      {/* ---------- map + ranked list ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Risk map" subtitle="Circle colour = forecast risk level" icon={MapIcon} />
          <CardBody>
            <LazyMap height={420} zones={zones} onSelect={(id) => setSel(id)} />
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
              {LEVELS.map((l) => (
                <span key={l} className="flex items-center gap-1.5 capitalize">
                  <span className="size-3 rounded-full border-2" style={{ borderColor: RISK_HEX[l], background: `${RISK_HEX[l]}33` }} />{l}
                  <span className="text-muted/70">({areas.filter((a) => a.level === l).length})</span>
                </span>
              ))}
            </div>
            <HowCalculated method={data?.method ?? RISK_METHOD} />
          </CardBody>
        </Card>

        <Card className="min-w-0 xl:col-span-3">
          <CardHeader title="Areas ranked by risk" subtitle="Worst first · drivers explain every score" icon={AlertTriangle}
            action={<Badge tone="gray">rule-based, simplified flood index</Badge>} />
          <CardBody className="space-y-2.5">
            {!data && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            {areas.map((a, i) => (
              <AreaRow key={a.area} a={a} rank={i + 1} highlight={sel === a.area} movedTo={moved[a.area]} busy={moving === a.area} onMove={() => doMove(a)} />
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, tone }: { icon: typeof Siren; label: string; value: string; sub: React.ReactNode; tone: string }) {
  return (
    <Card className="relative min-w-0 overflow-hidden p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: tone }} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${tone}1a`, color: tone }}><Icon className="size-4" /></span>
      </div>
      <p className="mt-1 truncate font-display text-2xl font-bold tracking-tight" style={{ color: tone }}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
    </Card>
  );
}

function AreaRow({ a, rank, highlight, movedTo, busy, onMove }: { a: RiskArea; rank: number; highlight: boolean; movedTo?: string; busy: boolean; onMove: () => void }) {
  const hex = RISK_HEX[a.level];
  const r = a.recommendation;
  const actionable = !!r?.team_id && (a.nearest_unit_km ?? 0) > 1;
  return (
    <motion.div initial={STATIC ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(rank, 8) * 0.03 }}
      className={cn("rounded-xl border bg-surface p-3.5 transition", highlight ? "border-brand-400 ring-2 ring-brand-200 dark:ring-brand-900" : "border-line")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-xs font-semibold text-muted">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{a.area}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", LEVEL_PILL[a.level])}>{a.level}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div initial={STATIC ? false : { width: 0 }} animate={{ width: `${a.risk}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${hex}99, ${hex})` }} />
            </div>
            <span className="w-14 shrink-0 text-right font-display text-lg font-bold tabular-nums" style={{ color: hex }}>{a.risk}<span className="text-xs font-medium text-muted/70">/100</span></span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
        <Metric icon={CloudRain} k="Rain 6 h" v={`${a.rain_mm_6h.toFixed(1)} mm`} />
        <Metric icon={Droplets} k="Flood-prone" v={`${Math.round(a.flood_prone * 100)}%`} />
        <Metric icon={Siren} k="Open / critical" v={`${a.open_incidents} / ${a.critical_incidents}`} hot={a.critical_incidents > 0} />
        <Metric icon={MapPin} k="Nearest unit" v={a.nearest_unit_km == null ? "none free" : `${a.nearest_unit_km.toFixed(1)} km`} hot={(a.nearest_unit_km ?? 99) > 6} />
      </div>
      {a.drivers.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {a.drivers.map((d) => <li key={d} className="flex items-center gap-1"><span className="size-1 rounded-full" style={{ background: hex }} />{d}</li>)}
        </ul>
      )}
      {r && (
        <div className={cn("mt-2.5 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs",
          movedTo ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : actionable ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200" : "bg-surface-2 text-muted")}>
          <Zap className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{movedTo ? `${movedTo} is on standby at ${a.area}.` : r.text}</span>
          {actionable && !movedTo && (
            <button type="button" onClick={onMove} disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#e53935] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgba(229,57,53,.7)] transition hover:bg-[#d32f2f] disabled:opacity-60">
              {busy ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRightLeft className="size-3.5" />}
              Pre-position now
            </button>
          )}
          {movedTo && <span className="shrink-0 font-semibold">✓ Moved</span>}
        </div>
      )}
    </motion.div>
  );
}

function Metric({ icon: Icon, k, v, hot }: { icon: typeof Siren; k: string; v: string; hot?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2/70 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted/70"><Icon className="size-3" />{k}</p>
      <p className={cn("truncate font-semibold tabular-nums", hot && "text-red-600 dark:text-red-400")}>{v}</p>
    </div>
  );
}

function HowCalculated({ method }: { method: string }) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold"><Calculator className="size-4 text-brand-600" />How it's calculated</p>
      <div className="mt-2.5 flex h-3 overflow-hidden rounded-full">
        {RISK_WEIGHTS.map((w) => <span key={w.label} title={`${w.label} ${w.pct}%`} style={{ width: `${w.pct}%`, background: w.color }} />)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {RISK_WEIGHTS.map((w) => (
          <span key={w.label} className="flex items-center gap-1.5 text-muted"><span className="size-2 shrink-0 rounded-sm" style={{ background: w.color }} />
            <b className="tabular-nums text-fg">{w.pct}%</b> {w.label}</span>
        ))}
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted">{method}</p>
      <p className="mt-1.5 text-[11px] text-muted/70">Levels: severe ≥ 75 · high ≥ 50 · elevated ≥ 30 · low &lt; 30. Rain from Open-Meteo (free, no key).</p>
    </div>
  );
}

function RadarSweep() {
  return (
    <div className="pointer-events-none absolute -top-24 -right-24 size-72 opacity-60 sm:size-80" aria-hidden>
      {[1, 0.75, 0.5, 0.25].map((s) => (
        <span key={s} className="absolute rounded-full border border-sky-300/20" style={{ inset: `${(1 - s) * 50}%` }} />
      ))}
      <span className={cn("absolute inset-0 rounded-full", !STATIC && "animate-[spin_4s_linear_infinite]")}
        style={{ background: "conic-gradient(from 0deg, rgba(56,189,248,.35), rgba(56,189,248,0) 70deg, transparent 360deg)" }} />
      <span className="absolute top-[38%] left-[30%] size-2 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,.9)]" />
      <span className="absolute top-[58%] left-[55%] size-1.5 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,.9)]" />
    </div>
  );
}
