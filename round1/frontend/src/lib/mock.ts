/**
 * Fallback data used when the backend is not reachable (demo safety) and
 * the TYPES shared with the backend. Keep these in sync with backend/app/schemas.py.
 */
export interface Kpis { total: number; risk_avg: number; alerts: number; accuracy: number }
export interface SeriesPoint { t: string; actual: number; predicted: number }
export interface Slice { name: string; value: number }
export interface RecordRow { id: string; name: string; category: string; score: number; status: "Healthy" | "Watch" | "Critical"; updated: string; [k: string]: unknown }
export interface Overview { kpis: Kpis; series: SeriesPoint[]; breakdown: Slice[]; records: RecordRow[] }

export interface PredictIn { temperature: number; vibration: number; load: number; hours: number }
export interface Factor { name: string; impact: number }
export interface PredictOut { score: number; label: "Low" | "Medium" | "High"; confidence: number; factors: Factor[]; recommendation: string }

export interface AnalyzeOut { rows: number; columns: string[]; summary: { column: string; mean: number | null; min: number | null; max: number | null; missing: number }[]; preview: Record<string, unknown>[] }

const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

export const mockOverview: Overview = {
  kpis: { total: 1284, risk_avg: 23.6, alerts: 7, accuracy: 94.2 },
  series: hours.map((t, i) => {
    const base = 40 + 18 * Math.sin(i / 3.5) + i * 0.8;
    return { t, actual: Math.round(base + (i % 5) * 2), predicted: Math.round(base + 1.5) };
  }),
  breakdown: [
    { name: "Healthy", value: 68 },
    { name: "Watch", value: 22 },
    { name: "Critical", value: 10 },
  ],
  records: [
    { id: "U-101", name: "Robot arm A", category: "Assembly", score: 12, status: "Healthy", updated: "2 min ago" },
    { id: "U-102", name: "Conveyor 3", category: "Transport", score: 48, status: "Watch", updated: "5 min ago" },
    { id: "U-103", name: "Welding cell", category: "Assembly", score: 81, status: "Critical", updated: "just now" },
    { id: "U-104", name: "Picker bot 2", category: "Logistics", score: 22, status: "Healthy", updated: "9 min ago" },
    { id: "U-105", name: "Paint unit", category: "Finishing", score: 57, status: "Watch", updated: "12 min ago" },
    { id: "U-106", name: "AGV 7", category: "Logistics", score: 9, status: "Healthy", updated: "15 min ago" },
  ],
};

/** Simple local version of the model so the demo works even offline. */
export function mockPredict(x: PredictIn): PredictOut {
  const z = 0.06 * (x.temperature - 60) + 0.9 * (x.vibration - 3) + 0.03 * (x.load - 50) + 0.0004 * (x.hours - 2000);
  const score = Math.round(100 / (1 + Math.exp(-z)));
  const label = score > 66 ? "High" : score > 33 ? "Medium" : "Low";
  return {
    score, label, confidence: 0.88,
    factors: [
      { name: "Vibration", impact: Math.round(Math.abs(0.9 * (x.vibration - 3)) * 20) },
      { name: "Temperature", impact: Math.round(Math.abs(0.06 * (x.temperature - 60)) * 20) },
      { name: "Load", impact: Math.round(Math.abs(0.03 * (x.load - 50)) * 20) },
      { name: "Run hours", impact: Math.round(Math.abs(0.0004 * (x.hours - 2000)) * 20) },
    ].sort((a, b) => b.impact - a.impact),
    recommendation: label === "High" ? "Stop and inspect within 1 hour." : label === "Medium" ? "Schedule a check this shift." : "No action needed.",
  };
}
