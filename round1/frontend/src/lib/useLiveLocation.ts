/**
 * useLiveLocation — follow the device's live GPS position (navigator.geolocation.watchPosition).
 * Starts only when start() is called (browsers block surprise permission prompts), stops on unmount.
 * Note: browsers only allow GPS on https:// or localhost — on a plain http://192.168.x.x address
 * status becomes "insecure" and the UI should offer "tap the map" instead.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type LiveStatus = "idle" | "asking" | "live" | "denied" | "unavailable" | "insecure";
export interface LivePos { lat: number; lng: number; accuracy: number; at: number }

export function useLiveLocation() {
  const [pos, setPos] = useState<LivePos | null>(null);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const watch = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watch.current != null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) { setStatus("insecure"); return; }
    if (!("geolocation" in navigator)) { setStatus("unavailable"); return; }
    stop();
    setStatus("asking");
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), at: p.timestamp });
        setStatus("live");
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { pos, status, start, stop };
}

/** Straight-line distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
