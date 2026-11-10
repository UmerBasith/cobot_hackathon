/**
 * Chennai incident map. MapLibre + CARTO Voyager; if the style fails or takes >6 s,
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
import { SEV_HEX } from "./IncidentUI";

export interface MapPoint { id: string; lat: number; lng: number; severity: Severity; title: string; resolved?: boolean }

export interface TeamPoint { id: string; lat: number; lng: number; label: string; status: "available" | "busy" | "offline" }
const TEAM_HEX = { available: "#2563eb", busy: "#7c3aed", offline: "#94a3b8" };

export interface IncidentMapProps {
  points?: MapPoint[];
  teams?: TeamPoint[];
  onSelect?: (id: string) => void;
  /** Pick mode: tap the map to choose a location. */
  onPick?: (p: { lat: number; lng: number; area: string }) => void;
  picked?: { lat: number; lng: number } | null;
  className?: string;
  height?: number | string;
}

<<<<<<< Updated upstream
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
=======
// CARTO Voyager basemap (light, clean, labels in English). Key comes from .env.local (VITE_CARTO_API_KEY),
// never hard-coded or committed. OpenFreeMap is kept as a backup style.
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined) ?? "";
const STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const withCartoKey = (url: string) =>
  CARTO_KEY && url.includes("cartocdn.com") ? { url: url + (url.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(CARTO_KEY) } : { url };
>>>>>>> Stashed changes

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

function dotEl(p: MapPoint) {
  const el = document.createElement("button");
  el.title = `${p.id} · ${p.title}`;
  el.className = "resq-dot";
  const c = SEV_HEX[p.severity];
  const size = p.severity === "Critical" ? 18 : p.severity === "High" ? 15 : 13;
  el.style.cssText = `position:relative;width:${size}px;height:${size}px;border-radius:999px;background:${p.resolved ? "#94a3b8" : c};border:2.5px solid white;box-shadow:0 2px 6px rgb(0 0 0/.35);cursor:pointer;padding:0`;
  if (p.severity === "Critical" && !p.resolved) {
    const ring = document.createElement("span");
    ring.style.cssText = `position:absolute;inset:-3px;border-radius:999px;border:2px solid ${c};animation:sos-ring 1.6s ease-out infinite`;
    el.appendChild(ring);
  }
  return el;
}

function teamEl(t: TeamPoint) {
  const el = document.createElement("div");
  el.title = `${t.label} · ${t.status}`;
  el.style.cssText = `width:16px;height:16px;border-radius:4px;background:${TEAM_HEX[t.status]};border:2.5px solid white;box-shadow:0 2px 6px rgb(0 0 0/.35);transform:rotate(45deg)`;
  return el;
}

function LiveMap({ teams = [], points = [], onSelect, onPick, picked, onMode, visible }: IncidentMapProps & { onMode: (m: "map" | "fallback") => void; visible: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const teamMarkers = useRef<maplibregl.Marker[]>([]);
  const pickMarker = useRef<maplibregl.Marker | null>(null);
  const cb = useRef({ onSelect, onPick });
  cb.current = { onSelect, onPick };

  useEffect(() => {
    if (!ref.current) return;
    let loaded = false;
    let m: maplibregl.Map;
    try {
<<<<<<< Updated upstream
      m = new maplibregl.Map({ container: ref.current, style: CARTO_STYLE ?? OPENFREEMAP, center: CENTER, zoom: 10.3, attributionControl: { compact: true } });
=======
      m = new maplibregl.Map({ container: ref.current, style: STYLE, center: CENTER, zoom: 10.3, attributionControl: { compact: true },
        transformRequest: (url) => withCartoKey(url) });
>>>>>>> Stashed changes
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
    pickMarker.current?.remove();
    if (picked) pickMarker.current = new maplibregl.Marker({ color: "#dc2626" }).setLngLat([picked.lng, picked.lat]).addTo(m);
  }, [picked]);

  useEffect(() => { if (visible) map.current?.resize(); }, [visible]);

  return <div ref={ref} className={cn("absolute inset-0", !visible && "invisible")} />;
}

/* ----------------------------- SVG fallback map ----------------------------- */
const W = 600, H = 680;

function SvgMap({ teams = [], points = [], onSelect, onPick, picked }: IncidentMapProps) {
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
      <text x="10" y={H - 6} style={{ font: "500 10px Inter Variable" }} fill="var(--muted)">Schematic map · Chennai (offline fallback)</text>
    </svg>
  );
}

const sevRank = (s: Severity) => ({ Critical: 3, High: 2, Medium: 1, Low: 0 })[s];
