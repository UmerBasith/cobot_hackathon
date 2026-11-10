/** ResQNet API calls. Reads always go through withFallback; mutations throw so the UI can show an error toast. */
import { api, withFallback } from "./api";
import {
  computeStats, localSeverity, mockIncidents, sortIncidents,
  type Incident, type ReportIn, type SeverityOut, type Stats, type Status,
} from "./mock";

export const getIncidents = (q = "") => withFallback(api.get<Incident[]>(`/incidents${q}`), mockIncidents);
export const getIncident = (id: string) =>
  withFallback(api.get<Incident>(`/incidents/${encodeURIComponent(id)}`), mockIncidents.find((i) => i.id === id) ?? null);
export const getStats = () => withFallback(api.get<Stats>("/stats"), computeStats(mockIncidents));
export const previewSeverity = (r: ReportIn) => withFallback(api.post<SeverityOut>("/severity/preview", r), localSeverity(r));

export const createIncident = (r: ReportIn) => api.post<Incident>("/incidents", r);
export const updateStatus = (id: string, status: Status, note?: string) =>
  request("PATCH", `/incidents/${encodeURIComponent(id)}/status`, { status, note });
export const markDuplicate = (id: string, of: string) => api.post<Incident>(`/incidents/${encodeURIComponent(id)}/duplicate`, { duplicate_of: of });
export const deleteIncident = (id: string) => api.del<{ deleted: string }>(`/incidents/${encodeURIComponent(id)}`);

async function request(method: string, path: string, body: unknown): Promise<Incident> {
  const res = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
  return res.json();
}

export { sortIncidents };

export const timeAgo = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ${m % 60} min ago` : `${Math.floor(h / 24)} d ago`;
};
