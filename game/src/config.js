// VELVET VAULT — config: every tuning number for the heist, in one place.
export const TILE = 32;
export const COLS = 40;
export const ROWS = 21;
export const HUD_H = 48;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = HUD_H + ROWS * TILE; // 720
export const STEP = 1 / 60;

// The thief.
export const PLAYER = {
  radius: 11,
  walkSpeed: 168, // px per second, upright and noisy
  sneakSpeed: 96, // px per second, quiet and harder to spot
  noiseRadius: 96, // guards inside this hear upright footsteps
  sneakNoiseRadius: 0,
};

// What a watcher sees.
export const GUARD = {
  range: 235,
  halfAngle: 0.61, // ~35 degrees each side
  speed: 62,
  chaseSpeed: 118,
  pauseAtWaypoint: 1.1, // seconds a guard waits at each patrol point
};
export const CAMERA = {
  range: 265,
  halfAngle: 0.52, // ~30 degrees each side
  sweepSpeed: 0.55, // radians per second
  sweepArc: 1.5, // radians of total sweep
};

// The alarm: 0 calm, 100 busted.
export const ALARM = {
  baseRate: 0.30, // per second while seen, at the edge of a cone
  closeRate: 0.55, // extra per second, scaled by closeness
  decayRate: 9, // per second while unseen
  darkFactor: 0.45, // standing in a shadow zone
  sneakFactor: 0.55, // sneaking while seen
  chaseAt: 62, // guards start chasing past this
};

// Smoke bombs: the one tool, at a cost.
export const SMOKE = { count: 3, radius: 78, life: 4.2 };

export const ATTEMPTS_PER_LEVEL = 3;
export const SCREENS = {
  TITLE: 'title',
  PLAY: 'play',
  LEVEL_CLEAR: 'level-clear',
  WIN: 'win',
  BUSTED: 'busted',
  GAME_OVER: 'game-over',
  PAUSED: 'paused',
};
