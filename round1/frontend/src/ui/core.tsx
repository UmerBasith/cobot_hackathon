import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------------------------------- Button --------------------------------- */
type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-500 shadow-glow hover:-translate-y-0.5 active:translate-y-0",
  secondary: "bg-fg text-bg hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0",
  outline: "border border-line bg-surface hover:bg-surface-2 text-fg",
  ghost: "hover:bg-surface-2 text-fg",
  danger: "bg-red-600 text-white hover:bg-red-500",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon: Icon, iconRight: IconRight, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none",
        "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4" /> : null}
    </button>
  );
});

/* ----------------------------------- Card ---------------------------------- */
export function Card({ className, hover, ...rest }: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-soft",
        hover && "transition-all duration-300 hover:-translate-y-1 hover:shadow-glow hover:border-brand-300",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }: {
  title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: LucideIcon; className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
            <Icon className="size-[18px]" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight truncate">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5", className)} {...rest} />
);

/* ----------------------------------- Badge --------------------------------- */
type Tone = "brand" | "green" | "amber" | "red" | "gray" | "blue" | "indigo";
const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  blue: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900",
  gray: "bg-surface-2 text-muted ring-line",
};
const dotTones: Record<Tone, string> = {
  brand: "bg-brand-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-sky-500", indigo: "bg-indigo-500", gray: "bg-muted",
};

export function Badge({ tone = "brand", dot, pulse, className, children }: {
  tone?: Tone; dot?: boolean; pulse?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", dotTones[tone])} />}
          <span className={cn("relative inline-flex size-1.5 rounded-full", dotTones[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

/* ---------------------------------- Inputs --------------------------------- */
const fieldBase =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg placeholder:text-muted/70 transition focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2.5 resize-y", className)} {...rest} />;
});

export function Select({ className, options, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select className={cn(fieldBase, "h-10 cursor-pointer", className)} {...rest}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, unit = "" }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label?: string; unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="font-medium">{label}</span>
          <span className="font-mono text-brand-600 dark:text-brand-300">{value}{unit}</span>
        </div>
      )}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--color-brand-600)]"
        style={{ background: `linear-gradient(to right, var(--color-brand-500) ${pct}%, var(--surface-2) ${pct}%)` }}
      />
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 cursor-pointer">
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-line")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}

/* ------------------------------ Feedback bits ------------------------------ */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton rounded-lg", className)} />;

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("size-5 animate-spin text-brand-500", className)} />;

export function ProgressBar({ value, tone = "brand", className }: { value: number; tone?: "brand" | "green" | "amber" | "red"; className?: string }) {
  const color = { brand: "bg-brand-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700 ease-out", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line p-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {text && <p className="mt-1 text-sm text-muted max-w-sm">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, highlight, text, center = true }: {
  eyebrow?: string; title: string; highlight?: string; text?: string; center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">{eyebrow}</p>}
      <h2 className="text-3xl font-semibold sm:text-4xl">
        {title} {highlight && <span className="text-gradient">{highlight}</span>}
      </h2>
      {text && <p className="mt-4 text-lg text-muted">{text}</p>}
    </div>
  );
}
