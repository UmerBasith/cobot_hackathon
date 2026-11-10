/** ResQNet API calls. Reads always go through withFallback; mutations throw so the UI can show an error toast. */
import { api, withFallback } from "./api";
import {
  mockAlerts, mockEscalations, mockSuggest, mockTeams,
  type Alert, type AlertLevel, type Escalation, type ResponderJob, type Similar, type SuggestSlot, type Team,
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

/* Round 2 */
const enc = encodeURIComponent;
export const getTeams = () => withFallback(api.get<Team[]>("/teams"), mockTeams);
export const getSuggest = (inc: Incident) => withFallback(api.get<SuggestSlot[]>(`/incidents/${enc(inc.id)}/suggest`), mockSuggest(inc));
export const getSimilar = (id: string) => withFallback(api.get<Similar[]>(`/incidents/${enc(id)}/similar`), [] as Similar[]);
export const getEscalations = () => withFallback(api.get<Escalation[]>("/escalations"), mockEscalations);
export const getActiveAlerts = (area = "") => withFallback(api.get<Alert[]>(`/alerts/active${area ? `?area=${enc(area)}` : ""}`), mockAlerts);
export const getResponderJobs = (teamId: string) => withFallback(api.get<ResponderJob[]>(`/responder/${enc(teamId)}`), [] as ResponderJob[]);
export const assignTeams = (id: string, team_ids: string[]) => api.post<Incident>(`/incidents/${enc(id)}/assign`, { team_ids });
export const respondAssignment = (id: string, accept: boolean, reason = "") => api.post<Incident>(`/assignments/${enc(id)}/respond`, { accept, reason });
export const assignmentStatus = (id: string, status: "en_route" | "on_scene" | "completed", note = "") => api.post<Incident>(`/assignments/${enc(id)}/status`, { status, note });
export const createAlert = (a: { area: string; message: string; level: AlertLevel; hours: number }) => api.post<Alert>("/alerts", a);
export const simulateFlood = () => api.post<{ ok: boolean; created: string[] }>("/simulate", { scenario: "chennai_flood" });
export const resetDemo = () => api.post<{ ok: boolean; incidents: number }>("/reset");

/** Readable error text from api.ts errors ("409 Conflict: {"detail":"..."}"). */
export function errText(e: unknown) {
  const s = String(e instanceof Error ? e.message : e);
  const m = s.match(/"detail"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  if (/Failed to fetch|abort|NetworkError|50\d/.test(s)) return "Server not reachable.";
  return s.slice(0, 120);
}

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
