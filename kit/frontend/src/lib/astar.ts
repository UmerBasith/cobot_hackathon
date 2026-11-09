/** A* shortest path on a 4-connected grid. Returns [start, ..., goal] or [] if no path. */
export type Cell = [number, number];

export function astar(start: Cell, goal: Cell, cols: number, rows: number, blocked: Set<string>): Cell[] {
  const k = (x: number, y: number) => `${x},${y}`;
  const h = (x: number, y: number) => Math.abs(x - goal[0]) + Math.abs(y - goal[1]);
  const open: { x: number; y: number; f: number; g: number }[] = [{ x: start[0], y: start[1], g: 0, f: h(start[0], start[1]) }];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[k(start[0], start[1]), 0]]);
  const goalKey = k(goal[0], goal[1]);

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = k(cur.x, cur.y);
    if (ck === goalKey) {
      const path: Cell[] = [];
      let p: string | undefined = ck;
      while (p) { const [x, y] = p.split(",").map(Number); path.unshift([x, y]); p = came.get(p); }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nk = k(nx, ny);
      if (blocked.has(nk) && nk !== goalKey) continue;
      const g = cur.g + 1;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return [];
}
