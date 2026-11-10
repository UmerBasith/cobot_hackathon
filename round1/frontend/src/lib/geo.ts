/** Chennai areas (mirrors backend app/geo.py) + a simple lat/lng -> x/y projection for the SVG fallback map. */
export interface Area { name: string; lat: number; lng: number }

export const AREAS: Area[] = [
  { name: "T. Nagar", lat: 13.0418, lng: 80.2341 },
  { name: "Mylapore", lat: 13.0368, lng: 80.2676 },
  { name: "Adyar", lat: 13.0012, lng: 80.2565 },
  { name: "Egmore", lat: 13.0732, lng: 80.2609 },
  { name: "Velachery", lat: 12.9815, lng: 80.218 },
  { name: "Porur", lat: 13.0382, lng: 80.1565 },
  { name: "Anna Nagar", lat: 13.085, lng: 80.2101 },
  { name: "Sholinganallur", lat: 12.901, lng: 80.2279 },
  { name: "Tambaram", lat: 12.9249, lng: 80.1 },
  { name: "Perambur", lat: 13.1143, lng: 80.2329 },
  { name: "Guindy", lat: 13.0067, lng: 80.2206 },
  { name: "Royapuram", lat: 13.1137, lng: 80.2954 },
  { name: "Chromepet", lat: 12.9516, lng: 80.1462 },
  { name: "Vandalur", lat: 12.8916, lng: 80.081 },
];

export const CENTER: [number, number] = [80.2, 12.98]; // lng, lat
export const BOUNDS = { minLat: 12.85, maxLat: 13.2, minLng: 80.03, maxLng: 80.34 };

export const areaByName = (n: string) => AREAS.find((a) => a.name === n);

/** Nearest named area to a point (for map taps). */
export function nearestArea(lat: number, lng: number): Area {
  let best = AREAS[0], d = Infinity;
  for (const a of AREAS) {
    const dd = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
    if (dd < d) { d = dd; best = a; }
  }
  return best;
}

/** Equirectangular projection into a W x H box (good enough at city scale). */
export function project(lat: number, lng: number, W: number, H: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
  return { x, y };
}

export function unproject(x: number, y: number, W: number, H: number) {
  const lng = BOUNDS.minLng + (x / W) * (BOUNDS.maxLng - BOUNDS.minLng);
  const lat = BOUNDS.maxLat - (y / H) * (BOUNDS.maxLat - BOUNDS.minLat);
  return { lat: +lat.toFixed(5), lng: +lng.toFixed(5) };
}

/** Approximate Chennai coastline (Bay of Bengal), north to south. */
export const COAST: [number, number][] = [
  [13.2, 80.318], [13.15, 80.302], [13.12, 80.297], [13.09, 80.293], [13.06, 80.284],
  [13.03, 80.28], [13.0, 80.271], [12.97, 80.262], [12.94, 80.255], [12.9, 80.25], [12.85, 80.245],
];
