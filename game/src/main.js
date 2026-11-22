// VELVET VAULT — boot, the frame loop, and the screen state machine.
import { VIEW_W, VIEW_H, STEP, ATTEMPTS_PER_LEVEL } from './config.js';
import { World, EVENT_BUSTED, EVENT_LEVEL_CLEAR, EVENT_LOOT, EVENT_FUSE, EVENT_SPOTTED } from './world.js';
import { drawScreen, SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { Input } from './input.js';
import { AudioBank } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1);
const shot = params.get('shot');
const world = new World(seed);
const input = new Input();
const audio = new AudioBank();
// Read-only handle for automated play-tests (never used by the game itself).
window.__velvet = { world, get screen() { return screen; } };

let screen = SCREEN_TITLE;
let paused = false;
let stepSoundAt = 0;

function announce(text) {
  if (status) status.textContent = text;
}

function startGame() {
  world.levelIndex = 0;
  world.score = 0;
  world.totalLoot = 0;
  world.attemptsLeft = ATTEMPTS_PER_LEVEL;
  world.reset();
  screen = SCREEN_PLAY;
  announce('The heist begins. Steal the target haul, then reach the exit.');
}

function nextLevel() {
  const bonus = Math.max(0, Math.round((world.par - world.time) * 100));
  world.score += world.lootValue + bonus;
  if (world.levelIndex + 1 >= 3) {
    screen = 'win';
    audio.win();
    announce(`Clean getaway. Total haul $${world.totalLoot.toLocaleString('en-US')}.`);
  } else {
    world.loadLevel(world.levelIndex + 1);
    world.attemptsLeft = ATTEMPTS_PER_LEVEL;
    screen = SCREEN_PLAY;
    announce(`${world.levelName}. Target $${world.target.toLocaleString('en-US')}.`);
  }
}

function busted() {
  world.attemptsLeft -= 1;
  audio.busted();
  audio.alarmHum(0);
  if (world.attemptsLeft <= 0) {
    screen = 'game-over';
    announce('Out of attempts. The museum keeps its gold.');
  } else {
    screen = 'busted';
    announce(`Busted. ${world.attemptsLeft} attempts left.`);
  }
}

input.onKey = (code) => {
  audio.ensure();
  if (code === 'KeyM') {
    const muted = audio.toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
    return;
  }
  if (code === 'KeyP' && (screen === SCREEN_PLAY || screen === 'paused')) {
    paused = !paused;
    screen = paused ? 'paused' : SCREEN_PLAY;
    return;
  }
  if (code === 'KeyR' && (screen === SCREEN_PLAY || screen === 'paused')) {
    world.reset();
    world.attemptsLeft = ATTEMPTS_PER_LEVEL;
    screen = SCREEN_PLAY;
    return;
  }
  if (code === 'Enter' || code === 'NumpadEnter') {
    if (screen === SCREEN_TITLE || screen === 'game-over') startGame();
    else if (screen === 'level-clear') nextLevel();
    else if (screen === 'win') startGame();
    else if (screen === 'busted') {
      if (world.attemptsLeft > 0) {
        world.reset();
        screen = SCREEN_PLAY;
      } else startGame();
    }
  }
};

let staged = null;
if (shot) {
  staged = stageShot(shot, world);
  screen = staged.screen;
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (screen === SCREEN_PLAY && !paused && !shot) {
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      const mv = input.move();
      const ev = world.step(STEP, { mx: mv.mx, my: mv.my, sneak: input.sneak, smoke: input.takeSmoke() });
      if (ev & EVENT_LOOT) audio.pickup();
      if (ev & EVENT_FUSE) audio.fuse();
      if (ev & EVENT_SPOTTED) audio.alarmHum(world.alarm);
      if (world.player.moving && world.time > stepSoundAt) {
        audio.step();
        stepSoundAt = world.time + (world.player.sneaking ? 0.55 : 0.34);
      }
      if (ev & EVENT_BUSTED) { busted(); break; }
      if (ev & EVENT_LEVEL_CLEAR) {
        audio.levelClear();
        audio.alarmHum(0);
        screen = 'level-clear';
        break;
      }
    }
  } else if (screen === SCREEN_PLAY && shot) {
    // a staged shot frame: the world is frozen as staged, just draw it
  }
  drawScreen(ctx, world, screen);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
