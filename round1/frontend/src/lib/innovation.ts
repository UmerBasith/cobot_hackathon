/** Innovation features: Predictive Risk Radar, SMS fallback, Speak-to-Report.
 *  Types follow BRIEF §13. Every read goes through withFallback so the demo never breaks. */
import { api, withFallback } from "./api";
import type { Category, Hazard, Incident, Injuries, Vulnerable, ZoneStatus } from "./mock";
import { AREAS, areaByName } from "./geo";

/* ---------------- Risk Radar ---------------- */
export type RiskLevel = "severe" | "high" | "elevated" | "low";
export interface RiskRecommendation { team_id: string | null; team_name: string; text: string }
export interface RiskArea {
  area: string; lat: number; lng: number; risk: number; level: RiskLevel; rain_mm_6h: number; flood_prone: number;
  open_incidents: number; critical_incidents: number; nearest_unit_km: number | null; drivers: string[];
  recommendation: RiskRecommendation | null;
}
export interface RiskOut { source: string; max_risk: number; method: string; areas: RiskArea[] }

export const RISK_ZONE: Record<RiskLevel, ZoneStatus> = { severe: "critical", high: "evacuate", elevated: "watch", low: "safe" };
export const RISK_HEX: Record<RiskLevel, string> = { severe: "#dc2626", high: "#ea580c", elevated: "#d97706", low: "#16a34a" };

export const RISK_METHOD =
  "risk = 40% rain x flood-prone + 25% open/critical incidents + 15% flood history + 20% distance to nearest free rescue unit. Rule-based; flood-prone index is a simplified demo value.";
export const RISK_WEIGHTS = [
  { label: "Rain × flood-prone", pct: 40, color: "#2563eb" },
  { label: "Open / critical incidents", pct: 25, color: "#e53935" },
  { label: "Distance to free unit", pct: 20, color: "#7c3aed" },
  { label: "Flood history", pct: 15, color: "#0891b2" },
];

const mk = (area: string, risk: number, level: RiskLevel, rain: number, fp: number, open: number, crit: number, km: number,
  rec: RiskRecommendation | null): RiskArea => {
  const a = areaByName(area) ?? AREAS[0];
  return {
    area, lat: a.lat, lng: a.lng, risk, level, rain_mm_6h: rain, flood_prone: fp, open_incidents: open, critical_incidents: crit,
    nearest_unit_km: km, recommendation: rec,
    drivers: [
      ...(rain > 0 ? [`${rain} mm rain expected in 6 h`] : []), `Flood-prone index ${Math.round(fp * 100)}%`,
      ...(open ? [`${open} open incident(s)${crit ? `, ${crit} critical` : ""}`] : []), `Nearest free rescue unit ${km} km away`,
    ],
  };
};
export function mockRisk(heavy: boolean): RiskOut {
  const k = heavy ? 1 : 0;
  const areas = [
    mk("Velachery", heavy ? 65 : 31, heavy ? "high" : "elevated", 109.8 * k, 0.95, 1, 1, 0,
      { team_id: "BOAT-VLC", team_name: "Rescue Boat · Velachery", text: "Rescue Boat · Velachery already close — keep it on standby for Velachery" }),
    mk("Tambaram", heavy ? 57 : 24, heavy ? "high" : "low", 101.4 * k, 0.85, 1, 0, 4.2,
      { team_id: "NDRF-VDL", team_name: "NDRF Team · Vandalur", text: "Pre-position NDRF Team · Vandalur at Tambaram now (4.2 km away)" }),
    mk("Chromepet", heavy ? 57 : 33, heavy ? "high" : "elevated", 80.4 * k, 0.6, 1, 1, 8.5,
      { team_id: "BOAT-VLC", team_name: "Rescue Boat · Velachery", text: "Pre-position Rescue Boat · Velachery at Chromepet now (8.5 km away)" }),
    mk("Porur", heavy ? 53 : 28, heavy ? "high" : "elevated", 60.8 * k, 0.55, 1, 1, 7.8, null),
    mk("Sholinganallur", heavy ? 53 : 22, heavy ? "high" : "low", 72.1 * k, 0.8, 0, 0, 6.1, null),
    mk("Adyar", heavy ? 48 : 20, heavy ? "elevated" : "low", 58.3 * k, 0.7, 0, 0, 3.9, null),
    mk("Guindy", heavy ? 35 : 15, heavy ? "elevated" : "low", 44.0 * k, 0.4, 0, 0, 2.2, null),
    mk("Egmore", heavy ? 17 : 10, "low", 21.2 * k, 0.3, 0, 0, 1.5, null),
  ];
  return { source: heavy ? "demo scenario: heavy rain (offline)" : "offline sample", max_risk: areas[0].risk, method: RISK_METHOD, areas };
}
export const getRisk = (heavy: boolean) =>
  withFallback(api.get<RiskOut>(`/risk${heavy ? "?scenario=heavy_rain" : ""}`), mockRisk(heavy));
