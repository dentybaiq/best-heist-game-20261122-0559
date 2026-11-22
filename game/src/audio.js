// VELVET VAULT — all sound is synthesised with WebAudio: no audio files.
export class AudioBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.alarmOsc = null;
    this.alarmGain = null;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.alarmGain) this.alarmGain.gain.value = 0;
    return this.muted;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  pickup() { this.tone(880, 0.09, 'sine', 0.16); this.tone(1318, 0.14, 'sine', 0.14, 0.07); }
  smoke() { this.tone(320, 0.4, 'triangle', 0.12, 0, 90); }
  fuse() { this.tone(523, 0.1, 'square', 0.1); this.tone(784, 0.12, 'square', 0.1, 0.09); this.tone(1046, 0.2, 'square', 0.1, 0.18); }
  busted() { this.tone(220, 0.5, 'sawtooth', 0.16, 0, 110); this.tone(110, 0.7, 'sawtooth', 0.14, 0.15, 55); }
  levelClear() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.15, i * 0.11));
  }
  win() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.15, i * 0.12));
  }
  step() { this.tone(180 + Math.random() * 40, 0.03, 'sine', 0.03); }

  /** A low alarm hum whose pitch follows the meter; call every frame. */
  alarmHum(level) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (level < 12 || this.muted) {
      if (this.alarmOsc) { try { this.alarmOsc.stop(); } catch { /* already stopped */ } this.alarmOsc = null; }
      return;
    }
    if (!this.alarmOsc) {
      this.alarmOsc = ctx.createOscillator();
      this.alarmGain = ctx.createGain();
      this.alarmOsc.type = 'sine';
      this.alarmGain.gain.value = 0;
      this.alarmOsc.connect(this.alarmGain);
      this.alarmGain.connect(ctx.destination);
      this.alarmOsc.start();
    }
    const f = 55 + level * 0.9;
    this.alarmOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.1);
    this.alarmGain.gain.setTargetAtTime(0.02 + (level / 100) * 0.05, ctx.currentTime, 0.1);
  }
}
