import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { Card } from "./core";
import { CountUp } from "./motion";

/* -------------------------------- StatTile --------------------------------- */
export function StatTile({ label, value, decimals = 0, prefix, suffix, delta, icon: Icon, spark, className }: {
  label: string; value: number; decimals?: number; prefix?: string; suffix?: string;
  /** e.g. +12.5 (shown green) or -3 (shown red) */
  delta?: number; icon?: LucideIcon; spark?: number[]; className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        {Icon && <Icon className="size-4 text-muted" />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-display text-3xl font-semibold">
          <CountUp to={value} decimals={decimals} prefix={prefix} suffix={suffix} />
        </p>
        {spark && <Sparkline data={spark} className="h-9 w-24" />}
      </div>
      {delta !== undefined && (
        <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(delta)}% <span className="text-muted font-normal">vs last period</span>
        </p>
      )}
    </Card>
  );
}

/* -------------------------------- Sparkline -------------------------------- */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const { line, area } = useMemo(() => {
    const min = Math.min(...data), max = Math.max(...data);
    const pts = data.map((d, i) => [(i / (data.length - 1)) * 100, 30 - ((d - min) / (max - min || 1)) * 26 - 2]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    return { line, area: `${line} L100,32 L0,32 Z` };
  }, [data]);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <motion.path d={line} fill="none" stroke="var(--color-brand-500)" strokeWidth="2" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
    </svg>
  );
}

/* -------------------------------- RingGauge -------------------------------- */
/** Circular score 0-100. Colour shifts green -> amber -> red if `danger` is set. */
export function RingGauge({ value, label, size = 140, danger = false, sub }: {
  value: number; label?: string; size?: number; danger?: boolean; sub?: ReactNode;
}) {
  const r = 52, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = danger
    ? v > 66 ? "#ef4444" : v > 33 ? "#f59e0b" : "#10b981"
    : "var(--color-brand-500)";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="-rotate-90" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-3xl font-semibold tabular-nums">{Math.round(v)}</p>
        {label && <p className="text-xs text-muted">{label}</p>}
        {sub}
      </div>
    </div>
  );
}

/* -------------------------------- DataTable -------------------------------- */
export interface Column<T> {
  key: keyof T & string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  sortable?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({ columns, rows, empty = "No data yet", maxHeight }: {
  columns: Column<T>[]; rows: T[]; empty?: string; maxHeight?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      return (x! > y! ? 1 : x! < y! ? -1 : 0) * sort.dir;
    });
  }, [rows, sort]);

  return (
    <div className="overflow-auto rounded-xl border border-line" style={{ maxHeight }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-3 font-medium whitespace-nowrap", c.align === "right" && "text-right")}>
                {c.sortable !== false ? (
                  <button className="inline-flex items-center gap-1 hover:text-fg cursor-pointer"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                    {c.label}<ChevronsUpDown className="size-3" />
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-muted">{empty}</td></tr>
          )}
          {sorted.map((row, i) => (
            <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
              className="bg-surface hover:bg-surface-2/60 transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 whitespace-nowrap", c.align === "right" && "text-right tabular-nums")}>
                  {c.render ? c.render(row) : String(row[c.key] ?? "")}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
