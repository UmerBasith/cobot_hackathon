import { useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { FileUp, FileCheck2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ----------------------------------- Tabs ---------------------------------- */
export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { value: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cn("relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            value === t.value ? "text-fg" : "text-muted hover:text-fg")}>
          {value === t.value && (
            <motion.span layoutId={`tab-pill-${tabs.map((x) => x.value).join("")}`} className="absolute inset-0 rounded-lg bg-surface shadow-soft"
              transition={{ type: "spring", stiffness: 400, damping: 34 }} />
          )}
          <span className="relative inline-flex items-center gap-1.5">{t.icon && <t.icon className="size-4" />}{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- FileDrop -------------------------------- */
export function FileDrop({ onFile, accept = ".csv,.xlsx,.json,.txt,.png,.jpg", hint = "CSV, Excel, JSON or image", file }: {
  onFile: (f: File | null) => void; accept?: string; hint?: string; file?: File | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-300 bg-brand-50/60 p-4 dark:bg-brand-900/20">
        <FileCheck2 className="size-6 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button onClick={() => onFile(null)} className="rounded-lg p-1 text-muted hover:bg-surface-2 cursor-pointer" aria-label="Remove"><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <div
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        over ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-line hover:border-brand-300 hover:bg-surface-2/50")}
    >
      <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><FileUp className="size-5" /></div>
      <p className="text-sm font-medium">Drop a file here or <span className="text-brand-600 dark:text-brand-300">browse</span></p>
      <p className="text-xs text-muted">{hint}</p>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </div>
  );
}

/* --------------------------------- Timeline -------------------------------- */
export function Timeline({ items }: { items: { title: string; time?: string; text?: ReactNode; tone?: "brand" | "green" | "amber" | "red" }[] }) {
  const dot = { brand: "bg-brand-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {items.map((it, i) => (
        <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="relative">
          <span className={cn("absolute -left-[29px] top-1.5 size-2.5 rounded-full ring-4 ring-surface", dot[it.tone ?? "brand"])} />
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">{it.title}</p>
            {it.time && <span className="shrink-0 font-mono text-xs text-muted">{it.time}</span>}
          </div>
          {it.text && <div className="mt-0.5 text-sm text-muted">{it.text}</div>}
        </motion.li>
      ))}
    </ol>
  );
}

/* --------------------------------- Stepper --------------------------------- */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-2 last:flex-none">
          <div className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
            i < current ? "bg-brand-600 text-white" : i === current ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500 dark:bg-brand-900/50 dark:text-brand-200" : "bg-surface-2 text-muted")}>
            {i + 1}
          </div>
          <span className={cn("hidden text-sm sm:inline", i === current ? "font-medium" : "text-muted")}>{s}</span>
          {i < steps.length - 1 && <div className={cn("h-px flex-1 transition-colors", i < current ? "bg-brand-500" : "bg-line")} />}
        </div>
      ))}
    </div>
  );
}
