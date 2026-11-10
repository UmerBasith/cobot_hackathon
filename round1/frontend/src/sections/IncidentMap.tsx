/**
 * Chennai incident map. MapLibre + OpenFreeMap; if the style fails or takes >6 s,
 * falls back to an SVG schematic map (same projection) so the demo is never blank.
 * Default export so it can be React.lazy()-loaded.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AREAS, CENTER, COAST, nearestArea, project, unproject } from "@/lib/geo";
import type { Severity } from "@/lib/mock";
import { STATIC } from "@/lib/static";
import { cn } from "@/lib/cn";
import { SEV_HEX, ZONE_HEX } from "./IncidentUI";
import type { ZoneStatus } from "@/lib/mock";

export interface MapPoint { id: string; lat: number; lng: number; severity: Severity; title: string; resolved?: boolean }

export interface ZonePoint { id: string; lat: number; lng: number; status: ZoneStatus; label: string }
export interface ShelterPoint { id: string; lat: number; lng: number; label: string; pct: number }
const shelterHex = (pct: number) => (pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#0284c7");
const HOUSE = "M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z";

export interface TeamPoint { id: string; lat: number; lng: number; label: string; status: "available" | "busy" | "offline" }
const TEAM_HEX = { available: "#2563eb", busy: "#7c3aed", offline: "#94a3b8" };

/** Team → incident route. coords are [lat, lng] pairs (as returned by GET /api/route). Dashed when label includes "straight". */
export interface RouteLine { id: string; coords: [number, number][]; label?: string }
const ROUTE_BLUE = "#2563eb";

export interface IncidentMapProps {
  points?: MapPoint[];
  routes?: RouteLine[];
  teams?: TeamPoint[];
  zones?: ZonePoint[];
  shelters?: ShelterPoint[];
  onSelect?: (id: string) => void;
  /** Pick mode: tap the map to choose a location. */
  onPick?: (p: { lat: number; lng: number; area: string }) => void;
  picked?: { lat: number; lng: number } | null;
  /** The viewer's live GPS position: pulsing blue dot + accuracy circle. */
  me?: { lat: number; lng: number; accuracy?: number } | null;
  /** Fly to `me` on the first fix (true by default when `me` is given). */
  followMe?: boolean;
  className?: string;
  height?: number | string;
}

const ME_BLUE = "#2563eb";

/** Circle polygon (GeoJSON) around a point, radius in metres — for the GPS accuracy halo. */
function circleGeo(lat: number, lng: number, radiusM: number) {
  const pts: [number, number][] = [];
  const dLat = radiusM / 111320, dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI;
    pts.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [pts] } };
}

function meEl() {
  const outer = document.createElement("div"); // MapLibre owns this element's position — don't style it
  outer.title = "You are here";
  const el = document.createElement("div");
  el.style.cssText = `position:relative;width:18px;height:18px;border-radius:999px;background:${ME_BLUE};border:3px solid white;box-shadow:0 0 0 1px rgb(37 99 235/.4),0 2px 8px rgb(0 0 0/.35)`;
  const ring = document.createElement("span");
  ring.style.cssText = `position:absolute;inset:-6px;border-radius:999px;border:2px solid ${ME_BLUE};animation:sos-ring 1.8s ease-out infinite`;
  el.appendChild(ring);
  outer.appendChild(el);
  return outer;
}

