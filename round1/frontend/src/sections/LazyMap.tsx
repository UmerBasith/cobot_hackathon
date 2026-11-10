import { lazy, Suspense } from "react";
import type { IncidentMapProps } from "./IncidentMap";

const IncidentMap = lazy(() => import("./IncidentMap"));

/** Lazy-loaded map so pages without a map stay light. */
export function LazyMap(props: IncidentMapProps) {
  return (
    <Suspense fallback={<div className="skeleton w-full rounded-xl" style={{ height: props.height ?? 360 }} />}>
      <IncidentMap {...props} />
    </Suspense>
  );
}
export type { MapPoint } from "./IncidentMap";
