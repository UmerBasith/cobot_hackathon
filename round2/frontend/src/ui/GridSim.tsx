/**
 * Robot / vehicle / agent simulation on a grid (good for robotics, cobots,
 * warehouse, traffic, evacuation, delivery problems).
 * - Click cells to add/remove obstacles.
 * - Each robot plans the shortest path with A* and moves step by step.
 * - Robots treat each other as temporary obstacles (simple collision avoidance).
 *
 * <GridSim cols={24} rows={14} robots={[{ id: "R1", start: [1,1], goal: [20,10] }]} />
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { astar, type Cell } from "@/lib/astar";
import { Button } from "./core";
import { chartColors } from "./charts";

export interface RobotSpec { id: string; start: Cell; goal: Cell }
interface RobotState extends RobotSpec { pos: Cell; path: Cell[]; done: boolean; steps: number; waits: number }

const key = (c: Cell) => `${c[0]},${c[1]}`;

export function GridSim({ cols = 24, rows = 14, robots: specs, initialObstacles, speedMs = 180, onStats }: {
  cols?: number; rows?: number; robots: RobotSpec[]; initialObstacles?: Cell[]; speedMs?: number;
  onStats?: (s: { delivered: number; totalSteps: number; waits: number; tick: number }) => void;
}) {
  const randomObstacles = useCallback(() => {
    const reserved = new Set(specs.flatMap((r) => [key(r.start), key(r.goal)]));
    const set = new Set<string>();
    for (let i = 0; i < cols * rows * 0.18; i++) {
      const c: Cell = [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)];
      if (!reserved.has(key(c))) set.add(key(c));
    }
    return set;
  }, [cols, rows, specs]);

  const [walls, setWalls] = useState<Set<string>>(() => initialObstacles ? new Set(initialObstacles.map(key)) : randomObstacles());
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const init = useCallback((w: Set<string>): RobotState[] =>
    specs.map((s) => ({ ...s, pos: s.start, path: astar(s.start, s.goal, cols, rows, w), done: false, steps: 0, waits: 0 })), [specs, cols, rows]);
  const [bots, setBots] = useState<RobotState[]>(() => init(walls));

  const reset = (w = walls) => { setRunning(false); setTick(0); setBots(init(w)); };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setBots((prev) => {
        const occupied = new Set(prev.map((b) => key(b.pos)));
        return prev.map((b) => {
          if (b.done) return b;
          if (key(b.pos) === key(b.goal)) return { ...b, done: true };
          let path = b.path;
          if (path.length < 2) {
            const blocked = new Set([...walls, ...[...occupied].filter((k) => k !== key(b.pos))]);
            path = astar(b.pos, b.goal, cols, rows, blocked);
            if (path.length < 2) return { ...b, waits: b.waits + 1 };
          }
          const next = path[1];
          if (occupied.has(key(next))) return { ...b, path: [], waits: b.waits + 1 }; // replan next tick
          occupied.delete(key(b.pos)); occupied.add(key(next));
          return { ...b, pos: next, path: path.slice(1), steps: b.steps + 1, done: key(next) === key(b.goal) };
        });
      });
    }, speedMs);
    return () => clearInterval(id);
  }, [running, walls, cols, rows, speedMs]);

  const delivered = bots.filter((b) => b.done).length;
  const totalSteps = bots.reduce((a, b) => a + b.steps, 0);
  const waits = bots.reduce((a, b) => a + b.waits, 0);
  useEffect(() => { onStats?.({ delivered, totalSteps, waits, tick }); }, [delivered, totalSteps, waits, tick, onStats]);
  useEffect(() => { if (running && delivered === bots.length) setRunning(false); }, [delivered, bots.length, running]);

  const pathCells = useMemo(() => {
    const m = new Map<string, number>();
    bots.forEach((b, i) => !b.done && b.path.forEach((c) => m.set(key(c), i)));
    return m;
  }, [bots]);

  function toggle(c: Cell) {
    if (running) return;
    const k = key(c);
    if (specs.some((s) => key(s.start) === k || key(s.goal) === k)) return;
    const w = new Set(walls);
    if (w.has(k)) w.delete(k); else w.add(k);
    setWalls(w); reset(w);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={running ? Pause : Play} onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Run simulation"}</Button>
        <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => reset()}>Reset</Button>
        <Button size="sm" variant="outline" icon={Shuffle} onClick={() => { const w = randomObstacles(); setWalls(w); reset(w); }}>New layout</Button>
        <span className="ml-auto font-mono text-xs text-muted">tick {tick} · delivered {delivered}/{bots.length} · steps {totalSteps} · waits {waits}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-2/50 p-2">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const c: Cell = [i % cols, Math.floor(i / cols)];
            const k = key(c);
            const botIdx = bots.findIndex((b) => key(b.pos) === k);
            const goalIdx = specs.findIndex((s) => key(s.goal) === k);
            const pIdx = pathCells.get(k);
            return (
              <button key={k} onClick={() => toggle(c)} aria-label={k}
                className="relative aspect-square rounded-[3px] transition-colors cursor-pointer"
                style={{
                  background: walls.has(k) ? "var(--fg)" : pIdx !== undefined ? `color-mix(in oklch, ${chartColors[pIdx % 6]} 18%, var(--surface))` : "var(--surface)",
                  opacity: walls.has(k) ? 0.75 : 1,
                }}>
                {goalIdx >= 0 && <span className="absolute inset-[18%] rounded-sm border-2" style={{ borderColor: chartColors[goalIdx % 6] }} />}
                {botIdx >= 0 && (
                  <span className="absolute inset-[8%] grid place-items-center rounded-full text-[9px] font-bold text-white shadow-md transition-all"
                    style={{ background: chartColors[botIdx % 6] }}>{bots[botIdx].id.replace(/\D/g, "") || "•"}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted">Click any cell to add or remove an obstacle. Robots re-plan their route with A* when blocked.</p>
    </div>
  );
}
