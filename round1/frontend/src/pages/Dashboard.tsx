import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Database, FileSpreadsheet, Gauge, RefreshCw, Sparkles, Target } from "lucide-react";
import { api, withFallback } from "@/lib/api";
import { mockOverview, mockPredict, type AnalyzeOut, type Overview, type PredictIn, type PredictOut, type RecordRow } from "@/lib/mock";
import {
  AreaChartBox, Badge, Button, Card, CardBody, CardHeader, ChartLegend, DataTable, DonutChartBox, FileDrop,
  ProgressBar, RingGauge, Skeleton, Slider, StatTile, statusColors, useToast, type Column,
} from "@/ui";
import { PageIntro } from "@/sections/AppShell";
import { STATIC } from "@/lib/static";

const statusTone = { Healthy: "green", Watch: "amber", Critical: "red" } as const;

const columns: Column<RecordRow>[] = [
  { key: "id", label: "ID", render: (r) => <span className="font-mono text-xs text-muted">{r.id}</span> },
  { key: "name", label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
  { key: "category", label: "Category" },
  { key: "score", label: "Risk", align: "right", render: (r) => (
    <div className="flex items-center justify-end gap-2"><ProgressBar value={r.score} tone={r.score > 66 ? "red" : r.score > 33 ? "amber" : "green"} className="w-20" />{r.score}</div>
  ) },
  { key: "status", label: "Status", render: (r) => <Badge tone={statusTone[r.status]} dot>{r.status}</Badge> },
  { key: "updated", label: "Updated", render: (r) => <span className="text-muted">{r.updated}</span> },
];

export default function Dashboard() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [input, setInput] = useState<PredictIn>({ temperature: 72, vibration: 4.2, load: 65, hours: 3200 });
  const [result, setResult] = useState<PredictOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeOut | null>(null);

  const load = () => withFallback(api.get<Overview>("/overview"), mockOverview).then(setData);
  useEffect(() => { load(); if (STATIC) predict(); }, []); // screenshot mode shows a filled result

  async function predict() {
    setBusy(true);
    const r = await withFallback(api.post<PredictOut>("/predict", input), mockPredict(input));
    setResult(r); setBusy(false);
    toast(r.label === "High" ? "warning" : "success", `Risk: ${r.label} (${r.score}/100)`, r.recommendation);
  }

  async function analyze(f: File | null) {
    setFile(f); setAnalysis(null);
    if (!f) return;
    try { setAnalysis(await api.upload<AnalyzeOut>("/analyze", f)); toast("success", "File analysed", f.name); }
    catch (e) { toast("error", "Could not analyse file", String(e).slice(0, 80)); }
  }

  return (
    <>
      <PageIntro title="Overview" text="Live status, predictions and analysis in one place."
        actions={<Button variant="outline" icon={RefreshCw} onClick={() => { setData(null); load(); }}>Refresh</Button>} />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (<>
          <StatTile label="Items monitored" value={data.kpis.total} icon={Database} delta={8.2} spark={data.series.map((s) => s.actual).slice(-12)} />
          <StatTile label="Average risk" value={data.kpis.risk_avg} decimals={1} icon={Gauge} delta={-4.1} />
          <StatTile label="Open alerts" value={data.kpis.alerts} icon={AlertTriangle} delta={-12} />
          <StatTile label="Model accuracy" value={data.kpis.accuracy} decimals={1} suffix="%" icon={Target} delta={1.3} />
        </>) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Actual vs predicted" subtitle="Last 24 hours" icon={Activity} action={<Badge tone="brand">AI forecast</Badge>} />
          <CardBody>{data ? <AreaChartBox data={data.series as unknown as Record<string, unknown>[]} x="t" series={[{ key: "actual", label: "Actual" }, { key: "predicted", label: "Predicted" }]} /> : <Skeleton className="h-[280px]" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Status breakdown" subtitle="Share of items" />
          <CardBody>
            {data ? (<>
              <DonutChartBox colors={statusColors} data={data.breakdown as unknown as Record<string, unknown>[]} center={{ value: String(data.kpis.total), label: "items" }} />
              <div className="mt-4"><ChartLegend colors={statusColors} items={data.breakdown.map((b) => ({ label: b.name, value: `${b.value}%` }))} /></div>
            </>) : <Skeleton className="h-[300px]" />}
          </CardBody>
        </Card>
      </div>

      {/* Prediction */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Run a prediction" subtitle="Move the sliders, then predict" icon={Sparkles} />
          <CardBody className="space-y-5">
            <Slider label="Temperature" unit=" °C" min={20} max={120} value={input.temperature} onChange={(v) => setInput({ ...input, temperature: v })} />
            <Slider label="Vibration" unit=" mm/s" min={0} max={10} step={0.1} value={input.vibration} onChange={(v) => setInput({ ...input, vibration: v })} />
            <Slider label="Load" unit=" %" min={0} max={100} value={input.load} onChange={(v) => setInput({ ...input, load: v })} />
            <Slider label="Run hours" unit=" h" min={0} max={8000} step={100} value={input.hours} onChange={(v) => setInput({ ...input, hours: v })} />
            <Button className="w-full" size="lg" icon={Sparkles} loading={busy} onClick={predict}>Predict risk</Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Result" subtitle="Score, confidence and why" icon={Gauge} />
          <CardBody>
            {result ? (
              <div className="flex flex-col items-center gap-6 xl:flex-row xl:items-start">
                <RingGauge value={result.score} label={`${result.label} risk`} danger size={160} />
                <div className="w-full flex-1 space-y-3">
                  <p className="text-sm text-muted">Confidence <span className="font-medium text-fg">{Math.round(result.confidence * 100)}%</span></p>
                  {result.factors.map((f) => (
                    <div key={f.name}>
                      <div className="mb-1 flex justify-between text-sm"><span>{f.name}</span><span className="text-muted">{f.impact}</span></div>
                      <ProgressBar value={Math.min(100, f.impact)} />
                    </div>
                  ))}
                  <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200"><b>Next step:</b> {result.recommendation}</div>
                </div>
              </div>
            ) : (
              <div className="grid h-full min-h-64 place-items-center text-center text-sm text-muted"><p>Set the inputs and press <b className="text-fg">Predict risk</b>.</p></div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Table + upload */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Live records" subtitle="Click a column to sort" icon={Database} />
          <CardBody>{data ? <DataTable columns={columns} rows={data.records} maxHeight={360} /> : <Skeleton className="h-60" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Analyse your data" subtitle="Upload a CSV" icon={FileSpreadsheet} />
          <CardBody className="space-y-4">
            <FileDrop file={file} onFile={analyze} accept=".csv" hint="CSV up to 10 MB" />
            {analysis && (
              <div className="space-y-2 text-sm">
                <p><b>{analysis.rows}</b> rows · <b>{analysis.columns.length}</b> columns</p>
                {analysis.summary.slice(0, 5).map((s) => (
                  <div key={s.column} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                    <span className="truncate font-medium">{s.column}</span>
                    <span className="text-muted">{s.mean !== null ? `avg ${s.mean.toFixed(2)}` : "text"}{s.missing ? ` · ${s.missing} missing` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