export const preposition = (area: string, teamId: string) =>
  api.post<{ id: string; name: string; station?: string }>(`/risk/preposition?area=${encodeURIComponent(area)}&team_id=${encodeURIComponent(teamId)}`);

/* ---------------- Parse (voice / SMS) ---------------- */
export interface ParsedFields {
  category: Category; area: string | null; people_affected: number; life_threat: boolean; injuries: Injuries;
  injured_count: number; hazard: Hazard; active: boolean; vulnerable: Vulnerable[];
}
export interface ParseOut { fields: ParsedFields; matched: Record<string, unknown>; confidence: number }

/** Tiny offline parser so voice auto-fill still works without the backend. */
export function localParse(text: string): ParseOut {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  const category: Category =
    has("fire", "smoke", "தீ", "burn") ? "fire" : has("flood", "water", "வெள்ள", "rain") ? "flood"
      : has("accident", "crash", "collision", "விபத்து") ? "road_accident" : has("collapse", "building fell") ? "building_collapse"
        : has("gas", "leak") ? "gas_leak" : has("heart", "unconscious", "breath", "medical", "faint") ? "medical"
          : has("landslide") ? "landslide" : has("electric", "power", "current", "wire") ? "electrical" : "other";
  const area = AREAS.find((a) => {
    const n = a.name.toLowerCase().replace(/[^a-z ]/g, "");
    return t.includes(n) || t.replace(/[^a-z]/g, "").includes(n.replace(/ /g, ""));
  })?.name ?? (has("வேளச்சேரி") ? "Velachery" : null);
  const num = Number((t.match(/\d+/) ?? ["1"])[0]);
  const vulnerable: Vulnerable[] = [];
  if (has("child", "kid", "குழந்தை")) vulnerable.push("children");
  if (has("elder", "old", "grand")) vulnerable.push("elderly");
  if (has("pregnant")) vulnerable.push("pregnant");
  const life = has("trapped", "stuck", "unconscious", "not breathing", "சிக்கி", "drown");
  const injured = has("injur", "bleed", "hurt", "காயம்");
  const conf = [category !== "other", !!area, /\d/.test(t), life].filter(Boolean).length / 4;
  return {
    fields: {
      category, area, people_affected: Number.isFinite(num) ? num : 1, life_threat: life,
      injuries: injured ? "serious" : "none", injured_count: injured ? Math.min(num, 50) : 0,
      hazard: life ? "large" : "medium", active: true, vulnerable,
    },
    matched: {}, confidence: Math.max(0.25, conf),
  };
}
export const parseText = (text: string) => withFallback(api.post<ParseOut>("/parse", { text }), localParse(text));

/* ---------------- SMS ---------------- */
export interface SmsOut { ok: boolean; reply: string; parsed: ParseOut | null; incident: Incident | null }
export interface SmsLog { id: string; at: string; sender: string; text: string; reply: string; incident_id: string | null }

export function mockSms(text: string): SmsOut {
  const p = localParse(text);
  if (!p.fields.area) {
    return { ok: false, reply: "ResQNet: we could not find your area. Reply like: FIRE TNAGAR 5 TRAPPED. Danger to life? Call 112.", parsed: p, incident: null };
  }
  const id = `INC-${1000 + Math.floor(Math.random() * 8999)}`;
  return {
    ok: true, parsed: p,
    reply: `ResQNet: received ${id} (${p.fields.category.replace("_", " ")}, ${p.fields.area}). Help is being dispatched. Track: resqnet.in/t/${id} (offline demo)`,
    incident: { id } as Incident,
  };
}
export const sendSms = (sender: string, text: string) =>
  withFallback(api.post<SmsOut>("/sms", { sender, text }), mockSms(text));
export const getSmsLog = () => withFallback(api.get<SmsLog[]>("/sms"), [] as SmsLog[]);
