export interface GridCell {
  x: number;
  z: number;
}

export class NavGrid {
  readonly width: number;
  readonly height: number;
  readonly cellSize: number;
  readonly originX: number;
  readonly originZ: number;
  blocked: Uint8Array;

  constructor(
    width: number,
    height: number,
    cellSize: number,
    originX: number,
    originZ: number
  ) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.originX = originX;
    this.originZ = originZ;
    this.blocked = new Uint8Array(width * height);
  }

  worldToCell(x: number, z: number): GridCell {
    return {
      x: Math.floor((x - this.originX) / this.cellSize),
      z: Math.floor((z - this.originZ) / this.cellSize),
    };
  }

  cellToWorld(cx: number, cz: number): { x: number; z: number } {
    return {
      x: this.originX + (cx + 0.5) * this.cellSize,
      z: this.originZ + (cz + 0.5) * this.cellSize,
    };
  }

  inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.width && cz < this.height;
  }

  isBlocked(cx: number, cz: number): boolean {
    if (!this.inBounds(cx, cz)) return true;
    return this.blocked[cz * this.width + cx] === 1;
  }

  setBlocked(cx: number, cz: number, value: boolean): void {
    if (!this.inBounds(cx, cz)) return;
    this.blocked[cz * this.width + cx] = value ? 1 : 0;
  }

  blockCircle(wx: number, wz: number, radius: number): void {
    const r = Math.ceil(radius / this.cellSize);
    const c = this.worldToCell(wx, wz);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz <= r * r) {
          this.setBlocked(c.x + dx, c.z + dz, true);
        }
      }
    }
  }

  /** A* path from world start to world goal. Returns world waypoints. */
  findPath(
    sx: number,
    sz: number,
    gx: number,
    gz: number
  ): { x: number; z: number }[] {
    const start = this.worldToCell(sx, sz);
    const goal = this.worldToCell(gx, gz);
    if (!this.inBounds(start.x, start.z) || !this.inBounds(goal.x, goal.z)) {
      return [{ x: gx, z: gz }];
    }
    // Allow pathing from/to temporarily blocked endpoints
    const startBlocked = this.isBlocked(start.x, start.z);
    const goalBlocked = this.isBlocked(goal.x, goal.z);
    this.setBlocked(start.x, start.z, false);
    this.setBlocked(goal.x, goal.z, false);

    const key = (x: number, z: number) => z * this.width + x;
    const open: { x: number; z: number; f: number; g: number }[] = [
      { x: start.x, z: start.z, f: 0, g: 0 },
    ];
    const came = new Map<number, number>();
    const gScore = new Map<number, number>([[key(start.x, start.z), 0]]);
    const closed = new Set<number>();
    const heuristic = (x: number, z: number) =>
      Math.hypot(x - goal.x, z - goal.z);

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    let iterations = 0;
    while (open.length > 0 && iterations++ < 8000) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift()!;
      const ck = key(cur.x, cur.z);
      if (closed.has(ck)) continue;
      closed.add(ck);

      if (cur.x === goal.x && cur.z === goal.z) {
        const path: { x: number; z: number }[] = [];
        let k: number | undefined = ck;
        while (k !== undefined) {
          const cx = k % this.width;
          const cz = Math.floor(k / this.width);
          path.push(this.cellToWorld(cx, cz));
          k = came.get(k);
        }
        path.reverse();
        path[path.length - 1] = { x: gx, z: gz };
        if (startBlocked) this.setBlocked(start.x, start.z, true);
        if (goalBlocked) this.setBlocked(goal.x, goal.z, true);
        return path;
      }

      for (const [dx, dz] of dirs) {
        const nx = cur.x + dx;
        const nz = cur.z + dz;
        if (this.isBlocked(nx, nz)) continue;
        const nk = key(nx, nz);
        if (closed.has(nk)) continue;
        const step = dx !== 0 && dz !== 0 ? 1.414 : 1;
        const tentative = (gScore.get(ck) ?? Infinity) + step;
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          came.set(nk, ck);
          gScore.set(nk, tentative);
          open.push({
            x: nx,
            z: nz,
            g: tentative,
            f: tentative + heuristic(nx, nz),
          });
        }
      }
    }

    if (startBlocked) this.setBlocked(start.x, start.z, true);
    if (goalBlocked) this.setBlocked(goal.x, goal.z, true);
    return [{ x: gx, z: gz }];
  }
}
