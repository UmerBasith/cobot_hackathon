/**
 * Screenshot mode: open any page with ?shot=1 and every animation jumps to its
 * final state (numbers, charts, gauges). tools/screenshot.ps1 adds it for you,
 * so deck/doc screenshots never show half-drawn charts.
 */
export const STATIC = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("shot");
