/**
 * ResQNet shared types (BRIEF §5 API contract) + realistic fallback data.
 * The fallback severity engine mirrors the backend rules (BRIEF §6) so the demo
 * stays correct even if the API is down.
 */
import { areaByName } from "./geo";

export type Category = "fire" | "road_accident" | "medical" | "flood" | "building_collapse" | "gas_leak" | "electrical" | "landslide" | "other";
export type Severity = "Low" | "Medium" | "High" | "Critical";
export type Status = "Reported" | "Pending" | "In Progress" | "Resolved";
export type Injuries = "none" | "minor" | "serious";
export type Hazard = "small" | "medium" | "large" | "spreading";
export type Vulnerable = "children" | "elderly" | "patients" | "disabled" | "pregnant";

export interface ReportIn {
  title: string; description: string; category: Category;
  area: string; lat?: number | null; lng?: number | null; landmark?: string;
  people_affected: number; injured_count: number; injuries: Injuries; life_threat: boolean;
  hazard: Hazard; active: boolean; vulnerable: Vulnerable[];
  contact_name?: string; contact_phone?: string;
  reported_severity?: Severity | null; anonymous?: boolean; photo?: string | null;
}

export interface Reason { label: string; points: number; rule: string | null }

export interface SeverityOut {
  score: number; severity: Severity; reasons: Reason[];
  place_type: string; place_name: string | null; flags: string[];
}

export interface TimelineEntry { at: string; status: Status; note: string; actor: string }

export interface Incident extends Required<Omit<ReportIn, "lat" | "lng" | "reported_severity" | "anonymous" | "photo">>, SeverityOut {
  reported_severity?: Severity | null; anonymous?: boolean; photo?: string | null;
  id: string; lat: number | null; lng: number | null;
  status: Status; duplicate_of: string | null;
  /** Raised by a responder from the field ("Escalate" quick action). */
  escalation?: { at: string; team_id: string; team_name: string; reason: string; needs: string[]; note: string } | null;
  created_at: string; updated_at: string; timeline: TimelineEntry[];
  /** Round 2 (defaults 0 / []) */
  witnesses: number; assignments: Assignment[];
}

/* ------------------------------- Round 2 types ----------------------------- */
export type TeamType = "fire" | "ambulance_als" | "ambulance_bls" | "police" | "ndrf" | "boat";
export type TeamStatus = "available" | "busy" | "offline";
export interface Team {
  id: string; name: string; type: TeamType; type_label: string; station: string;
  lat: number; lng: number; status: TeamStatus; current_incident: string | null;
}
export type AssignmentStatus = "assigned" | "accepted" | "rejected" | "en_route" | "on_scene" | "completed";
export interface Assignment {
  id: string; team_id: string; team_name: string; team_type: TeamType; status: AssignmentStatus;
  eta_min: number; distance_km: number; reject_reason: string | null; note: string | null;
  assigned_at: string; updated_at: string;
}
export interface SuggestSlot { slot: string; best: string | null; candidates: { team: Team; eta_min: number; distance_km: number }[] }
export interface Escalation { level: "critical" | "warning"; incident_id: string | null; message: string }
export interface Similar { id: string; title: string; severity: Severity; status: Status; distance_m: number; minutes_apart: number }
export type AlertLevel = "info" | "warning" | "danger";
export interface Alert { id: string; area: string; message: string; level: AlertLevel; hours: number; created_at: string; expires_at: string }
export interface ResponderJob { assignment: Assignment; incident: Incident }

