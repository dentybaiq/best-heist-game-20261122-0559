// VELVET VAULT — the heist itself: guards, cameras, cones, alarm, loot, escape.
import { TILE, COLS, ROWS, PLAYER, GUARD, CAMERA, ALARM, SMOKE } from './config.js';
import { LEVELS, LOOT_VALUE, LOOT_NAME } from './levels.js';
import { makeRng } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_LEVEL_CLEAR = 2;
export const EVENT_LOOT = 4;
export const EVENT_FUSE = 8;
export const EVENT_SPOTTED = 16;

const SOLID = new Set(['#', 'T', 'D']);
const BLOCK_SIGHT = new Set(['#', 'T']);

/** True when tile (tx,ty) stops movement. */
export function isSolid(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return SOLID.has(grid[ty][tx]);
}
/** True when tile (tx,ty) blocks a watcher's line of sight. */
export function blocksSight(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return BLOCK_SIGHT.has(grid[ty][tx]);
}

/** Line of sight between two pixel points, sampled along the ray. */
export function hasLineOfSight(grid, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x1 + dx * t) / TILE);
    const ty = Math.floor((y1 + dy * t) / TILE);
    if (blocksSight(grid, tx, ty)) return false;
  }
  return true;
}

/** Distance a ray from (x,y) at angle travels before hitting a wall. */
export function castRay(grid, x, y, angle, maxDist) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  for (let d = 6; d < maxDist; d += 6) {
    const tx = Math.floor((x + dx * d) / TILE);
    const ty = Math.floor((y + dy * d) / TILE);
    if (blocksSight(grid, tx, ty)) return d;
  }
  return maxDist;
}

/** Is (x,y) inside a watcher's cone (range, angle, line of sight)? */
export function inCone(grid, wx, wy, angle, range, halfAngle, x, y) {
  const dx = x - wx, dy = y - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > halfAngle) return 0;
  if (!hasLineOfSight(grid, wx, wy, x, y)) return 0;
  return 1 - dist / range; // 1 = point blank, 0 = edge
}

/** Is the pixel point inside a smoke cloud? */
function inSmoke(smokes, x, y) {
  for (const s of smokes) {
    if (Math.hypot(x - s.x, y - s.y) < s.radius) return true;
  }
  return false;
}

export class World {
  constructor(seed = 1) {
    this.rng = makeRng(seed);
    this.levelIndex = 0;
    this.score = 0;
    this.attemptsLeft = 3;
    this.totalLoot = 0;
    this.reset();
  }

  loadLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    this.grid = def.map.map((row) => row.split(''));
    this.loot = [];
    this.fuse = null;
    this.player = { x: 0, y: 0, dir: 0, moving: false, sneaking: false };
    this.exit = { x: 0, y: 0 };
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y][x];
        const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
        if (c === 'P') { this.player.x = px; this.player.y = py; this.grid[y][x] = '.'; }
        else if (c === 'X') { this.exit.x = px; this.exit.y = py; this.grid[y][x] = '.'; }
        else if (c === 'F') { this.fuse = { x: px, y: py, used: false }; this.grid[y][x] = '.'; }
        else if (LOOT_VALUE[c]) {
          this.loot.push({ x: px, y: py, kind: c, value: LOOT_VALUE[c], name: LOOT_NAME[c], taken: false, bob: this.rng() * 6.28 });
        }
      }
    }
    this.guards = def.guards.map((g) => {
      const [sx, sy] = g.path[0];
      return {
        path: g.path.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 })),
        wp: 0, x: sx * TILE + TILE / 2, y: sy * TILE + TILE / 2,
        angle: 0, pause: 0, state: 'patrol', // patrol | investigate | chase
        target: null, seen: 0, stuck: 0,
      };
    });
    this.cameras = def.cameras.map((c) => ({
      x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE / 2,
      base: c.angle, angle: c.angle, phase: this.rng() * 6.28, disabled: false,
    }));
    this.alarm = 0;
    this.smokes = [];
    this.smokeLeft = SMOKE.count;
    this.lootValue = 0;
    this.time = 0;
    this.camerasOff = false;
    this.lastSeen = null;
  }

  reset() {
    this.loadLevel(this.levelIndex);
  }

  get target() { return LEVELS[this.levelIndex].target; }
  get levelName() { return LEVELS[this.levelIndex].name; }
  get par() { return LEVELS[this.levelIndex].par; }
  get lootLeft() { return this.loot.filter((l) => !l.taken).length; }

  /** Move a circle through the grid, sliding along walls. Returns distance moved. */
  moveCircle(e, dx, dy, radius) {
    let moved = 0;
    if (dx !== 0) {
      const nx = e.x + dx;
      const top = Math.floor((e.y - radius + 1) / TILE), bottom = Math.floor((e.y + radius - 1) / TILE);
      const edge = Math.floor((nx + Math.sign(dx) * radius) / TILE);
      let hit = false;
      for (let ty = top; ty <= bottom; ty++) if (isSolid(this.grid, edge, ty)) { hit = true; break; }
      if (!hit) { e.x = nx; moved += Math.abs(dx); }
    }
    if (dy !== 0) {
      const ny = e.y + dy;
      const left = Math.floor((e.x - radius + 1) / TILE), right = Math.floor((e.x + radius - 1) / TILE);
      const edge = Math.floor((ny + Math.sign(dy) * radius) / TILE);
      let hit = false;
      for (let tx = left; tx <= right; tx++) if (isSolid(this.grid, tx, edge)) { hit = true; break; }
      if (!hit) { e.y = ny; moved += Math.abs(dy); }
    }
    return moved;
  }

  /** Drop a smoke bomb at the thief's feet. */
  dropSmoke() {
    if (this.smokeLeft <= 0) return false;
    this.smokeLeft -= 1;
    this.smokes.push({ x: this.player.x, y: this.player.y, radius: SMOKE.radius, life: SMOKE.life });
    return true;
  }

  /** One simulation step. input: {mx, my, sneak, smoke}. Returns event flags. */
  step(dt, input) {
    this.time += dt;
    let events = EVENT_NONE;
    const p = this.player;

    // --- the thief moves ---
    const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(input.mx, input.my);
    p.sneaking = !!input.sneak;
    p.moving = len > 0;
    if (len > 0) {
      p.dir = Math.atan2(input.my, input.mx);
      this.moveCircle(p, (input.mx / len) * speed * dt, (input.my / len) * speed * dt, PLAYER.radius);
    }
    if (input.smoke) this.dropSmoke();

    // --- smoke fades ---
    for (const s of this.smokes) s.life -= dt;
    this.smokes = this.smokes.filter((s) => s.life > 0);

    // --- loot ---
    for (const l of this.loot) {
      if (!l.taken && Math.hypot(p.x - l.x, p.y - l.y) < 24) {
        l.taken = true;
        this.lootValue += l.value;
        this.totalLoot += l.value;
        events |= EVENT_LOOT;
      }
    }

    // --- fuse box kills the cameras ---
    if (this.fuse && !this.fuse.used && Math.hypot(p.x - this.fuse.x, p.y - this.fuse.y) < 26) {
      this.fuse.used = true;
      this.camerasOff = true;
      for (const c of this.cameras) c.disabled = true;
      events |= EVENT_FUSE;
    }

    // --- who can see the thief? ---
    const hidden = inSmoke(this.smokes, p.x, p.y);
    const dark = this.grid[Math.floor(p.y / TILE)][Math.floor(p.x / TILE)] === ',';
    let seen = 0;
    if (!hidden) {
      for (const g of this.guards) {
        const s = inCone(this.grid, g.x, g.y, g.angle, GUARD.range, GUARD.halfAngle, p.x, p.y);
        if (s > 0) { seen = Math.max(seen, s); g.seen = s; }
      }
      if (!this.camerasOff) {
        for (const c of this.cameras) {
          const s = inCone(this.grid, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, p.x, p.y);
          if (s > 0) seen = Math.max(seen, s);
        }
      }
    }
    if (seen > 0) {
      let rate = ALARM.baseRate + ALARM.closeRate * seen;
      if (dark) rate *= ALARM.darkFactor;
      if (p.sneaking) rate *= ALARM.sneakFactor;
      this.alarm = Math.min(100, this.alarm + rate * dt * 10);
      this.lastSeen = { x: p.x, y: p.y, t: this.time };
      events |= EVENT_SPOTTED;
    } else {
      this.alarm = Math.max(0, this.alarm - ALARM.decayRate * dt);
    }

    // --- noise: upright footsteps pull nearby guards over ---
    if (p.moving && !p.sneaking) {
      for (const g of this.guards) {
        if (g.state === 'patrol' && Math.hypot(g.x - p.x, g.y - p.y) < PLAYER.noiseRadius) {
          g.state = 'investigate';
          g.target = { x: p.x, y: p.y };
        }
      }
    }

    // --- guards think and move ---
    for (const g of this.guards) {
      if (this.alarm >= ALARM.chaseAt && this.lastSeen) {
        g.state = 'chase';
        g.target = { x: this.lastSeen.x, y: this.lastSeen.y };
      } else if (g.state === 'chase' && this.alarm < 25) {
        g.state = 'patrol';
        g.target = null;
      }
      let tx, ty, spd = GUARD.speed;
      if (g.state === 'chase' || g.state === 'investigate') {
        tx = g.target.x; ty = g.target.y; spd = GUARD.chaseSpeed;
      } else {
        const wp = g.path[g.wp];
        tx = wp.x; ty = wp.y;
      }
      const dx = tx - g.x, dy = ty - g.y;
      const dist = Math.hypot(dx, dy);
      if (g.state === 'patrol' && dist < 6) {
        if (g.pause <= 0) g.pause = GUARD.pauseAtWaypoint;
        g.wp = (g.wp + 1) % g.path.length;
      } else if (g.state !== 'patrol' && dist < 10) {
        g.state = 'patrol';
        g.target = null;
        // resume from the nearest waypoint
        let best = 0, bestD = Infinity;
        g.path.forEach((w, i) => {
          const d = Math.hypot(w.x - g.x, w.y - g.y);
          if (d < bestD) { bestD = d; best = i; }
        });
        g.wp = best;
      }
      if (g.pause > 0) {
        g.pause -= dt;
      } else if (dist > 2) {
        const stepLen = Math.min(dist, spd * dt);
        const nx = g.x + (dx / dist) * stepLen, ny = g.y + (dy / dist) * stepLen;
        g.angle = Math.atan2(dy, dx);
        // guards slide along walls too; if blocked, wait a beat
        const ox = g.x, oy = g.y;
        this.moveCircle(g, nx - g.x, ny - g.y, 11);
        if (Math.hypot(g.x - ox, g.y - oy) < stepLen * 0.2) {
          g.stuck += dt;
          if (g.stuck > 0.8) { g.state = 'patrol'; g.stuck = 0; g.wp = (g.wp + 1) % g.path.length; }
        } else g.stuck = 0;
      }
    }

    // --- cameras sweep ---
    for (const c of this.cameras) {
      if (c.disabled) continue;
      c.angle = c.base + Math.sin(this.time * CAMERA.sweepSpeed + c.phase) * (CAMERA.sweepArc / 2);
    }

    // --- a guard who walks into the thief has caught them, full stop ---
    for (const g of this.guards) {
      if (Math.hypot(g.x - p.x, g.y - p.y) < 20) {
        this.alarm = 100;
        return events | EVENT_BUSTED;
      }
    }

    // --- busted? ---
    if (this.alarm >= 100) return events | EVENT_BUSTED;

    // --- escaped with the target? ---
    if (this.lootValue >= this.target && Math.hypot(p.x - this.exit.x, p.y - this.exit.y) < 26) {
      return events | EVENT_LEVEL_CLEAR;
    }
    return events;
  }
}
