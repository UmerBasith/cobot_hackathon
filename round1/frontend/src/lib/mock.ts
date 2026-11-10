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

/* ============ §12 INNOVATION: Golden Hour Engine + CPR Hero Network ============
 * Survival = 95 % × 0.5^(minutes waiting ÷ half-life). Simplified DEMO model — the
 * mock below uses the same formula as the backend (app/golden.py) so the fallback
 * numbers stay consistent if the API is down. */
export type SurvivalProfile = "cardiac" | "fire_trapped" | "drowning" | "toxic" | "trauma" | "debris" | "serious" | "minor";
export interface GHRow {
  incident_id: string; title: string; category: Category; area: string; severity: Severity; status: Status;
  profile: SurvivalProfile; profile_label: string; basis: string; half_life_min: number; people_at_risk: number;
  minutes_since_report: number; help_eta_min: number | null; help: string; cpr_started: boolean;
  /** 0-1 */ survival_now: number; survival_at_help: number; survival_if_5_min_later: number;
  expected_survivors: number; lives_lost_per_min_delay: number;
}
export interface GHStep {
  incident_id: string; title: string; profile_label: string; people_at_risk: number;
  team_id: string; team_name: string; eta_min: number; lives_gained: number; nearest_first_team: string | null;
}
export interface GHPlan {
  steps: GHStep[]; expected_survivors_golden: number; expected_survivors_nearest: number;
  extra_lives: number; people_waiting: number; teams_free: number;
}
export interface GoldenHour {
  people_at_risk: number; expected_survivors: number; lives_lost_per_min_delay: number; method: string;
  incidents: GHRow[]; plan: GHPlan;
}
export interface GHApplyOut { assigned: number; steps: GHStep[]; extra_lives: number }
export interface GHSimulation {
  runs: number; incidents_per_run: number; teams: number; people_at_risk_avg: number;
  golden_hour_survivors: number; nearest_first_survivors: number; extra_lives_per_disaster: number;
  improvement_pct: number; method: string;
}
/** All survival values 0-100. */
export interface SurvivalPoint { t: number; no_help: number; with_cpr: number; current_plan: number }
export interface SurvivalOut {
  incident_id?: string; profile: SurvivalProfile | null; profile_label: string; basis: string;
  half_life_min?: number; cpr_slowdown?: number; people_at_risk: number;
  now_min?: number; help_min?: number | null; help?: string; cpr_min?: number | null;
  survival_now?: number; points: SurvivalPoint[];
}
export type HeroStatus = "alerted" | "accepted" | "declined" | "arrived" | "cpr" | "done";
export interface HeroVolunteer {
  id: string; name: string; skills: string[]; status: HeroStatus; distance_m: number; eta_min: number;
  alerted_at: string; updated_at: string; cpr_at: string | null;
}
export interface NearbyHero { id: string; name: string; skills: string[]; distance_m: number; eta_min: number; status: HeroStatus | "not alerted" }
export interface IncidentHeroes { needs_heroes: boolean; radius_m: number; responding: HeroVolunteer[]; nearby: NearbyHero[] }

export const SURVIVAL_PROFILES: Record<SurvivalProfile, { label: string; half: number; slow: number; basis: string }> = {
  cardiac: { label: "Cardiac arrest / not breathing", half: 7, slow: 3, basis: "Survival falls about 10 % per minute without CPR; CPR slows the fall." },
  fire_trapped: { label: "Trapped in fire / smoke", half: 12, slow: 1.5, basis: "Smoke and heat kill within minutes." },
  drowning: { label: "Trapped in rising water", half: 25, slow: 1.5, basis: "Rising water: minutes to an hour." },
  toxic: { label: "Gas / electric shock exposure", half: 20, slow: 2, basis: "Toxic gas or electric shock: minutes." },
  trauma: { label: "Major trauma (golden hour)", half: 60, slow: 2, basis: "Major injuries: the first hour decides survival." },
  debris: { label: "Trapped under debris", half: 600, slow: 1.5, basis: "Trapped under debris: survival over hours to days." },
  serious: { label: "Serious injury", half: 120, slow: 2, basis: "Serious but stable injuries: hours." },
  minor: { label: "Minor injury", half: 2880, slow: 1, basis: "Minor injuries: no real time pressure." },
};

/** Survival (0-1) at minute t; CPR from cprAt slows the decline by `slow`; a team on scene (helpAt) stops it. */
export function survivalAt(t: number, half: number, cprAt: number | null = null, slow = 1, helpAt: number | null = null) {
  const end = helpAt != null ? Math.min(t, helpAt) : t;
  if (cprAt == null || end <= cprAt) return 0.95 * 0.5 ** (Math.max(0, end) / half);
  return 0.95 * 0.5 ** (Math.max(0, cprAt) / half) * 0.5 ** ((end - cprAt) / (half * slow));
}

