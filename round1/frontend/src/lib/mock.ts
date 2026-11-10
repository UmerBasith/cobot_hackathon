/**
 * ResQNet shared types (BRIEF §5 API contract) + realistic fallback data.
 * The fallback severity engine mirrors the backend rules (BRIEF §6) so the demo
 * stays correct even if the API is down.
 */
import { areaByName } from "./geo";

export type Category = "fire" | "road_accident" | "medical" | "flood" | "building_collapse" | "gas_leak" | "electrical" | "other";
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
}

export interface Reason { label: string; points: number; rule: string | null }

export interface SeverityOut {
  score: number; severity: Severity; reasons: Reason[];
  place_type: string; place_name: string | null; flags: string[];
}

export interface TimelineEntry { at: string; status: Status; note: string; actor: string }

export interface Incident extends Required<Omit<ReportIn, "lat" | "lng">>, SeverityOut {
  id: string; lat: number | null; lng: number | null;
  status: Status; duplicate_of: string | null;
  created_at: string; updated_at: string; timeline: TimelineEntry[];
}

export interface Stats {
  total: number; critical: number; pending: number; in_progress: number; resolved: number;
  by_category: { category: Category; label: string; count: number }[];
  by_severity: { severity: Severity; count: number }[];
  by_area: { area: string; count: number }[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  fire: "Fire Emergency", road_accident: "Road Accident", medical: "Medical Emergency", flood: "Flood",
  building_collapse: "Building Collapse", gas_leak: "Gas Leak", electrical: "Electrical Hazard", other: "Other Emergency",
};
export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low"];
export const STATUSES: Status[] = ["Reported", "Pending", "In Progress", "Resolved"];

/* ------------------------- fallback severity engine ------------------------ */
const TIME_CRITICAL: Category[] = ["fire", "gas_leak", "flood", "electrical", "building_collapse"];
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
  };
}
