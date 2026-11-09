/**
 * Talk to the FastAPI backend. Every call goes to /api/... which Vite proxies
 * to http://127.0.0.1:8000 (see vite.config.ts).
 *
 * DEMO SAFETY: use `withFallback(api.post(...), mockValue)` for anything shown
 * in the live demo. If the backend is down the UI still shows sensible data
 * instead of an error screen.
 */
const BASE = "/api";

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const isForm = body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    }
    const type = res.headers.get("content-type") ?? "";
    return (type.includes("application/json") ? await res.json() : await res.text()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, file: File, field = "file") => {
    const fd = new FormData();
    fd.append(field, file);
    return request<T>("POST", path, fd, 60000);
  },
};

export async function withFallback<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.warn("[api] using fallback data:", err);
    return fallback;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
