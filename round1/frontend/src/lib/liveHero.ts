/** Live CPR Hero opt-in for real website users: localStorage state, heartbeat, opt-out. */
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { errText } from "./resq";
import type { HeroProfile } from "./hero";

export interface LiveHero {
  heroId: string; client_id: string; name: string; skills: string[];
  lat?: number; lng?: number; area?: string; since: string;
}
const KEY = "resq.liveHero";
const CLIENT = "resq.clientId";
const EVT = "resq-live-hero";

function read(): LiveHero | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as LiveHero) : null; } catch { return null; }
}
let cache: LiveHero | null = read();
let raw = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
function snapshot() {
  let now: string | null = null;
  try { now = localStorage.getItem(KEY); } catch { /* private mode */ }
  if (now !== raw) { raw = now; cache = read(); }
  return cache;
}
function write(v: LiveHero | null) {
  try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVT));
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}
export const useLiveHero = () => useSyncExternalStore(subscribe, snapshot, () => null);
export const getLiveHero = snapshot;

export function clientId() {
  try {
    let id = localStorage.getItem(CLIENT);
    if (!id || id.length < 4) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem(CLIENT, id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 10); }
}

type Profile = { name: string; skills: string[]; lat?: number; lng?: number; area?: string };
const body = (p: Profile, cid: string) => ({ client_id: cid, name: p.name, skills: p.skills, lat: p.lat, lng: p.lng, area: p.area });

/** Opt in (or refresh profile). Throws a readable message on failure. */
export async function goLive(p: Profile): Promise<HeroProfile> {
  const cid = clientId();
  try {
    const h = await api.post<HeroProfile>("/hero/live", body(p, cid));
    write({ heroId: h.id, client_id: cid, ...p, since: read()?.since ?? new Date().toISOString() });
    return h;
  } catch (e) { throw new Error(errText(e)); }
}
export async function goOffline() {
  const cur = read();
  write(null);
  if (cur) { try { await api.del(`/hero/live/${encodeURIComponent(cur.heroId)}`); } catch { /* already gone */ } }
}
/** Global heartbeat: re-POST every 15 s while opted in so the server keeps us "online". */
export function useHeroHeartbeat() {
  const live = useLiveHero();
  const id = live?.heroId;
  useEffect(() => {
    if (!id) return;
    const beat = () => { const c = read(); if (c) void api.post("/hero/live", body(c, c.client_id)).catch(() => undefined); };
    beat();
    const t = setInterval(beat, 15000);
    return () => clearInterval(t);
  }, [id]);
}

export const SKILLS = ["CPR", "First aid", "Doctor/Nurse", "Swimmer"];

const DKEY = (id: string) => `resq.hero.popupSeen.${id}`;
export function dismissedFor(id: string): string[] {
  try { return JSON.parse(localStorage.getItem(DKEY(id)) ?? "[]") as string[]; } catch { return []; }
}
export function addDismissed(id: string, inc: string) {
  try { localStorage.setItem(DKEY(id), JSON.stringify([...dismissedFor(id), inc].slice(-30))); } catch { /* ignore */ }
}
