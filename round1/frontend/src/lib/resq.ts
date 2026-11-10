/** ResQNet API calls. Reads always go through withFallback; mutations throw so the UI can show an error toast. */
import { api, withFallback } from "./api";
import {
  mockAlerts, mockEscalations, mockSuggest, mockTeams, mockTrack, mockZones, mockShelters, mockAnalytics,
  type TrackOut, type Zone, type ZoneStatus, type Shelter, type Analytics,
  type Alert, type AlertLevel, type TeamStatus, type TeamType, type Escalation, type ResponderJob, type Similar, type SuggestSlot, type Team,
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
/** Responder quick actions: field situation report, and escalation (needs more help). */
export type FieldTag = "situation" | "contained" | "rescued" | "need_time" | "casualty";
export type NeedType = "fire" | "rescue" | "ambulance" | "police" | "ndrf" | "boat" | "hazmat" | "power";
export const fieldUpdate = (id: string, note: string, tag: FieldTag = "situation") => api.post<Incident>(`/assignments/${enc(id)}/update`, { note, tag });
export const escalateAssignment = (id: string, reason: string, needs: NeedType[], note = "") => api.post<Incident>(`/assignments/${enc(id)}/escalate`, { reason, needs, note });
export const createAlert = (a: { area: string; message: string; level: AlertLevel; hours: number }) => api.post<Alert>("/alerts", a);
export const simulateFlood = () => api.post<{ ok: boolean; created: string[] }>("/simulate", { scenario: "chennai_flood" });
export const resetDemo = () => api.post<{ ok: boolean; incidents: number }>("/reset");

/* Round 2 official: team management, auto-assign, routes */
export type TeamIn = { name: string; type: TeamType; station: string; lat?: number; lng?: number; crew?: number };
export type TeamPatch = Partial<Pick<Team, "name" | "station" | "lat" | "lng" | "crew">> & { status?: TeamStatus };
export const createTeam = (t: TeamIn) => api.post<Team>("/teams", t);
export const patchTeam = (id: string, body: TeamPatch) => patch<Team>(`/teams/${enc(id)}`, body);
export const deleteTeam = (id: string) => api.del<{ deleted: string }>(`/teams/${enc(id)}`);
export const autoAssign = (id: string) => api.post<Incident>(`/incidents/${enc(id)}/auto-assign`, {});
export interface RouteOut { source: string; distance_km: number; duration_min: number; coords: [number, number][] }
const R_KM = (a: number, b: number, c: number, d: number) => {
  const R = 6371, dLat = ((c - a) * Math.PI) / 180, dLng = ((d - b) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
export const getRoute = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const km = +(R_KM(fromLat, fromLng, toLat, toLng) * 1.3).toFixed(1);
  return withFallback(api.get<RouteOut>(`/route?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`),
    { source: "straight line (offline)", distance_km: km, duration_min: +(2 + (km / 25) * 60).toFixed(1), coords: [[fromLat, fromLng], [toLat, toLng]] } as RouteOut);
};

/* §11 */
export const getTrack = (id: string): Promise<TrackOut | null> =>
  api.get<TrackOut>(`/track/${enc(id)}`).catch((e) => (String(e).includes("404") ? null : mockTrack(id)));
export const getZones = () => withFallback(api.get<Zone[]>("/zones"), mockZones);
export const getShelters = () => withFallback(api.get<Shelter[]>("/shelters"), mockShelters);
export const getAnalytics = () => withFallback(api.get<Analytics>("/analytics"), mockAnalytics());
export const updateZone = (area: string, status: ZoneStatus, note: string) => patch<Zone>(`/zones/${enc(area)}`, { status, note });
export const updateShelter = (id: string, occupancy: number) => patch<Shelter>(`/shelters/${enc(id)}`, { occupancy });

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text().catch(() => "")}`.slice(0, 300));
  return res.json();
}

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