const OPENFREEMAP = "https://tiles.openfreemap.org/styles/liberty";
const CARTO_KEY = (import.meta.env.VITE_CARTO_KEY as string | undefined)?.trim();
/** CARTO Voyager raster tiles (needs a free key in .env: VITE_CARTO_KEY). Falls back to OpenFreeMap, then the SVG map. */
const CARTO_STYLE: maplibregl.StyleSpecification | null = CARTO_KEY ? {
  version: 8,
  sources: {
    voyager: {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`),
      tileSize: 256, maxzoom: 20,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: "voyager", type: "raster", source: "voyager" }],
} : null;

export default function IncidentMap(props: IncidentMapProps) {
  const [mode, setMode] = useState<"loading" | "map" | "fallback">(STATIC ? "fallback" : "loading");
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-line bg-surface-2", props.className)} style={{ height: props.height ?? 360 }}>
      {mode !== "fallback" && <LiveMap {...props} onMode={setMode} visible={mode === "map"} />}
      {mode !== "map" && <SvgMap {...props} />}
      {mode === "loading" && <span className="absolute top-2 left-2 rounded-md bg-surface/80 px-2 py-0.5 text-[10px] text-muted">Loading map…</span>}
    </div>
  );
}

// IMPORTANT: MapLibre positions the element passed to `new Marker({ element })` with its own
// `position:absolute` + `transform:translate(...)`. Never set position/transform on that outer
// element (it makes markers drift away from their coordinates). Style an inner element instead.
function dotEl(p: MapPoint) {
  const outer = document.createElement("div");
  outer.className = "resq-dot";
  const el = document.createElement("button");
  el.title = `${p.id} · ${p.title}`;
  const c = SEV_HEX[p.severity];
  const size = p.severity === "Critical" ? 18 : p.severity === "High" ? 15 : 13;
  el.style.cssText = `display:block;position:relative;width:${size}px;height:${size}px;border-radius:999px;background:${p.resolved ? "#94a3b8" : c};border:2.5px solid white;box-shadow:0 2px 6px rgb(0 0 0/.35);cursor:pointer;padding:0`;
  if (p.severity === "Critical" && !p.resolved) {
    const ring = document.createElement("span");
    ring.style.cssText = `position:absolute;inset:-3px;border-radius:999px;border:2px solid ${c};animation:sos-ring 1.6s ease-out infinite`;
    el.appendChild(ring);
  }
  outer.appendChild(el);
  return outer;
}

function teamEl(t: TeamPoint) {
  const outer = document.createElement("div");
  outer.title = `${t.label} · ${t.status}`;
  const el = document.createElement("div");
  el.style.cssText = `width:16px;height:16px;border-radius:4px;background:${TEAM_HEX[t.status]};border:2.5px solid white;box-shadow:0 2px 6px rgb(0 0 0/.35);transform:rotate(45deg)`;
  outer.appendChild(el);
  return outer;
}

function zoneEl(z: ZonePoint) {
  const el = document.createElement("div");
  el.title = `${z.label} · ${z.status}`;
  const c = ZONE_HEX[z.status];
  el.style.cssText = `width:64px;height:64px;border-radius:999px;background:${c}2e;border:2px solid ${c};pointer-events:none`;
  return el;
}
function shelterEl(sh: ShelterPoint) {
  const el = document.createElement("div");
  el.title = `${sh.label} · ${sh.pct}% full`;
  el.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><path d="${HOUSE}"/></svg>`;
  el.style.cssText = `display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:${shelterHex(sh.pct)};border:2px solid white;box-shadow:0 2px 6px rgb(0 0 0/.35)`;
  return el;
}

function LiveMap({ routes = [], zones = [], shelters = [], teams = [], points = [], onSelect, onPick, picked, me, followMe = true, onMode, visible }: IncidentMapProps & { onMode: (m: "map" | "fallback") => void; visible: boolean }) {
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const flewToMe = useRef(false);
  const fitted = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const teamMarkers = useRef<maplibregl.Marker[]>([]);
  const zoneMarkers = useRef<maplibregl.Marker[]>([]);
  const pickMarker = useRef<maplibregl.Marker | null>(null);
  const cb = useRef({ onSelect, onPick });
  cb.current = { onSelect, onPick };

  useEffect(() => {
    if (!ref.current) return;
    let loaded = false;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({ container: ref.current, style: CARTO_STYLE ?? OPENFREEMAP, center: CENTER, zoom: 10.3, attributionControl: { compact: true } });
    } catch { onMode("fallback"); return; }
    map.current = m;
    const timer = setTimeout(() => { if (!loaded) onMode("fallback"); }, 6000);
    m.on("load", () => { loaded = true; clearTimeout(timer); onMode("map"); m.resize(); });
    let usingCarto = !!CARTO_STYLE;
    let tileErrors = 0;
    m.on("error", () => {
      // CARTO key rejected / unreachable -> switch to OpenFreeMap once; anything else before load -> SVG map
      if (usingCarto && ++tileErrors >= 3) { usingCarto = false; m.setStyle(OPENFREEMAP); return; }
      if (!loaded && !usingCarto) { clearTimeout(timer); onMode("fallback"); }
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("click", (e) => {
      if (!cb.current.onPick) return;
      const { lat, lng } = e.lngLat;
      cb.current.onPick({ lat: +lat.toFixed(5), lng: +lng.toFixed(5), area: nearestArea(lat, lng).name });
    });
    return () => { clearTimeout(timer); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = points.map((p) => {
      const el = dotEl(p);
      el.addEventListener("click", (ev) => { ev.stopPropagation(); cb.current.onSelect?.(p.id); });
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
    });
  }, [points]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    teamMarkers.current.forEach((x) => x.remove());
    teamMarkers.current = teams.map((t) => new maplibregl.Marker({ element: teamEl(t) }).setLngLat([t.lng, t.lat]).addTo(m));
  }, [teams]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    zoneMarkers.current.forEach((x) => x.remove());
    zoneMarkers.current = [
      ...zones.map((z) => new maplibregl.Marker({ element: zoneEl(z) }).setLngLat([z.lng, z.lat]).addTo(m)),
      ...shelters.map((sh) => new maplibregl.Marker({ element: shelterEl(sh) }).setLngLat([sh.lng, sh.lat]).addTo(m)),
    ];
  }, [zones, shelters]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    pickMarker.current?.remove();
    if (picked) pickMarker.current = new maplibregl.Marker({ color: "#dc2626" }).setLngLat([picked.lng, picked.lat]).addTo(m);
  }, [picked]);

  // live "you are here" dot + accuracy halo
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (!me) { meMarker.current?.remove(); meMarker.current = null; return; }
    if (!meMarker.current) meMarker.current = new maplibregl.Marker({ element: meEl() }).setLngLat([me.lng, me.lat]).addTo(m);
    else meMarker.current.setLngLat([me.lng, me.lat]);
    const halo = () => {
      const data = circleGeo(me.lat, me.lng, Math.max(15, Math.min(me.accuracy ?? 30, 2000)));
      const src = m.getSource("me-acc") as maplibregl.GeoJSONSource | undefined;
      if (src) { src.setData(data); return; }
      m.addSource("me-acc", { type: "geojson", data });
      m.addLayer({ id: "me-acc-fill", type: "fill", source: "me-acc", paint: { "fill-color": ME_BLUE, "fill-opacity": 0.12 } });
      m.addLayer({ id: "me-acc-line", type: "line", source: "me-acc", paint: { "line-color": ME_BLUE, "line-opacity": 0.45, "line-width": 1.2 } });
    };
    if (m.isStyleLoaded()) halo(); else m.once("load", halo);
    m.on("style.load", halo); // re-add if the basemap style is swapped (CARTO -> OpenFreeMap)
    if (followMe && !flewToMe.current) { flewToMe.current = true; m.flyTo({ center: [me.lng, me.lat], zoom: 14.5, duration: 1200 }); }
    return () => { m.off("style.load", halo); };
  }, [me?.lat, me?.lng, me?.accuracy, followMe]); // eslint-disable-line react-hooks/exhaustive-deps

  // team -> incident routes (GeoJSON line layers, solid = road, dashed = straight-line fallback)
  const routeKey = JSON.stringify(routes.map((r) => [r.id, r.label, r.coords.length, r.coords[0], r.coords[r.coords.length - 1]]));
  useEffect(() => {
    const m = map.current; if (!m) return;
    const fc = (dashed: boolean) => ({
      type: "FeatureCollection" as const,
      features: routes.filter((r) => r.coords.length >= 2 && /straight/i.test(r.label ?? "") === dashed).map((r) => ({
        type: "Feature" as const, properties: { id: r.id }, geometry: { type: "LineString" as const, coordinates: r.coords.map(([la, ln]) => [ln, la]) },
      })),
    });
    const draw = () => {
      for (const [id, dashed] of [["routes-road", false], ["routes-straight", true]] as const) {
        const src = m.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (src) { src.setData(fc(dashed)); continue; }
        m.addSource(id, { type: "geojson", data: fc(dashed) });
        m.addLayer({ id: `${id}-casing`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 } });
        m.addLayer({ id: `${id}-line`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ROUTE_BLUE, "line-width": 4, ...(dashed ? { "line-dasharray": [2, 1.5] } : {}) } });
      }
      const all = routes.flatMap((r) => r.coords);
      if (all.length >= 2 && !fitted.current) {
        fitted.current = true;
        const b = all.reduce((bb, [la, ln]) => bb.extend([ln, la]), new maplibregl.LngLatBounds([all[0][1], all[0][0]], [all[0][1], all[0][0]]));
        m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 800 });
      }
    };
    if (m.isStyleLoaded()) draw(); else m.once("load", draw);
    m.on("style.load", draw);
    return () => { m.off("style.load", draw); };
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (visible) map.current?.resize(); }, [visible]);

  return <div ref={ref} className={cn("absolute inset-0", !visible && "invisible")} />;
}

