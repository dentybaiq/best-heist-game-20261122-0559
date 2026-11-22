// VELVET VAULT — the screenshot scenes behind ?shot=start|play|alarm|end.
// Staged, not simulated: the guards patrol for a few seconds with the thief out of
// sight, then the thief is placed where the heist is happening, loot in hand, so
// the frame is what a real game looks like and the same seed always gives it.
import { TILE } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const SAMPLE = 1 / 30;

/** Step the world with the thief standing still and out of sight. */
function idle(world, seconds) {
  for (let t = 0; t < seconds / SAMPLE; t += 1) {
    world.step(SAMPLE, { mx: 0, my: 0, sneak: false, smoke: false });
  }
}

/** Mark the loot at tile (tx,ty) as stolen and add its value. */
function stealAt(world, tx, ty) {
  for (const l of world.loot) {
    const lx = Math.floor(l.x / TILE), ly = Math.floor(l.y / TILE);
    if (!l.taken && lx === tx && ly === ty) {
      l.taken = true;
      world.lootValue += l.value;
      world.totalLoot += l.value;
    }
  }
}

/** The mid-heist frame: two pieces already stolen, the thief crossing the hall. */
function stageMidHeist(world, alarm) {
  world.loadLevel(0);
  idle(world, 6);
  stealAt(world, 8, 10); // the hall painting
  stealAt(world, 3, 13); // the hall sapphire
  // the thief, mid-hall, one step from the next painting
  world.player.x = 20 * TILE + TILE / 2;
  world.player.y = 11 * TILE + TILE / 2;
  world.player.dir = Math.PI / 2;
  world.alarm = alarm;
  idle(world, 1);
  return { screen: SCREEN_PLAY };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over a patrolling gallery. play: mid-heist, alarm half up.
 * alarm: a guard closing in, meter at 82. end: the win screen.
 */
export function stageShot(name, world) {
  if (name === 'play') return stageMidHeist(world, 46);
  if (name === 'alarm') {
    const staged = stageMidHeist(world, 82);
    // the nearest guard gives chase
    let nearest = null, bestD = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(g.x - world.player.x, g.y - world.player.y);
      if (d < bestD) { bestD = d; nearest = g; }
    }
    if (nearest) {
      nearest.state = 'chase';
      nearest.target = { x: world.player.x, y: world.player.y };
      world.lastSeen = { x: world.player.x, y: world.player.y, t: world.time };
    }
    // no extra idle: the chaser is already close, one more step would bump the thief
    return staged;
  }
  if (name === 'end') {
    world.loadLevel(2);
    for (const l of world.loot) { l.taken = true; world.lootValue += l.value; world.totalLoot += l.value; }
    world.player.x = world.exit.x - 30;
    world.player.y = world.exit.y;
    world.score = 87400;
    world.totalLoot = 162000;
    return { screen: 'win' };
  }
  // start
  world.loadLevel(0);
  idle(world, 5);
  return { screen: SCREEN_TITLE };
}
