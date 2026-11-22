// VELVET VAULT — keyboard and mouse: the thief's hands.
export class Input {
  constructor() {
    this.keys = new Set();
    this.smokeQueued = false;
    this.onKey = null; // (code) => void, set by main for Enter / P / M / R
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyE') this.smokeQueued = true;
      if (this.onKey) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Normalised movement vector from WASD / arrows. */
  move() {
    let mx = 0, my = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    const len = Math.hypot(mx, my);
    return len > 0 ? { mx: mx / len, my: my / len } : { mx: 0, my: 0 };
  }

  get sneak() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  takeSmoke() {
    const s = this.smokeQueued;
    this.smokeQueued = false;
    return s;
  }
}
