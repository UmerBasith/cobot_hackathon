/** CPR Hero Network — types, demo-safe API calls and small audio helpers (owned by the hero builder). */
import { api, withFallback } from "./api";
import { errText } from "./resq";
import type { Category, Severity, Status } from "./mock";

export type VolunteerStatus = "alerted" | "accepted" | "declined" | "arrived" | "cpr" | "done";
export type HeroAction = "accept" | "decline" | "arrived" | "cpr" | "done";

export interface HeroProfile {
  id: string; name: string; skills: string[]; lat: number; lng: number; phone: string;
  available: boolean; verified: boolean; rescues: number; live?: boolean; last_seen?: string;
}
export interface Volunteer {
  id: string; name: string; skills: string[]; status: VolunteerStatus; distance_m: number; eta_min: number;
  alerted_at: string; updated_at: string; cpr_at: string | null; live?: boolean;
}
export interface HeroIncident {
  id: string; title: string; category: Category; area: string; landmark: string; lat: number | null; lng: number | null;
  severity: Severity; score: number; description: string; people_affected: number; life_threat: boolean;
  injuries: string; created_at: string; status: Status;
}
export interface HeroJob { volunteer: Volunteer; incident: HeroIncident }
export interface HeroInbox { hero: HeroProfile; jobs: HeroJob[] }

/* ------------------------------------------------------------------ mocks */
const SEED: [string, string, string[], number, number][] = [
  ["HERO-01", "Priya S", ["CPR", "First aid"], 13.0405, 80.235],
  ["HERO-02", "Arjun K", ["CPR", "First aid", "Swimmer"], 12.98, 80.22],
  ["HERO-03", "Dr. Fathima R", ["CPR", "Doctor"], 13.0375, 80.266],
  ["HERO-04", "Karthik M", ["CPR"], 13.003, 80.258],
  ["HERO-05", "Meena V", ["CPR", "Nurse"], 13.086, 80.212],
  ["HERO-06", "Rahul J", ["First aid", "Swimmer"], 12.926, 80.102],
  ["HERO-07", "Sana A", ["CPR", "First aid"], 13.072, 80.259],
  ["HERO-08", "Vignesh P", ["CPR"], 13.008, 80.218],
  ["HERO-09", "Lakshmi N", ["CPR", "First aid"], 12.902, 80.227],
  ["HERO-10", "Imran H", ["CPR", "Paramedic"], 12.893, 80.082],
  ["HERO-11", "Deepa R", ["CPR", "First aid"], 13.043, 80.239],
  ["HERO-12", "Suresh T", ["CPR"], 13.11, 80.29],
  ["HERO-13", "Anitha G", ["CPR", "Nurse"], 13.038, 80.231],
];
export const MOCK_HEROES: HeroProfile[] = SEED.map(([id, name, skills, lat, lng], i) => ({
  id, name, skills, lat, lng, phone: `98400 ${String(11111 * ((i % 9) + 1)).padStart(5, "0")}`, available: true, verified: true, rescues: 0,
}));

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
export const MOCK_INCIDENT: HeroIncident = {
  id: "INC-DEMO", title: "Man collapsed, not breathing", category: "medical", area: "T. Nagar", landmark: "Bus stop near Pondy Bazaar",
  lat: 13.041, lng: 80.2345, severity: "Critical", score: 92, description: "Elderly man collapsed at the bus stop, not breathing",
  people_affected: 1, life_threat: true, injuries: "serious", created_at: ago(1), status: "Reported",
};
export function mockInbox(id: string): HeroInbox {
  const hero = MOCK_HEROES.find((h) => h.id === id.toUpperCase()) ?? MOCK_HEROES[0];
  return {
    hero,
    jobs: [{
      incident: MOCK_INCIDENT,
      volunteer: { id: hero.id, name: hero.name, skills: hero.skills, status: "alerted", distance_m: 77, eta_min: 1.1, alerted_at: ago(0.5), updated_at: ago(0.5), cpr_at: null },
    }],
  };
}

/* ------------------------------------------------------------------- API */
export const getHeroes = () => withFallback(api.get<HeroProfile[]>("/heroes"), MOCK_HEROES);
export const getInbox = (id: string) => withFallback(api.get<HeroInbox>(`/hero/${encodeURIComponent(id)}`), mockInbox(id));
/** Real inbox read — throws (no mock) so a 404 / outage is visible. */
export const getInboxStrict = (id: string) => api.get<HeroInbox>(`/hero/${encodeURIComponent(id)}`);
/** Returns null on success, or the server's error message. Never pretends success. */
export async function heroRespond(id: string, incident_id: string, action: HeroAction): Promise<string | null> {
  try { await api.post(`/hero/${encodeURIComponent(id)}/respond`, { incident_id, action }); return null; }
  catch (e) { return errText(e); }
}

/* ------------------------------------------------------------- formatting */
export const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
export const fmtEta = (min: number) => (min < 1 ? "< 1 min" : `~${Math.round(min)} min`);
export const initials = (name: string) => name.replace(/^Dr\.\s*/, "").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

/* ------------------------------------------------------------------ audio */
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
/** Unlock audio on a user gesture (browsers block sound until then). */
export const unlockAudio = () => { audio(); };
/** Urgent two-tone alert beep (played once per new alert). */
export function alertBeep() { [0, 0.22, 0.44].forEach((s, i) => tone(i % 2 ? 660 : 880, s, 0.18, 0.25, "square")); }
/** Short metronome tick for CPR compressions. */
export function click(accent = false) { tone(accent ? 1500 : 1100, 0, 0.05, accent ? 0.5 : 0.35, "triangle"); }
export function vibrate(pattern: number | number[]) { try { navigator.vibrate?.(pattern); } catch { /* not supported */ } }
