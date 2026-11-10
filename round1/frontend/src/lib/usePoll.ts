import { useCallback, useEffect, useRef, useState } from "react";

/** Load data now and every `ms` (default 5 s). Returns [data, reload, lastUpdated]. */
export function usePoll<T>(fn: () => Promise<T>, ms = 5000, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    const d = await fnRef.current();
    setData(d); setAt(new Date());
  }, []);
  useEffect(() => {
    reload();
    const id = setInterval(() => { if (document.visibilityState === "visible") reload(); }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, reload, ...deps]);
  return [data, reload, at] as const;
}