/* ----------------------------- SVG fallback map ----------------------------- */
const W = 600, H = 680;

function SvgMap({ routes = [], zones = [], shelters = [], teams = [], points = [], onSelect, onPick, picked, me }: IncidentMapProps) {
  const mp = me ? project(me.lat, me.lng, W, H) : null;
  const [hover, setHover] = useState<string | null>(null);
  const coast = useMemo(() => COAST.map(([la, ln]) => project(la, ln, W, H)), []);
  const coastPath = coast.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const sea = `M${coast[0].x},-3000 ${coastPath.slice(1).replace(/^/, "L")} L${coast[coast.length - 1].x},${H + 3000} L${W + 3000},${H + 3000} L${W + 3000},-3000 Z`;
  const river = (pts: [number, number][]) => pts.map(([la, ln], i) => { const p = project(la, ln, W, H); return `${i ? "L" : "M"}${p.x},${p.y}`; }).join(" ");

  function click(e: React.MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const svg = e.currentTarget; const r = svg.getBoundingClientRect();
    // account for preserveAspectRatio="xMidYMid meet"
    const s = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
    const x = (e.clientX - r.left - ox) / s, y = (e.clientY - r.top - oy) / s;
    const ll = unproject(x, y, W, H);
    onPick({ ...ll, area: nearestArea(ll.lat, ll.lng).name });
  }
  const pk = picked ? project(picked.lat, picked.lng, W, H) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={cn("absolute inset-0 size-full", onPick && "cursor-crosshair")} onClick={click}>
      <defs>
        <pattern id="mgrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="var(--line)" strokeWidth="0.6" /></pattern>
        <linearGradient id="seag" x1="0" x2="1"><stop offset="0" stopColor="#7dd3fc" stopOpacity="0.45" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0.25" /></linearGradient>
      </defs>
      <rect x={-3000} y={-3000} width={W + 6000} height={H + 6000} fill="var(--surface)" />
      <rect x={-3000} y={-3000} width={W + 6000} height={H + 6000} fill="url(#mgrid)" />
      {/* main roads (schematic) */}
      <g stroke="var(--line)" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9">
        <path d={river([[13.07, 80.26], [13.04, 80.234], [13.0, 80.22], [12.95, 80.146], [12.92, 80.1], [12.89, 80.081]])} />
        <path d={river([[13.0, 80.22], [12.98, 80.218], [12.9, 80.228]])} />
        <path d={river([[13.085, 80.21], [13.04, 80.156]])} />
        <path d={river([[13.114, 80.233], [13.073, 80.261], [13.037, 80.268], [13.0, 80.257]])} />
      </g>
      {/* rivers */}
      <g stroke="#38bdf8" strokeWidth="2.5" fill="none" opacity="0.55">
        <path d={river([[13.02, 80.08], [13.015, 80.15], [13.01, 80.2], [13.012, 80.24], [13.015, 80.272]])} />
        <path d={river([[13.09, 80.15], [13.08, 80.2], [13.078, 80.24], [13.08, 80.29]])} />
      </g>
      <path d={sea} fill="url(#seag)" />
      <path d={`M${coast[0].x},-3000 L${coastPath.slice(1)} L${coast[coast.length - 1].x},${H + 3000}`} fill="none" stroke="#0ea5e9" strokeWidth="2" opacity="0.7" />
      <text x={W - 18} y={H * 0.55} textAnchor="end" className="fill-sky-600" style={{ font: "italic 600 13px Inter Variable" }} opacity="0.75">Bay of Bengal</text>
      {/* areas */}
      {AREAS.map((a) => {
        const p = project(a.lat, a.lng, W, H);
        return (
          <g key={a.name}>
            <circle cx={p.x} cy={p.y} r="26" fill="var(--color-accent-500)" opacity="0.07" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="var(--muted)" opacity="0.6" />
            <text x={p.x} y={p.y + 16} textAnchor="middle" style={{ font: "500 11px Inter Variable" }} fill="var(--muted)">{a.name}</text>
          </g>
        );
      })}
      {/* zones */}
      {zones.map((z) => {
        const q = project(z.lat, z.lng, W, H); const c = ZONE_HEX[z.status];
        return (
          <g key={z.id}>
            {z.status === "critical" && !STATIC && <circle cx={q.x} cy={q.y} r="34" fill={c} opacity="0.15" className="sos-ring" />}
            <circle cx={q.x} cy={q.y} r="34" fill={c} fillOpacity="0.16" stroke={c} strokeWidth="1.8" strokeDasharray={z.status === "safe" ? "4 3" : undefined} />
          </g>
        );
      })}
      {/* shelters */}
      {shelters.map((sh) => {
        const q = project(sh.lat, sh.lng, W, H);
        return (
          <g key={sh.id} transform={`translate(${q.x + 10},${q.y - 22})`} onMouseEnter={() => setHover(sh.id)} onMouseLeave={() => setHover(null)}>
            <rect x="-10" y="-10" width="20" height="20" rx="5" fill={shelterHex(sh.pct)} stroke="white" strokeWidth="2" />
            <path d={HOUSE} transform="translate(-6,-6) scale(0.5)" fill="white" />
            {hover === sh.id && (
              <g>
                <rect x="14" y="-12" width={sh.label.length * 6.2 + 60} height="22" rx="6" fill="var(--fg)" opacity="0.92" />
                <text x="22" y="3" style={{ font: "600 11px Inter Variable" }} fill="var(--bg)">{sh.label} · {sh.pct}%</text>
              </g>
            )}
          </g>
        );
      })}
      {/* routes (team -> incident) */}
      {routes.filter((r) => r.coords.length >= 2).map((r) => {
        const d = r.coords.map(([la, ln], i) => { const q = project(la, ln, W, H); return `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");
        const dashed = /straight/i.test(r.label ?? "");
        return (
          <g key={r.id} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={d} stroke="white" strokeWidth="7" opacity="0.85" />
            <path d={d} stroke={ROUTE_BLUE} strokeWidth="4" strokeDasharray={dashed ? "9 6" : undefined} />
          </g>
        );
      })}
      {/* teams (diamonds) */}
      {teams.map((t, k) => {
        const q = project(t.lat, t.lng, W, H);
        const off = (teams.slice(0, k).filter((o) => o.lat === t.lat && o.lng === t.lng).length) * 13;
        return (
          <g key={t.id} transform={`translate(${q.x - 14 + off},${q.y - 14})`} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}>
            <rect x="-6" y="-6" width="12" height="12" rx="2.5" transform="rotate(45)" fill={TEAM_HEX[t.status]} stroke="white" strokeWidth="2" />
            {hover === t.id && (
              <g>
                <rect x="10" y="-28" width={t.label.length * 6.2 + 20} height="22" rx="6" fill="var(--fg)" opacity="0.92" />
                <text x="18" y="-13" style={{ font: "600 11px Inter Variable" }} fill="var(--bg)">{t.label}</text>
              </g>
            )}
          </g>
        );
      })}
      {/* incidents */}
      {[...points].sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).map((p) => {
        const q = project(p.lat, p.lng, W, H);
        const c = p.resolved ? "#94a3b8" : SEV_HEX[p.severity];
        const r = p.severity === "Critical" ? 9 : p.severity === "High" ? 7.5 : 6.5;
        return (
          <g key={p.id} style={{ cursor: onSelect ? "pointer" : undefined }} onClick={(e) => { e.stopPropagation(); onSelect?.(p.id); }}
            onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
            {p.severity === "Critical" && !p.resolved && (
              <>
                <circle cx={q.x} cy={q.y} r={r} fill={c} opacity="0.35" className={STATIC ? "" : "sos-ring"} />
                <circle cx={q.x} cy={q.y} r={r + 7} fill="none" stroke={c} strokeWidth="1.5" opacity="0.5" />
              </>
            )}
            <circle cx={q.x} cy={q.y} r={r} fill={c} stroke="white" strokeWidth="2.5" />
            {hover === p.id && (
              <g>
                <rect x={q.x + 12} y={q.y - 30} width={Math.min(260, p.title.length * 6.4 + 70)} height="24" rx="6" fill="var(--fg)" opacity="0.92" />
                <text x={q.x + 20} y={q.y - 14} style={{ font: "600 11px Inter Variable" }} fill="var(--bg)">{p.id} · {p.title.slice(0, 34)}</text>
              </g>
            )}
          </g>
        );
      })}
      {pk && (
        <g transform={`translate(${pk.x},${pk.y})`}>
          <circle r="16" fill="#dc2626" opacity="0.18" className={STATIC ? "" : "sos-ring"} />
          <path d="M0,0 C-9,-12 -11,-16 -11,-21 A11,11 0 1 1 11,-21 C11,-16 9,-12 0,0Z" fill="#dc2626" stroke="white" strokeWidth="2" />
          <circle cy="-21" r="4" fill="white" />
        </g>
      )}
      {mp && (
        <g transform={`translate(${mp.x},${mp.y})`}>
          <circle r="22" fill={ME_BLUE} opacity="0.14" />
          <circle r="11" fill="none" stroke={ME_BLUE} strokeWidth="2" opacity="0.6" className={STATIC ? "" : "sos-ring"} />
          <circle r="8" fill={ME_BLUE} stroke="white" strokeWidth="3" />
          <text y="-16" textAnchor="middle" style={{ font: "700 11px Inter Variable" }} fill={ME_BLUE}>You</text>
        </g>
      )}
      <text x="10" y={H - 6} style={{ font: "500 10px Inter Variable" }} fill="var(--muted)">Schematic map · Chennai (offline fallback)</text>
    </svg>
  );
}

const sevRank = (s: Severity) => ({ Critical: 3, High: 2, Medium: 1, Low: 0 })[s];
