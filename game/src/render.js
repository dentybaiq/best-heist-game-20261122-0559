// VELVET VAULT — every pixel the judge sees: the museum, the cones, the loot, the HUD.
import { TILE, COLS, ROWS, HUD_H, VIEW_W, VIEW_H, GUARD, CAMERA, SMOKE } from './config.js';
import { LOOT_VALUE } from './levels.js';
import { castRay } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

const GOLD = '#c9a227';
const WALL_TOP = '#3d2b3f';
const WALL_FACE = '#241a26';

function fmtMoney(n) {
  return '$' + n.toLocaleString('en-US');
}

/** The watcher's vision cone, clipped by walls: a polygon from raycasts.
 *  Points are in playfield coordinates; the caller adds HUD_H when drawing. */
function conePoints(grid, x, y, angle, range, halfAngle) {
  const rays = 26;
  const pts = [[x, y]];
  for (let i = 0; i <= rays; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = castRay(grid, x, y, a, range);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return pts;
}

function drawCone(ctx, grid, x, y, angle, range, halfAngle, rgb, alpha, edge) {
  // A cone that reads at a glance: strong near the watcher, still visible at range.
  const grad = ctx.createRadialGradient(x, HUD_H + y, 8, x, HUD_H + y, range);
  grad.addColorStop(0, `rgba(${rgb},${alpha})`);
  grad.addColorStop(0.55, `rgba(${rgb},${(alpha * 0.62).toFixed(3)})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  const pts = conePoints(grid, x, y, angle, range, halfAngle);
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, HUD_H + py);
    else ctx.lineTo(px, HUD_H + py);
  });
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLoot(ctx, l, time) {
  const bob = Math.sin(time * 2.4 + l.bob) * 2;
  const x = l.x, y = l.y + bob;
  ctx.save();
  ctx.shadowColor = 'rgba(255,215,0,0.9)';
  ctx.shadowBlur = 12;
  if (l.kind === 'p') {
    // a framed painting, hung on nothing: it floats, glinting
    ctx.fillStyle = '#8a6d1f';
    ctx.fillRect(x - 13, y - 10, 26, 20);
    ctx.fillStyle = ['#7a4a8f', '#3f6d8e', '#8e3f3f', '#3f8e5a'][Math.floor(l.bob) % 4];
    ctx.fillRect(x - 10, y - 7, 20, 14);
    ctx.strokeStyle = '#e8c85a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 13, y - 10, 26, 20);
  } else if (l.kind === '*') {
    ctx.fillStyle = '#57d7f0';
    ctx.beginPath();
    ctx.moveTo(x, y - 11); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 9, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, y - 11); ctx.lineTo(x + 9, y); ctx.lineTo(x, y); ctx.lineTo(x - 9, y);
    ctx.closePath(); ctx.fill();
  } else if (l.kind === 'o') {
    ctx.fillStyle = '#f0b429';
    ctx.beginPath();
    ctx.arc(x, y - 2, 7, 0, 6.29); ctx.fill();
    ctx.fillRect(x - 6, y + 3, 12, 7);
    ctx.fillStyle = '#8a5a00';
    ctx.beginPath(); ctx.arc(x - 2.5, y - 3, 1.6, 0, 6.29); ctx.arc(x + 2.5, y - 3, 1.6, 0, 6.29); ctx.fill();
  } else {
    // crown diamond
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 4); ctx.lineTo(x - 8, y - 12); ctx.lineTo(x - 3, y - 5);
    ctx.lineTo(x, y - 13); ctx.lineTo(x + 3, y - 5); ctx.lineTo(x + 8, y - 12); ctx.lineTo(x + 11, y - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.fillRect(x - 11, y - 4, 22, 5);
  }
  ctx.restore();
  // value tag, readable at a glance
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(fmtMoney(l.value), x, y + 24);
}

export function drawWorld(ctx, world, screen) {
  const grid = world.grid;
  const time = world.time;

  // --- floor ---
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      const px = x * TILE, py = HUD_H + y * TILE;
      if (c === '#') continue;
      const dark = c === ',';
      const odd = (x + y) % 2 === 0;
      ctx.fillStyle = dark ? (odd ? '#1a1d2b' : '#161824') : (odd ? '#2e2118' : '#2a1e15');
      ctx.fillRect(px, py, TILE, TILE);
      if (dark) {
        ctx.fillStyle = 'rgba(90,120,200,0.05)';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
  // parquet seams
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * TILE, HUD_H); ctx.lineTo(x * TILE, HUD_H + ROWS * TILE); ctx.stroke();
  }

  // --- exit door (the getaway) ---
  const ex = world.exit;
  const exitOpen = world.lootValue >= world.target;
  ctx.save();
  ctx.shadowColor = exitOpen ? '#39ff88' : '#2a7a4a';
  ctx.shadowBlur = exitOpen ? 22 : 8;
  ctx.fillStyle = exitOpen ? '#1d5c33' : '#12351f';
  ctx.fillRect(ex.x - 14, ex.y - 14, 28, 28);
  ctx.strokeStyle = exitOpen ? '#5cff9d' : '#3f9e63';
  ctx.lineWidth = 2;
  ctx.strokeRect(ex.x - 14, ex.y - 14, 28, 28);
  ctx.fillStyle = exitOpen ? '#b8ffd4' : '#7ec89a';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex.x, ex.y + 3);
  ctx.restore();

  // --- fuse box ---
  if (world.fuse && !world.fuse.used) {
    const f = world.fuse;
    ctx.fillStyle = '#f0b429';
    ctx.fillRect(f.x - 8, f.y - 10, 16, 20);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', f.x, f.y + 5);
  }

  // --- walls and cases ---
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      const px = x * TILE, py = HUD_H + y * TILE;
      if (c === '#') {
        ctx.fillStyle = WALL_FACE;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(px, py, TILE, 5);
        ctx.strokeStyle = 'rgba(201,162,39,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      } else if (c === 'T') {
        // a glass display case on a plinth
        ctx.fillStyle = '#14100c';
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = 'rgba(180,220,255,0.22)';
        ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(px + 8, py + 8, 6, 4);
      } else if (c === 'D') {
        ctx.fillStyle = '#3a2c1e';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = GOLD;
        ctx.fillRect(px + TILE / 2 - 1, py, 2, TILE);
      }
    }
  }

  // --- loot ---
  for (const l of world.loot) if (!l.taken) drawLoot(ctx, l, time);

  // --- vision cones, under the actors ---
  for (const g of world.guards) {
    const alert = g.state !== 'patrol';
    drawCone(ctx, grid, g.x, g.y, g.angle, GUARD.range, GUARD.halfAngle,
      alert ? '255,60,40' : '255,205,60', alert ? 0.5 : 0.46,
      alert ? 'rgba(255,80,60,0.7)' : 'rgba(255,205,60,0.6)');
  }
  if (!world.camerasOff) {
    for (const c of world.cameras) {
      if (c.disabled) continue;
      drawCone(ctx, grid, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle,
        '255,70,70', 0.42, 'rgba(255,70,70,0.6)');
    }
  }

  // --- smoke clouds ---
  for (const s of world.smokes) {
    const a = Math.min(0.55, (s.life / SMOKE.life) * 0.55);
    ctx.fillStyle = `rgba(200,200,210,${a})`;
    ctx.beginPath(); ctx.arc(s.x, HUD_H + s.y, s.radius, 0, 6.29); ctx.fill();
    ctx.fillStyle = `rgba(160,160,175,${a * 0.8})`;
    ctx.beginPath(); ctx.arc(s.x - 20, HUD_H + s.y + 12, s.radius * 0.6, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + 22, HUD_H + s.y - 10, s.radius * 0.55, 0, 6.29); ctx.fill();
  }

  // --- cameras (the hardware) ---
  for (const c of world.cameras) {
    ctx.save();
    ctx.translate(c.x, HUD_H + c.y);
    ctx.fillStyle = c.disabled ? '#444' : '#c0392b';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, 6.29); ctx.fill();
    ctx.rotate(c.angle);
    ctx.fillStyle = c.disabled ? '#555' : '#e74c3c';
    ctx.fillRect(0, -3, 12, 6);
    ctx.restore();
    if (!c.disabled && Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath(); ctx.arc(c.x + 5, HUD_H + c.y - 5, 2.5, 0, 6.29); ctx.fill();
    }
  }

  // --- guards ---
  for (const g of world.guards) {
    // patrol path, faint dotted line
    ctx.strokeStyle = 'rgba(140,160,255,0.18)';
    ctx.setLineDash([2, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    g.path.forEach((w, i) => {
      if (i === 0) ctx.moveTo(w.x, HUD_H + w.y);
      else ctx.lineTo(w.x, HUD_H + w.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // the guard
    ctx.save();
    ctx.translate(g.x, HUD_H + g.y);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = g.state === 'patrol' ? '#2c4a7a' : '#a02818';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.29); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.rotate(g.angle);
    ctx.fillStyle = '#dfe8ff';
    ctx.beginPath(); ctx.arc(4, 0, 3.5, 0, 6.29); ctx.fill(); // facing nose
    ctx.restore();
    // cap brim
    ctx.fillStyle = '#16233a';
    ctx.beginPath(); ctx.arc(g.x, HUD_H + g.y - 4, 6, Math.PI, 0); ctx.fill();
    if (g.state !== 'patrol') {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6a55';
      ctx.fillText('!', g.x, HUD_H + g.y - 18);
    }
  }

  // --- the thief ---
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, HUD_H + p.y);
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#101014';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.29); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.rotate(p.dir);
  // cloak point + mask stripe
  ctx.fillStyle = '#2a2a33';
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8e8f0';
  ctx.fillRect(2, -6, 5, 3);
  ctx.fillRect(2, 3, 5, 3);
  ctx.restore();
  // sneak ring: how loud you are
  if (p.moving && !p.sneaking) {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, HUD_H + p.y, 26 + Math.sin(time * 9) * 4, 0, 6.29); ctx.stroke();
  }

  // --- alarm vignette: the room itself turns on you ---
  if (world.alarm > 25) {
    const a = ((world.alarm - 25) / 75) * (0.35 + 0.1 * Math.sin(time * 6));
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,30,20,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawHud(ctx, world, screen);
}

function drawHud(ctx, world, screen) {
  // top bar
  ctx.fillStyle = '#0d0a12';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#e8c85a';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('◆ VELVET VAULT', 14, HUD_H / 2 - 9);
  ctx.fillStyle = '#b9a8c9';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(world.levelName + '  ·  ' + fmtMoney(world.lootValue) + ' / ' + fmtMoney(world.target), 14, HUD_H / 2 + 11);

  // alarm meter, centre: the number that decides everything
  const ax = VIEW_W / 2 - 150, aw = 300;
  ctx.fillStyle = '#1c1420';
  ctx.fillRect(ax, 10, aw, 16);
  const frac = world.alarm / 100;
  const col = world.alarm < 35 ? '#e8c85a' : world.alarm < 65 ? '#f08c1e' : '#ff3b2d';
  ctx.fillStyle = col;
  ctx.fillRect(ax, 10, aw * frac, 16);
  ctx.strokeStyle = '#6b5a7a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ax, 10, aw, 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(world.alarm >= 100 ? 'BUSTED!' : 'ALARM ' + Math.round(world.alarm) + '%', VIEW_W / 2, 18);
  ctx.fillStyle = '#b9a8c9';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(world.camerasOff ? 'cameras OFF' : (world.fuse ? 'find the ⚡ fuse box' : ''), VIEW_W / 2, 38);

  // right side: smoke, attempts, clock
  ctx.textAlign = 'right';
  ctx.fillStyle = '#cfe3ff';
  ctx.font = '13px system-ui, sans-serif';
  const mins = Math.floor(world.time / 60), secs = Math.floor(world.time % 60);
  ctx.fillText(`◉ smoke ×${world.smokeLeft}    ♥ ${world.attemptsLeft}    ⏱ ${mins}:${String(secs).padStart(2, '0')}`, VIEW_W - 14, HUD_H / 2);
  ctx.textBaseline = 'alphabetic';
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,5,12,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 70);
  ctx.fillStyle = '#e8e0f0';
  ctx.font = '17px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 - 20 + i * 26));
}

export function drawScreen(ctx, world, screen, data) {
  drawWorld(ctx, world, screen);
  if (screen === SCREEN_TITLE) {
    overlay(ctx, 'VELVET VAULT', [
      'One thief. One museum. Three floors of trouble.',
      '',
      'WASD / arrows — move      SHIFT — sneak (quiet, harder to spot)',
      'SPACE — smoke bomb (×3)      M — mute      P — pause',
      'Steal the target haul, then slip out the green EXIT door.',
      'Stay out of the yellow cones. Red cones are cameras — find the ⚡ fuse box.',
      '',
      'Press ENTER to start the heist',
    ], '#e8c85a');
  } else if (screen === 'level-clear') {
    const bonus = Math.max(0, Math.round((world.par - world.time) * 100));
    overlay(ctx, 'CLEAN GETAWAY', [
      `${world.levelName} — haul ${fmtMoney(world.lootValue)}`,
      `Time bonus +${bonus}   ·   total score ${world.score + bonus}`,
      '',
      'Press ENTER for the next floor',
    ], '#5cff9d');
  } else if (screen === 'win') {
    overlay(ctx, 'THE VAULT IS YOURS', [
      `Total haul ${fmtMoney(world.totalLoot)} across three floors`,
      `Final score ${world.score}`,
      '',
      'The museum never saw you coming. Press ENTER to run it again.',
    ], '#5cff9d');
  } else if (screen === 'busted') {
    overlay(ctx, 'BUSTED!', [
      'The alarm hit 100% and the guards closed in.',
      `Attempts left: ${world.attemptsLeft}`,
      '',
      world.attemptsLeft > 0 ? 'Press ENTER to try this floor again' : 'Press ENTER to start over',
    ], '#ff5a4a');
  } else if (screen === 'game-over') {
    overlay(ctx, 'THE CREW MOVES ON', [
      'Out of attempts. The museum keeps its gold — this time.',
      `Haul so far: ${fmtMoney(world.totalLoot)}`,
      '',
      'Press ENTER to plan a new heist',
    ], '#ff5a4a');
  } else if (screen === 'paused') {
    overlay(ctx, 'PAUSED', ['The guards wait. The gold waits. Press P to keep moving.'], '#cfe3ff');
  }
}
