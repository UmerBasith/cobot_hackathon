/** Fetch + cache team → incident routes (GET /api/route). Road route via OSRM when online, straight line offline. */
import { useEffect, useState } from "react";
import { getRoute, type RouteOut } from "./resq";

export interface RouteReq { id: string; from: { lat: number; lng: number }; to: { lat: number; lng: number }; label?: string }
export interface RouteRes extends RouteOut { id: string; label?: string }

const cache = new Map<string, Promise<RouteOut>>();
const keyOf = (r: RouteReq) => [r.from.lat, r.from.lng, r.to.lat, r.to.lng].map((n) => n.toFixed(4)).join(",");

export function fetchRoute(r: RouteReq) {
  const k = keyOf(r);
  let p = cache.get(k);
  if (!p) { p = getRoute(r.from.lat, r.from.lng, r.to.lat, r.to.lng); cache.set(k, p); }
  return p;
}

export function useRoutes(reqs: RouteReq[]) {
  const [routes, setRoutes] = useState<RouteRes[]>([]);
  const sig = reqs.map((r) => `${r.id}:${keyOf(r)}`).join("|");
  useEffect(() => {
    let on = true;
    if (!reqs.length) { setRoutes([]); return; }
    Promise.all(reqs.map((r) => fetchRoute(r).then((o) => ({ ...o, id: r.id, label: r.label })))).then((rs) => { if (on) setRoutes(rs); });
    return () => { on = false; };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return routes;
}

/** Map-ready lines: label carries the source so straight-line fallbacks render dashed. */
export const toLines = (rs: RouteRes[]) => rs.map((r) => ({ id: r.id, coords: r.coords, label: `${r.label ?? ""} ${r.source}` }));
export const routeChip = (r: RouteOut) => `Route: ${r.distance_km} km · ${Math.round(r.duration_min)} min · ${r.source}`;