export interface Stats {
  total: number; critical: number; pending: number; in_progress: number; resolved: number;
  by_category: { category: Category; label: string; count: number }[];
  by_severity: { severity: Severity; count: number }[];
  by_area: { area: string; count: number }[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  fire: "Fire Emergency", road_accident: "Road Accident", medical: "Medical Emergency", flood: "Flood",
  building_collapse: "Building Collapse", gas_leak: "Gas Leak", electrical: "Power Outage / Electrical", landslide: "Landslide", other: "Other Emergency",
};
export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low"];
export const STATUSES: Status[] = ["Reported", "Pending", "In Progress", "Resolved"];

/* ------------------------- fallback severity engine ------------------------ */
const TIME_CRITICAL: Category[] = ["fire", "gas_leak", "flood", "electrical", "building_collapse", "landslide"];
const LEVELS: Severity[] = ["Low", "Medium", "High", "Critical"];
const levelOf = (s: number): Severity => (s >= 70 ? "Critical" : s >= 45 ? "High" : s >= 25 ? "Medium" : "Low");

export function localSeverity(r: ReportIn): SeverityOut {
  const reasons: Reason[] = [];
  let score = 0;
  const add = (label: string, points: number, rule: string | null = null) => { if (points || rule) reasons.push({ label, points, rule }); score += points; };

  if (r.life_threat) add("Unconscious / not breathing / trapped", 35);
  else if (r.injuries === "serious") add("Serious injuries reported", 18);
  else if (r.injuries === "minor") add("Minor injuries reported", 8);

  const hz = { small: 5, medium: 12, large: 20, spreading: 25 }[r.hazard];
  add(`Hazard size: ${r.hazard}`, hz);

  const p = r.people_affected;
  const ep = p <= 0 ? 0 : p <= 5 ? 3 : p <= 20 ? 7 : p <= 100 ? 12 : 15;
  if (ep) add(`${p} people affected`, Math.min(20, ep));

  const vp = { children: 4, elderly: 4, patients: 5, disabled: 5, pregnant: 5 };
  const v = Math.min(10, r.vulnerable.reduce((s, x) => s + vp[x], 0));
  if (v) add(`Vulnerable people: ${r.vulnerable.join(", ")}`, v);

  const tc = (r.active && TIME_CRITICAL.includes(r.category)) || (r.category === "medical" && (r.life_threat || r.injuries === "serious"));
  add(tc ? "Time-critical: still active" : "Time factor", tc ? 6 : 2);

  score = Math.min(100, score);
  let lvl = LEVELS.indexOf(levelOf(score));
  const atLeast = (l: Severity, label: string, rule: string) => {
    const i = LEVELS.indexOf(l);
    if (i > lvl) { lvl = i; reasons.push({ label, points: 0, rule }); }
  };
  if (r.life_threat) atLeast("Critical", "Life threat → always Critical", "R1");
  if (r.injured_count >= 5) atLeast("Critical", "5+ people injured → Critical", "R2");
  if (r.active && ["fire", "gas_leak", "electrical"].includes(r.category)) atLeast("High", "Active fire / gas / electrical → at least High", "R5");
  if (r.injuries !== "none" || r.injured_count > 0) atLeast("Medium", "Injury reported → at least Medium", "R6");
  if (!r.life_threat && r.injuries === "none" && r.injured_count === 0 && r.hazard !== "spreading" && r.people_affected === 0 && lvl > 1) {
    lvl = 1; reasons.push({ label: "Nobody hurt or exposed → at most Medium", points: 0, rule: "R7" });
  }
  const flags = (r.description ?? "").trim().length < 15 ? ["needs_verification"] : [];
  return { score, severity: LEVELS[lvl], reasons, place_type: "unknown", place_name: null, flags };
}

/* ------------------------------- seed incidents ---------------------------- */
const now = Date.now();
const ago = (min: number) => new Date(now - min * 60000).toISOString();

type Seed = Partial<ReportIn> & Pick<ReportIn, "title" | "description" | "category" | "area"> & { status: Status; mins: number };
const SEEDS: Seed[] = [
  { title: "Building collapse at Velachery", description: "Old two-storey building near the lake collapsed after heavy rain. Two people believed trapped under debris.", category: "building_collapse", area: "Velachery", people_affected: 8, injured_count: 3, injuries: "serious", life_threat: true, hazard: "large", vulnerable: ["elderly"], status: "In Progress", mins: 42, landmark: "Near Velachery lake bund" },
  { title: "Flood at Tambaram", description: "Water entering ground floor homes, families with children stranded on first floor, water rising fast.", category: "flood", area: "Tambaram", people_affected: 60, injured_count: 0, injuries: "none", life_threat: true, hazard: "spreading", vulnerable: ["children", "elderly"], status: "Reported", mins: 18, landmark: "Behind Tambaram bus stand" },
  { title: "Bus and car collision on GST Road", description: "MTC bus hit a car at Chromepet signal. Several passengers injured, one unconscious.", category: "road_accident", area: "Chromepet", people_affected: 22, injured_count: 6, injuries: "serious", life_threat: false, hazard: "medium", status: "Pending", mins: 26, landmark: "Chromepet signal, GST Road" },
  { title: "Fire at T. Nagar textile shop", description: "Smoke and flames from second floor of a textile showroom on Ranganathan Street, crowd nearby.", category: "fire", area: "T. Nagar", people_affected: 15, injured_count: 0, injuries: "minor", life_threat: false, hazard: "large", status: "In Progress", mins: 35, landmark: "Ranganathan Street" },
  { title: "Gas cylinder leak in Mylapore", description: "Strong LPG smell from a hotel kitchen, staff evacuated, cylinder still leaking.", category: "gas_leak", area: "Mylapore", people_affected: 12, injured_count: 0, injuries: "none", life_threat: false, hazard: "medium", status: "Reported", mins: 9, landmark: "Near Kapaleeshwarar temple tank" },
  { title: "Flood at Adyar riverside", description: "Adyar river overflowing into Kotturpuram colony, roads under knee-deep water.", category: "flood", area: "Adyar", people_affected: 40, injured_count: 0, injuries: "none", life_threat: false, hazard: "large", vulnerable: ["elderly"], status: "Reported", mins: 14 },
  { title: "Live wire fallen at Perambur", description: "Electric line snapped and lying on waterlogged road, sparking.", category: "electrical", area: "Perambur", people_affected: 5, injured_count: 0, injuries: "none", life_threat: false, hazard: "medium", status: "Pending", mins: 21, landmark: "Perambur railway station road" },
  { title: "Elderly man collapsed at Anna Nagar park", description: "Man around 70 collapsed while walking, conscious but has chest pain.", category: "medical", area: "Anna Nagar", people_affected: 1, injured_count: 1, injuries: "minor", life_threat: false, hazard: "small", vulnerable: ["elderly"], status: "In Progress", mins: 31, active: false },
  { title: "Bike skid at Guindy flyover", description: "Two-wheeler skidded on wet road, rider has minor scratches.", category: "road_accident", area: "Guindy", people_affected: 1, injured_count: 1, injuries: "minor", life_threat: false, hazard: "small", status: "Reported", mins: 6, active: false },
  { title: "Waterlogging at Sholinganallur", description: "Knee-deep water on OMR service road, traffic slow, no one hurt.", category: "flood", area: "Sholinganallur", people_affected: 0, injured_count: 0, injuries: "none", life_threat: false, hazard: "medium", status: "Reported", mins: 11 },
  { title: "Tree fallen on road at Egmore", description: "Large tree fell across Pantheon Road after wind, blocking one lane.", category: "other", area: "Egmore", people_affected: 0, injured_count: 0, injuries: "none", life_threat: false, hazard: "small", status: "Resolved", mins: 95, active: false },
  { title: "Small kitchen fire at Porur", description: "Small oil fire in a house kitchen, put out with a wet cloth, no injuries.", category: "fire", area: "Porur", people_affected: 3, injured_count: 0, injuries: "none", life_threat: false, hazard: "small", status: "Resolved", mins: 120, active: false },
];

function buildIncident(s: Seed, i: number): Incident {
  const a = areaByName(s.area);
  const jitter = (k: number) => ((i * 37 + k * 11) % 9 - 4) * 0.0012;
  const r: ReportIn = {
    title: s.title, description: s.description, category: s.category, area: s.area,
    lat: a ? +(a.lat + jitter(1)).toFixed(4) : null, lng: a ? +(a.lng + jitter(2)).toFixed(4) : null,
    landmark: s.landmark ?? "", people_affected: s.people_affected ?? 0, injured_count: s.injured_count ?? 0,
    injuries: s.injuries ?? "none", life_threat: s.life_threat ?? false, hazard: s.hazard ?? "small",
    active: s.active ?? true, vulnerable: s.vulnerable ?? [], contact_name: "", contact_phone: "",
  };
  const sev = localSeverity(r);
  const order: Status[] = ["Reported", "Pending", "In Progress", "Resolved"];
  const notes: Record<Status, string> = {
    Reported: "Report received", Pending: "Verified by control room, awaiting unit",
    "In Progress": "Response team on site", Resolved: "Incident closed",
  };
  const steps = order.slice(0, order.indexOf(s.status) + 1);
  const timeline = steps.map((st, k) => ({ at: ago(s.mins - k * Math.max(2, Math.floor(s.mins / 5))), status: st, note: notes[st], actor: k === 0 ? "citizen" : "control room" }));
  return {
    ...r, lat: r.lat ?? null, lng: r.lng ?? null, landmark: r.landmark ?? "", contact_name: "", contact_phone: "",
    ...sev, id: `INC-${1001 + i}`, status: s.status, duplicate_of: null,
    created_at: ago(s.mins), updated_at: timeline[timeline.length - 1].at, timeline,
    witnesses: 0, assignments: [],
  };
}

const SEV_RANK: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export function sortIncidents(list: Incident[]) {
  return [...list].sort((a, b) =>
    (a.status === "Resolved" ? 1 : 0) - (b.status === "Resolved" ? 1 : 0) ||
    SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.score - a.score ||
    a.created_at.localeCompare(b.created_at));
}

export const mockIncidents: Incident[] = sortIncidents(SEEDS.map(buildIncident));

export function computeStats(list: Incident[]): Stats {
  const cats = Object.keys(CATEGORY_LABEL) as Category[];
  const areas = new Map<string, number>();
  list.forEach((i) => areas.set(i.area, (areas.get(i.area) ?? 0) + 1));
  return {
    total: list.length,
    critical: list.filter((i) => i.severity === "Critical" && i.status !== "Resolved").length,
    pending: list.filter((i) => i.status === "Reported" || i.status === "Pending").length,
    in_progress: list.filter((i) => i.status === "In Progress").length,
    resolved: list.filter((i) => i.status === "Resolved").length,
    by_category: cats.map((c) => ({ category: c, label: CATEGORY_LABEL[c], count: list.filter((i) => i.category === c).length })),
    by_severity: SEVERITIES.map((s) => ({ severity: s, count: list.filter((i) => i.severity === s).length })),
    by_area: [...areas.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count),
  };
}

export const mockStats: Stats = computeStats(mockIncidents);

/** Fallback for a created report when the API is unreachable (shown as "saved locally (demo)"). */
export function mockCreate(r: ReportIn): Incident {
  const sev = localSeverity(r);
  const t = new Date().toISOString();
  return {
    ...r, lat: r.lat ?? null, lng: r.lng ?? null, landmark: r.landmark ?? "", contact_name: r.contact_name ?? "", contact_phone: r.contact_phone ?? "",
    ...sev, id: `INC-${Math.floor(2000 + Math.random() * 7000)}`, status: "Reported", duplicate_of: null,
    created_at: t, updated_at: t, timeline: [{ at: t, status: "Reported", note: "Report received (saved locally — demo)", actor: "citizen" }],
    witnesses: 0, assignments: [],
  };
}

/* ------------------------------ Round 2 mocks ------------------------------ */
const T = (id: string, type: TeamType, type_label: string, name: string, station: string, status: TeamStatus = "available", current_incident: string | null = null): Team => {
  const a = areaByName(station)!;
  return { id, type, type_label, name, station, lat: a.lat, lng: a.lng, status, current_incident };
};
export const mockTeams: Team[] = [
  T("FIRE-EGM", "fire", "Fire engine", "Fire Engine · Egmore", "Egmore"),
  T("FIRE-TBM", "fire", "Fire engine", "Fire Engine · Tambaram", "Tambaram"),
  T("FIRE-GDY", "fire", "Fire engine", "Fire Engine · Guindy", "Guindy", "busy", "INC-1004"),
  T("FIRE-TNG", "fire", "Fire engine", "Fire Engine · T. Nagar", "T. Nagar", "busy", "INC-1004"),
  T("ALS-GGH", "ambulance_als", "ALS ambulance", "ALS Ambulance · Govt General", "Egmore"),
  T("ALS-VLC", "ambulance_als", "ALS ambulance", "ALS Ambulance · Velachery", "Velachery"),
  T("BLS-ADY", "ambulance_bls", "BLS ambulance", "BLS Ambulance · Adyar", "Adyar"),
  T("BLS-ANN", "ambulance_bls", "BLS ambulance", "BLS Ambulance · Anna Nagar", "Anna Nagar"),
  T("POL-MYL", "police", "Police", "Police Patrol · Mylapore", "Mylapore"),
  T("POL-TBM", "police", "Police", "Police Patrol · Tambaram", "Tambaram", "busy", "INC-1003"),
  T("NDRF-VDL", "ndrf", "NDRF rescue", "NDRF Team · Vandalur", "Vandalur"),
  T("BOAT-ADY", "boat", "Rescue boat", "Rescue Boat · Adyar", "Adyar"),
  T("BOAT-VLC", "boat", "Rescue boat", "Rescue Boat · Velachery", "Velachery"),
];

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const SLOTS: Record<Category, [string, TeamType[]][]> = {
  fire: [["Fire engine", ["fire"]], ["Ambulance", ["ambulance_als", "ambulance_bls"]]],
  gas_leak: [["Fire engine", ["fire"]], ["Police", ["police"]]],
  electrical: [["Fire engine", ["fire"]]],
  flood: [["Rescue boat", ["boat", "ndrf"]], ["Ambulance", ["ambulance_als", "ambulance_bls"]]],
  building_collapse: [["NDRF rescue", ["ndrf", "fire"]], ["Ambulance", ["ambulance_als", "ambulance_bls"]]],
  road_accident: [["Ambulance", ["ambulance_als", "ambulance_bls"]], ["Police", ["police"]]],
  medical: [["Ambulance", ["ambulance_als", "ambulance_bls"]]],
  landslide: [["Search & rescue", ["ndrf", "fire"]], ["Ambulance", ["ambulance_als", "ambulance_bls"]]],
  other: [["Police", ["police"]]],
};
/** Offline approximation of /suggest (nearest available team per slot, 25 km/h city speed). */
export function mockSuggest(inc: Incident, teams: Team[] = mockTeams): SuggestSlot[] {
  const at = { lat: inc.lat ?? 13.04, lng: inc.lng ?? 80.23 };
  return (SLOTS[inc.category] ?? SLOTS.other).map(([slot, types]) => {
    const candidates = teams.filter((t) => types.includes(t.type) && t.status === "available")
      .map((team) => { const d = km(at, team); return { team, distance_km: +d.toFixed(1), eta_min: +(2 + (d / 25) * 60).toFixed(1) }; })
      .sort((a, b) => a.eta_min - b.eta_min).slice(0, 3);
    return { slot, best: candidates[0]?.team.id ?? null, candidates };
  });
}

export const mockEscalations: Escalation[] = mockIncidents
  .filter((i) => i.status !== "Resolved" && i.severity === "Critical")
  .map((i) => ({ level: "critical" as const, incident_id: i.id, message: `${i.id} Critical · ${i.title} — no team assigned yet` }));

export const mockAlerts: Alert[] = [{
  id: "ALT-1", area: "Velachery", level: "danger", hours: 6,
  message: "Heavy flooding near Velachery lake. Move to upper floors, avoid 100 Feet Road.",
  created_at: new Date(now - 20 * 60000).toISOString(), expires_at: new Date(now + 5.6 * 3600000).toISOString(),
}];

/* ------------------------- Final page list (§11) -------------------------- */
export interface TrackOut {
  id: string; title: string; category: Category; area: string; landmark: string; severity: Severity; score: number;
  reasons: Reason[]; status: Status; duplicate_of: string | null; created_at: string; updated_at: string;
  timeline: TimelineEntry[]; teams: { team_name: string; team_type: TeamType; status: AssignmentStatus; eta_min: number }[];
}
export type ZoneStatus = "critical" | "evacuate" | "watch" | "safe";
export interface Zone { id: string; area: string; lat: number; lng: number; status: ZoneStatus; note: string; open_incidents: number; critical_incidents: number; updated_at: string }
export interface Shelter { id: string; name: string; area: string; lat: number; lng: number; capacity: number; occupancy: number; facilities: string[] }
export interface Analytics {
  total: number; open: number; resolved: number; resolution_rate: number;
  avg_time_to_assign_min: number | null; avg_time_to_resolve_min: number | null; critical_avg_time_to_assign_min: number | null;
  teams_total: number; teams_busy: number; utilisation: number; rejections: number;
  by_hour: { hour: string; reported: number; resolved: number }[];
  by_area: { area: string; total: number; critical: number; open: number }[];
  by_category: { category: Category; label: string; total: number; avg_score: number }[];
  by_severity: { severity: Severity; total: number; open: number }[];
  by_status: { status: Status; count: number }[];
  team_performance: { team_id: string; team_name: string; type_label: string; jobs: number; completed: number; rejected: number; avg_eta_min: number | null }[];
}

export function mockTrack(id: string): TrackOut | null {
  const i = mockIncidents.find((x) => x.id === id);
  if (!i) return null;
  return {
    id: i.id, title: i.title, category: i.category, area: i.area, landmark: i.landmark, severity: i.severity, score: i.score,
    reasons: i.reasons, status: i.status, duplicate_of: i.duplicate_of, created_at: i.created_at, updated_at: i.updated_at, timeline: i.timeline,
    teams: i.status === "In Progress" ? [{ team_name: "ALS Ambulance · Velachery", team_type: "ambulance_als", status: "en_route", eta_min: 6 }] : [],
  };
}

const zoneOf = (area: string, status: ZoneStatus, note: string): Zone => {
  const a = areaByName(area)!; const inc = mockIncidents.filter((i) => i.area === area && i.status !== "Resolved");
  return { id: area, area, lat: a.lat, lng: a.lng, status, note, open_incidents: inc.length, critical_incidents: inc.filter((i) => i.severity === "Critical").length, updated_at: new Date(now).toISOString() };
};
export const mockZones: Zone[] = [
  zoneOf("Velachery", "critical", "Lake overflow, 1st floors flooded"),
  zoneOf("Tambaram", "evacuate", "Low-lying streets near Mudichur flooding"),
  zoneOf("Adyar", "evacuate", "River level rising near Srinivasapuram"),
  zoneOf("Chromepet", "watch", "GST Road accidents, wet roads"),
  zoneOf("Guindy", "watch", "Waterlogging under the flyover"),
  zoneOf("T. Nagar", "safe", "Normal"), zoneOf("Anna Nagar", "safe", "Normal"),
];
const sh = (id: string, name: string, area: string, capacity: number, occupancy: number, facilities: string[]): Shelter => {
  const a = areaByName(area)!; return { id, name, area, lat: a.lat - 0.004, lng: a.lng + 0.005, capacity, occupancy, facilities };
};
export const mockShelters: Shelter[] = [
  sh("SH-1", "Velachery Govt Higher Sec. School", "Velachery", 400, 362, ["food", "water", "medical"]),
  sh("SH-2", "Guindy Community Hall", "Guindy", 250, 120, ["food", "water"]),
  sh("SH-3", "Tambaram Corporation Marriage Hall", "Tambaram", 300, 288, ["food", "water", "medical"]),
  sh("SH-4", "Adyar Kalakshetra Hall", "Adyar", 200, 74, ["food", "water", "power backup"]),
  sh("SH-5", "Crescent Institute Auditorium", "Vandalur", 500, 96, ["food", "water", "medical", "power backup"]),
];

export function mockAnalytics(): Analytics {
  const st = computeStats(mockIncidents);
  const hours = Array.from({ length: 6 }, (_, k) => {
    const h = new Date(now - (5 - k) * 3600000); h.setMinutes(0, 0, 0);
    return { hour: h.toISOString(), reported: [1, 0, 2, 1, 3, 5][k], resolved: [0, 0, 1, 0, 1, 0][k] };
  });
  return {
    total: st.total, open: st.total - st.resolved, resolved: st.resolved, resolution_rate: +((st.resolved / st.total) * 100).toFixed(1),
    avg_time_to_assign_min: 4.2, avg_time_to_resolve_min: 96, critical_avg_time_to_assign_min: 2.6,
    teams_total: mockTeams.length, teams_busy: mockTeams.filter((t) => t.status === "busy").length,
    utilisation: +((mockTeams.filter((t) => t.status === "busy").length / mockTeams.length) * 100).toFixed(1), rejections: 1,
    by_hour: hours,
    by_area: st.by_area.map((a) => ({ area: a.area, total: a.count, critical: mockIncidents.filter((i) => i.area === a.area && i.severity === "Critical").length, open: mockIncidents.filter((i) => i.area === a.area && i.status !== "Resolved").length })),
    by_category: st.by_category.map((c) => { const l = mockIncidents.filter((i) => i.category === c.category); return { category: c.category, label: c.label, total: c.count, avg_score: l.length ? Math.round(l.reduce((s, i) => s + i.score, 0) / l.length) : 0 }; }),
    by_severity: SEVERITIES.map((sv) => ({ severity: sv, total: mockIncidents.filter((i) => i.severity === sv).length, open: mockIncidents.filter((i) => i.severity === sv && i.status !== "Resolved").length })),
    by_status: STATUSES.map((s2) => ({ status: s2, count: mockIncidents.filter((i) => i.status === s2).length })),
    team_performance: mockTeams.slice(0, 6).map((t, k) => ({ team_id: t.id, team_name: t.name, type_label: t.type_label, jobs: [3, 2, 2, 1, 1, 0][k], completed: [2, 2, 1, 1, 0, 0][k], rejected: k === 3 ? 1 : 0, avg_eta_min: k < 5 ? [8.4, 12.1, 6.3, 15.0, 9.8][k] : null })),
  };
}