type GHSeed = [id: string, title: string, category: Category, area: string, severity: Severity, status: Status,
  profile: SurvivalProfile, people: number, since: number, helpEta: number | null, help: string, cprAt: number | null];
const GH_SEEDS: GHSeed[] = [
  ["INC-1013", "Man collapsed, not breathing", "medical", "T. Nagar", "Critical", "Reported", "cardiac", 1, 4, null, "No team assigned · 3 CPR heroes alerted", 3],
  ["INC-1008", "Bus overturned on GST Road", "road_accident", "Chromepet", "Critical", "Pending", "trauma", 12, 19.5, null, "No team assigned", null],
  ["INC-1011", "Smoke in apartment stairwell, 2 trapped", "fire", "Anna Nagar", "Critical", "In Progress", "fire_trapped", 2, 6, 5, "Fire Engine · Anna Nagar, ETA 5 min", null],
  ["INC-1012", "Family stranded on rooftop, water rising", "flood", "Velachery", "Critical", "Reported", "drowning", 5, 7.5, null, "No team assigned", null],
  ["INC-1006", "Elderly woman with chest pain", "medical", "Mylapore", "Medium", "Reported", "serious", 1, 32.5, null, "No team assigned", null],
  ["INC-1004", "Wall collapse after heavy rain", "building_collapse", "Royapuram", "Medium", "Pending", "debris", 2, 41.5, null, "No team assigned", null],
  ["INC-1009", "Bike skid on wet road", "road_accident", "Guindy", "Medium", "Reported", "minor", 1, 15.5, null, "No team assigned", null],
];
const r2 = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
function ghRow(s: GHSeed): GHRow {
  const [incident_id, title, category, area, severity, status, profile, n, since, eta, help, cprAt] = s;
  const p = SURVIVAL_PROFILES[profile];
  const planned = eta != null ? since + eta : since + 90;
  const slow = cprAt != null ? p.slow : 1;
  const at = (t: number) => survivalAt(t, p.half, cprAt, slow);
  return {
    incident_id, title, category, area, severity, status, profile, profile_label: p.label, basis: p.basis, half_life_min: p.half,
    people_at_risk: n, minutes_since_report: since, help_eta_min: eta, help, cpr_started: cprAt != null,
    survival_now: r2(at(since)), survival_at_help: r2(at(planned)), survival_if_5_min_later: r2(at(planned + 5)),
    expected_survivors: r2(n * at(planned), 2), lives_lost_per_min_delay: r2(n * (at(planned) - at(planned + 1))),
  };
}
const ghRows = GH_SEEDS.map(ghRow).sort((a, b) => b.lives_lost_per_min_delay - a.lives_lost_per_min_delay);

export const mockGoldenHour: GoldenHour = {
  people_at_risk: ghRows.reduce((a, r) => a + r.people_at_risk, 0),
  expected_survivors: r2(ghRows.reduce((a, r) => a + r.expected_survivors, 0), 2),
  lives_lost_per_min_delay: r2(ghRows.reduce((a, r) => a + r.lives_lost_per_min_delay, 0)),
  method: "Survival = 95 % x 0.5^(minutes waiting / half-life). Half-life depends on the condition; CPR or first aid slows the fall; it stops when a team is on scene. Simplified demo assumptions.",
  incidents: ghRows,
  plan: {
    steps: [
      { incident_id: "INC-1013", title: "Man collapsed, not breathing", profile_label: "Cardiac arrest / not breathing", people_at_risk: 1, team_id: "ALS-TNR", team_name: "ALS Ambulance · T. Nagar", eta_min: 6.2, lives_gained: 0.71, nearest_first_team: "BLS Ambulance · Adyar" },
      { incident_id: "INC-1008", title: "Bus overturned on GST Road", profile_label: "Major trauma (golden hour)", people_at_risk: 12, team_id: "ALS-VLC", team_name: "ALS Ambulance · Velachery", eta_min: 23.2, lives_gained: 3.74, nearest_first_team: "ALS Ambulance · Velachery" },
      { incident_id: "INC-1012", title: "Family stranded on rooftop, water rising", profile_label: "Trapped in rising water", people_at_risk: 5, team_id: "BOAT-VLC", team_name: "Rescue Boat · Velachery", eta_min: 3.4, lives_gained: 3.19, nearest_first_team: "Rescue Boat · Velachery" },
      { incident_id: "INC-1006", title: "Elderly woman with chest pain", profile_label: "Serious injury", people_at_risk: 1, team_id: "BLS-ADY", team_name: "BLS Ambulance · Adyar", eta_min: 11.8, lives_gained: 0.27, nearest_first_team: "ALS Ambulance · T. Nagar" },
    ],
    expected_survivors_golden: 17.42, expected_survivors_nearest: 16.36, extra_lives: 1.06, people_waiting: 21, teams_free: 10,
  },
};

