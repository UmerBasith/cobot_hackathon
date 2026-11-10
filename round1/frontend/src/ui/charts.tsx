/**
 * Chart wrappers on recharts, already themed. Data is an array of objects:
 *   <AreaChartBox data={rows} x="time" series={[{ key: "value", label: "Load" }]} />
 */
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { STATIC } from "@/lib/static";

export const chartColors = [
  "var(--color-brand-500)",
  "var(--color-accent-500)",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#64748b",
];

/** Semantic colours: good / warning / bad. */
export const statusColors = ["#10b981", "#f59e0b", "#ef4444"];

export interface Series { key: string; label?: string; color?: string }

const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
    boxShadow: "0 8px 24px -8px rgb(0 0 0 / .15)", fontSize: 12, color: "var(--fg)",
  },
  labelStyle: { color: "var(--muted)", marginBottom: 4 },
  cursor: { stroke: "var(--line)", fill: "var(--surface-2)" },
};

type Row = Record<string, unknown>;

export function AreaChartBox({ data, x, series, height = 280, stacked = false }: { data: Row[]; x: string; series: Series[]; height?: number; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color ?? chartColors[i]} stopOpacity={0.35} />
              <stop offset="1" stopColor={s.color ?? chartColors[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey={x} {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stackId={stacked ? "1" : undefined}
            stroke={s.color ?? chartColors[i]} strokeWidth={2.2} fill={`url(#area-${s.key})`} animationDuration={1200} isAnimationActive={!STATIC} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineChartBox({ data, x, series, height = 280 }: { data: Row[]; x: string; series: Series[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey={x} {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltipStyle} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={s.color ?? chartColors[i]}
            strokeWidth={2.4} dot={false} activeDot={{ r: 5 }} animationDuration={1200} isAnimationActive={!STATIC} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarChartBox({ data, x, series, height = 280, horizontal = false, stacked = false }: { data: Row[]; x: string; series: Series[]; height?: number; horizontal?: boolean; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: horizontal ? 24 : -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? <><XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey={x} {...axis} width={90} /></>
                    : <><XAxis dataKey={x} {...axis} /><YAxis allowDecimals={false} {...axis} /></>}
        <Tooltip {...tooltipStyle} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={s.color ?? chartColors[i]} stackId={stacked ? "s" : undefined}
            radius={stacked && i < series.length - 1 ? [0, 0, 0, 0] : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={42} animationDuration={1000} isAnimationActive={!STATIC} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChartBox({ data, nameKey = "name", valueKey = "value", height = 240, center, colors = chartColors }: {
  data: Row[]; nameKey?: string; valueKey?: string; height?: number; center?: { value: string; label: string };
  /** Optional fixed colours, e.g. statusColors for Healthy/Watch/Critical. */
  colors?: string[];
}) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tooltipStyle} />
          <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="62%" outerRadius="88%" paddingAngle={3}
            stroke="none" animationDuration={1000} isAnimationActive={!STATIC}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-semibold">{center.value}</p>
            <p className="text-xs text-muted">{center.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ items, colors = chartColors }: { items: { label: string; value?: string }[]; colors?: string[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((it, i) => (
        <li key={it.label} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
            {it.label}
          </span>
          {it.value && <span className="font-medium tabular-nums">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}
