/** Shared ResQNet bits: category meta, severity/status badges, reasons list, Call 112 button. */
import {
  AlertTriangle, Building2, CarFront, Flame, HeartPulse, Mountain, Phone, Waves, Wind, Zap, type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui";
import { CATEGORY_LABEL, type Category, type Reason, type Severity, type Status } from "@/lib/mock";
import { STATIC } from "@/lib/static";

export const CATEGORY_META: Record<Category, { icon: LucideIcon; label: string; short: string; tile: string; soft: string }> = {
  fire: { icon: Flame, label: CATEGORY_LABEL.fire, short: "Fire", tile: "from-orange-500 to-red-600", soft: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300" },
  road_accident: { icon: CarFront, label: CATEGORY_LABEL.road_accident, short: "Road accident", tile: "from-slate-600 to-slate-800", soft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  medical: { icon: HeartPulse, label: CATEGORY_LABEL.medical, short: "Medical", tile: "from-rose-500 to-pink-600", soft: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300" },
  flood: { icon: Waves, label: CATEGORY_LABEL.flood, short: "Flood", tile: "from-sky-500 to-blue-700", soft: "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300" },
  building_collapse: { icon: Building2, label: CATEGORY_LABEL.building_collapse, short: "Building collapse", tile: "from-stone-500 to-amber-800", soft: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200" },
  gas_leak: { icon: Wind, label: CATEGORY_LABEL.gas_leak, short: "Gas leak", tile: "from-lime-500 to-emerald-700", soft: "bg-lime-50 text-lime-700 dark:bg-lime-950 dark:text-lime-300" },
  landslide: { icon: Mountain, label: CATEGORY_LABEL.landslide, short: "Landslide", tile: "from-amber-600 to-orange-800", soft: "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  electrical: { icon: Zap, label: CATEGORY_LABEL.electrical, short: "Power outage", tile: "from-amber-400 to-yellow-600", soft: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300" },
  other: { icon: AlertTriangle, label: CATEGORY_LABEL.other, short: "Other", tile: "from-violet-500 to-indigo-700", soft: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300" },
};
export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const ZONE_HEX: Record<"critical" | "evacuate" | "watch" | "safe", string> = { critical: "#dc2626", evacuate: "#ea580c", watch: "#d97706", safe: "#16a34a" };
export const SEV_HEX: Record<Severity, string> = { Critical: "#dc2626", High: "#ea580c", Medium: "#d97706", Low: "#16a34a" };
export const SEV_TONE: Record<Severity, "red" | "amber" | "green" | "brand"> = { Critical: "red", High: "brand", Medium: "amber", Low: "green" };
export const STATUS_TONE: Record<Status, "gray" | "amber" | "blue" | "green" | "indigo"> = { Reported: "gray", Pending: "amber", Assigned: "indigo", "In Progress": "blue", Resolved: "green" };
export const STATUS_HEX: Record<Status, string> = { Reported: "#94a3b8", Pending: "#f59e0b", Assigned: "#6366f1", "In Progress": "#0ea5e9", Resolved: "#10b981" };
export const STATUS_DOT: Record<Status, string> = { Reported: "bg-red-500", Pending: "bg-amber-500", Assigned: "bg-indigo-500", "In Progress": "bg-sky-500", Resolved: "bg-emerald-500" };

/** Official Round 2 "Intelligent prioritisation" chip: priority score + time waiting. */
export function PriorityChip({ inc, className }: { inc: { priority_score?: number; score: number; waiting_min?: number; created_at: string; status: Status }; className?: string }) {
  const waiting = inc.waiting_min ?? Math.max(0, (Date.now() - new Date(inc.created_at).getTime()) / 60000);
  const open = inc.status === "Reported" || inc.status === "Pending";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[11px]", className)}>
      <span className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800" title="Priority score = severity score + time-since-report bonus">P {(inc.priority_score ?? inc.score).toFixed(1)}</span>
      {open && <span className={cn("font-medium", waiting >= 15 ? "text-red-600 dark:text-red-400" : "text-muted")}>waiting {Math.round(waiting)} min</span>}
    </span>
  );
}

export function RankExplainer({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] text-muted", className)}>
      <span className="font-semibold text-ink">Ranked by:</span> severity · people · time waiting · category
    </p>
  );
}

const sevPill: Record<Severity, string> = {
  Critical: "bg-red-600 text-white ring-red-700",
  High: "bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
  Medium: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  Low: "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
};

export function SeverityBadge({ severity, score, className, size = "sm" }: { severity: Severity; score?: number; className?: string; size?: "sm" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap",
      size === "lg" ? "px-3.5 py-1 text-sm" : "px-2.5 py-0.5 text-xs", sevPill[severity], className)}>
      <span className="relative flex size-1.5">
        {severity === "Critical" && !STATIC && <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", severity === "Critical" ? "bg-white" : "")} style={severity !== "Critical" ? { background: SEV_HEX[severity] } : undefined} />
      </span>
      {severity}{score !== undefined && <span className="font-mono opacity-80">· {score}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]} dot pulse={status === "In Progress"}>{status}</Badge>;
}

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const m = CATEGORY_META[category] ?? CATEGORY_META.other;
  return <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", m.soft, className)}><m.icon className="size-[18px]" /></span>;
}

export function ReasonsList({ reasons, compact }: { reasons: Reason[]; compact?: boolean }) {
  const max = Math.max(35, ...reasons.map((r) => r.points));
  return (
    <ul className={cn("space-y-2", compact && "space-y-1.5")}>
      {reasons.map((r, i) => (
        <motion.li key={r.label + i} initial={STATIC ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
          className={cn("flex items-center gap-3 rounded-xl px-3 text-sm", compact ? "py-1.5" : "py-2", r.rule ? "bg-red-50 ring-1 ring-red-200 dark:bg-red-950/50 dark:ring-red-900" : "bg-surface-2")}>
          {r.rule ? (
            <span className="shrink-0 rounded-md bg-red-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">{r.rule}</span>
          ) : (
            <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(r.points / max) * 100}%` }} />
            </span>
          )}
          <span className="min-w-0 flex-1">{r.label}</span>
          {r.points > 0 && <span className="shrink-0 font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">+{r.points}</span>}
        </motion.li>
      ))}
    </ul>
  );
}

export function Call112({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <a href="tel:112" className={cn("inline-flex items-center gap-2 rounded-xl bg-red-600 font-semibold text-white shadow-[0_8px_24px_-8px_rgb(220_38_38/0.7)] transition hover:bg-red-500",
      compact ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm", className)}>
      <span className="relative grid place-items-center">
        {!STATIC && <span className="absolute size-4 animate-ping rounded-full bg-white/40" />}
        <Phone className="relative size-4" />
      </span>
      Call 112
    </a>
  );
}