export const mockGHSimulation: GHSimulation = {
  runs: 40, incidents_per_run: 25, teams: 13, people_at_risk_avg: 65.8,
  golden_hour_survivors: 34.83, nearest_first_survivors: 26.59, extra_lives_per_disaster: 8.24, improvement_pct: 31,
  method: "40 simulated disaster bursts (seed 7), 25 life-risk incidents each, 13 teams, one dispatch wave; unserved incidents wait 90 min. Survival curves are simplified demo assumptions.",
};

export function mockSurvival(id: string): SurvivalOut {
  const row = ghRows.find((r) => r.incident_id === id);
  if (!row) return { incident_id: id, profile: null, profile_label: "No one at risk to life", basis: "No injuries or life threat reported.", people_at_risk: 0, points: [] };
  const p = SURVIVAL_PROFILES[row.profile];
  const seed = GH_SEEDS.find((s) => s[0] === id)!;
  const cpr = seed[11];
  const now = row.minutes_since_report;
  const helpMin = row.help_eta_min != null ? now + row.help_eta_min : null;
  const horizon = Math.max(60, Math.min(p.half * 3, 240), (helpMin ?? 0) + 15, now + 15);
  const points: SurvivalPoint[] = Array.from({ length: 33 }, (_, k) => {
    const t = (horizon * k) / 32;
    return {
      t: Math.round(t * 10) / 10,
      no_help: Math.round(1000 * survivalAt(t, p.half)) / 10,
      with_cpr: Math.round(1000 * survivalAt(t, p.half, cpr ?? now, p.slow)) / 10,
      current_plan: Math.round(1000 * survivalAt(t, p.half, cpr, cpr != null ? p.slow : 1, helpMin)) / 10,
    };
  });
  return {
    incident_id: id, profile: row.profile, profile_label: p.label, basis: p.basis, half_life_min: p.half, cpr_slowdown: p.slow,
    people_at_risk: row.people_at_risk, now_min: now, help_min: helpMin, help: row.help, cpr_min: cpr,
    survival_now: Math.round(row.survival_now * 1000) / 10, points,
  };
}

const heroAgo = (min: number) => new Date(Date.now() - min * 60000).toISOString();
export function mockIncidentHeroes(id: string): IncidentHeroes {
  const life = ghRows.some((r) => r.incident_id === id && ["cardiac", "fire_trapped", "drowning", "toxic", "trauma"].includes(r.profile));
  const responding: HeroVolunteer[] = id === "INC-1013" ? [
    { id: "HERO-01", name: "Priya S", skills: ["CPR", "First aid", "Nurse"], status: "cpr", distance_m: 320, eta_min: 2.4, alerted_at: heroAgo(3), updated_at: heroAgo(1), cpr_at: heroAgo(1) },
    { id: "HERO-04", name: "Deepa R", skills: ["CPR", "AED"], status: "accepted", distance_m: 610, eta_min: 3.8, alerted_at: heroAgo(3), updated_at: heroAgo(2), cpr_at: null },
    { id: "HERO-07", name: "Anitha G", skills: ["CPR", "First aid"], status: "alerted", distance_m: 880, eta_min: 4.9, alerted_at: heroAgo(3), updated_at: heroAgo(3), cpr_at: null },
  ] : [];
  const nearby: NearbyHero[] = [
    { id: "HERO-01", name: "Priya S", skills: ["CPR", "First aid", "Nurse"], distance_m: 320, eta_min: 2.4, status: "not alerted" },
    { id: "HERO-04", name: "Deepa R", skills: ["CPR", "AED"], distance_m: 610, eta_min: 3.8, status: "not alerted" },
    { id: "HERO-07", name: "Anitha G", skills: ["CPR", "First aid"], distance_m: 880, eta_min: 4.9, status: "not alerted" },
    { id: "HERO-02", name: "Arjun K", skills: ["CPR", "First aid", "Swimmer"], distance_m: 1240, eta_min: 6.6, status: "not alerted" },
    { id: "HERO-12", name: "Suresh B", skills: ["CPR", "Swimmer"], distance_m: 2150, eta_min: 10.2, status: "not alerted" },
  ].map((n) => ({ ...n, status: responding.find((r) => r.id === n.id)?.status ?? "not alerted" }) as NearbyHero);
  return { needs_heroes: life, radius_m: 3000, responding, nearby };
}
