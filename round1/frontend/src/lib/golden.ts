/** Golden Hour Engine + CPR Hero Network API (BRIEF §12). Reads use withFallback; mutations throw (UI shows a toast). */
import { api, withFallback } from "./api";
import {
  mockGHSimulation, mockGoldenHour, mockIncidentHeroes, mockSurvival,
  type GHApplyOut, type GHSimulation, type GoldenHour, type Incident, type IncidentHeroes, type SurvivalOut,
} from "./mock";

const enc = encodeURIComponent;
export const getGoldenHour = () => withFallback(api.get<GoldenHour>("/golden-hour"), mockGoldenHour);
export const getGHSimulation = () => withFallback(api.get<GHSimulation>("/golden-hour/simulation"), mockGHSimulation);
export const applyGoldenHour = () => api.post<GHApplyOut>("/golden-hour/apply");
export const getSurvival = (id: string) => withFallback(api.get<SurvivalOut>(`/incidents/${enc(id)}/survival`), mockSurvival(id));
export const getIncidentHeroes = (id: string) => withFallback(api.get<IncidentHeroes>(`/incidents/${enc(id)}/heroes`), mockIncidentHeroes(id));
export const alertHeroes = (id: string, count = 3) =>
  api.post<{ alerted: string[]; incident: Incident }>(`/incidents/${enc(id)}/heroes/alert?count=${count}`);

/** Survival 0-1 → colour on a green → amber → red scale. */
export function survColor(p: number) {
  const h = Math.round(Math.max(0, Math.min(1, (p - 0.2) / 0.7)) * 140);
  return `hsl(${h} 72% 42%)`;
}
/** Lives lost per minute: 3 decimals when tiny so rows never all read 0.00. */
export const fmtLoss = (v: number) => (v >= 0.1 ? v.toFixed(2) : v.toFixed(3));
export const pct = (p: number) => `${Math.round(p * 100)}%`;
