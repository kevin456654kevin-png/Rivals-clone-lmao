/**
 * Procedural sound engine.
 *
 * Every sound is synthesised with the Web Audio API — no audio assets to ship
 * (the app builds to a single HTML file). Browsers refuse to start an
 * AudioContext before a user gesture, so `unlock()` is called on the first
 * pointer-lock / key press and is safe to call repeatedly.
 */

type FilterType = 'lowpass' | 'highpass' | 'bandpass';

interface NoiseOpts {
  dur: number;
  gain: number;
  filter?: FilterType;
  freqFrom?: number;
  freqTo?: number;
  q?: number;
  pan?: number;
  attack?: number;
}

interface ToneOpts {
  freq: number;
  freqTo?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  pan?: number;
  attack?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.7;
  private muted = false;

  /** Apply the current settings. Safe to call every frame: it early-outs when unchanged. */
  configure(volume: number, muted: boolean) {
    const v = Math.max(0, Math.min(1, volume));
    if (v === this.volume && muted === this.muted) return;
    this.volume = v;
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.effectiveGain(), this.ctx.currentTime, 0.02);
    }
  }

  private effectiveGain() {
    return this.muted ? 0 : this.volume;
  }

  /** Create or resume the context. Must happen inside a user gesture. */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.effectiveGain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private noise(): AudioBuffer | null {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 1.2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  /** Stereo panner when the browser has one, otherwise a pass-through. */
  private out(pan?: number): AudioNode {
    const ctx = this.ctx!;
    if (pan && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(this.master!);
      return p;
    }
    return this.master!;
  }

  private playNoise(o: NoiseOpts) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.effectiveGain() <= 0) return;
    const buf = this.noise();
    if (!buf) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

    const filter = ctx.createBiquadFilter();
    filter.type = o.filter ?? 'lowpass';
    filter.frequency.setValueAtTime(o.freqFrom ?? 1800, t0);
    if (o.freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqTo), t0 + o.dur);
    filter.Q.value = o.q ?? 0.8;

    const g = ctx.createGain();
    const attack = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.out(o.pan));
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  private playTone(o: ToneOpts) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.effectiveGain() <= 0) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.freq), t0);
    if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), t0 + o.dur);

    const g = ctx.createGain();
    const attack = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    osc.connect(g);
    g.connect(this.out(o.pan));
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  // ---------- Weapons ----------

  /** Distinct report per weapon family. */
  shot(weaponId: string) {
    switch (weaponId) {
      case 'sniper':
        this.playTone({ freq: 150, freqTo: 45, dur: 0.34, gain: 0.7, type: 'sine' });
        this.playNoise({ dur: 0.4, gain: 0.55, freqFrom: 2600, freqTo: 180, attack: 0.001 });
        this.playNoise({ dur: 0.12, gain: 0.35, filter: 'highpass', freqFrom: 3200 });
        break;
      case 'shotgun':
        this.playTone({ freq: 120, freqTo: 50, dur: 0.26, gain: 0.6, type: 'sine' });
        this.playNoise({ dur: 0.3, gain: 0.5, freqFrom: 1400, freqTo: 220 });
        break;
      case 'rifle':
        this.playTone({ freq: 200, freqTo: 70, dur: 0.09, gain: 0.3, type: 'square' });
        this.playNoise({ dur: 0.11, gain: 0.4, freqFrom: 3000, freqTo: 500 });
        break;
      case 'smg':
        this.playNoise({ dur: 0.07, gain: 0.3, freqFrom: 3600, freqTo: 900 });
        this.playTone({ freq: 260, freqTo: 110, dur: 0.05, gain: 0.2, type: 'square' });
        break;
      case 'revolver':
        this.playTone({ freq: 170, freqTo: 55, dur: 0.2, gain: 0.45, type: 'sine' });
        this.playNoise({ dur: 0.16, gain: 0.4, freqFrom: 2400, freqTo: 380 });
        break;
      case 'pistol':
        this.playTone({ freq: 240, freqTo: 90, dur: 0.1, gain: 0.28, type: 'square' });
        this.playNoise({ dur: 0.09, gain: 0.3, freqFrom: 2800, freqTo: 700 });
        break;
      default:
        this.playNoise({ dur: 0.09, gain: 0.3, freqFrom: 2600, freqTo: 600 });
    }
  }

  /** Someone else's shot, heard at a distance / to the side. */
  distantShot(pan?: number) {
    this.playNoise({ dur: 0.16, gain: 0.22, freqFrom: 1500, freqTo: 300, pan });
    this.playTone({ freq: 130, freqTo: 60, dur: 0.12, gain: 0.14, pan });
  }

  dryFire() {
    this.playNoise({ dur: 0.035, gain: 0.22, filter: 'highpass', freqFrom: 2600, q: 2 });
  }

  reloadStart() {
    this.playNoise({ dur: 0.06, gain: 0.25, filter: 'bandpass', freqFrom: 900, q: 4 });
  }

  reloadEnd() {
    this.playNoise({ dur: 0.05, gain: 0.3, filter: 'bandpass', freqFrom: 1500, q: 5 });
    this.playTone({ freq: 420, freqTo: 300, dur: 0.06, gain: 0.12, type: 'square' });
  }

  melee() {
    this.playNoise({ dur: 0.14, gain: 0.22, filter: 'bandpass', freqFrom: 700, freqTo: 2200, q: 1.2 });
  }

  throwGrenade() {
    this.playNoise({ dur: 0.1, gain: 0.2, filter: 'highpass', freqFrom: 1200 });
  }

  explosion(pan?: number) {
    this.playTone({ freq: 90, freqTo: 32, dur: 0.7, gain: 0.8, type: 'sine', pan });
    this.playNoise({ dur: 0.65, gain: 0.6, freqFrom: 1800, freqTo: 120, pan });
  }

  // ---------- Feedback ----------

  hitmarker() {
    this.playTone({ freq: 1180, freqTo: 1180, dur: 0.05, gain: 0.22, type: 'square' });
  }

  kill() {
    this.playTone({ freq: 880, dur: 0.07, gain: 0.22, type: 'square' });
    window.setTimeout(() => this.playTone({ freq: 1320, dur: 0.12, gain: 0.2, type: 'square' }), 70);
  }

  hurt() {
    this.playTone({ freq: 190, freqTo: 90, dur: 0.18, gain: 0.4, type: 'sine' });
    this.playNoise({ dur: 0.12, gain: 0.2, freqFrom: 700, freqTo: 200 });
  }

  death() {
    this.playTone({ freq: 300, freqTo: 60, dur: 0.6, gain: 0.4, type: 'sawtooth' });
  }

  /** Ping for a target plate in the practice range. */
  targetHit(bullseye: boolean) {
    this.playTone({ freq: bullseye ? 1560 : 1040, dur: 0.09, gain: 0.2, type: 'triangle' });
  }

  botDeath() {
    this.playTone({ freq: 520, freqTo: 160, dur: 0.22, gain: 0.24, type: 'sawtooth' });
  }

  // ---------- Movement ----------

  jump() {
    this.playNoise({ dur: 0.07, gain: 0.16, filter: 'bandpass', freqFrom: 500, q: 1.5 });
  }

  land(hard: boolean) {
    this.playTone({ freq: hard ? 110 : 150, freqTo: 55, dur: hard ? 0.16 : 0.09, gain: hard ? 0.35 : 0.18 });
    this.playNoise({ dur: hard ? 0.14 : 0.07, gain: hard ? 0.24 : 0.12, freqFrom: 600, freqTo: 160 });
  }

  footstep() {
    this.playNoise({ dur: 0.055, gain: 0.11, freqFrom: 500 + Math.random() * 260, freqTo: 140 });
  }

  slide() {
    this.playNoise({ dur: 0.32, gain: 0.16, freqFrom: 1500, freqTo: 500, q: 1.4 });
  }

  // ---------- Scope ----------

  scopeIn() {
    this.playNoise({ dur: 0.09, gain: 0.18, filter: 'bandpass', freqFrom: 900, freqTo: 2400, q: 2 });
    this.playTone({ freq: 320, freqTo: 620, dur: 0.07, gain: 0.1, type: 'triangle' });
  }

  scopeOut() {
    this.playNoise({ dur: 0.08, gain: 0.15, filter: 'bandpass', freqFrom: 2200, freqTo: 800, q: 2 });
  }

  /** Bolt cycle after a scoped shot — the quickscope rhythm. */
  boltCycle() {
    this.playNoise({ dur: 0.05, gain: 0.2, filter: 'bandpass', freqFrom: 1100, q: 5 });
    window.setTimeout(
      () => this.playNoise({ dur: 0.05, gain: 0.18, filter: 'bandpass', freqFrom: 1700, q: 5 }),
      110,
    );
  }

  // ---------- UI / match ----------

  beep(high = false) {
    this.playTone({ freq: high ? 880 : 520, dur: 0.12, gain: 0.2, type: 'triangle' });
  }

  matchStart() {
    this.playTone({ freq: 660, dur: 0.1, gain: 0.24, type: 'square' });
    window.setTimeout(() => this.playTone({ freq: 990, dur: 0.22, gain: 0.22, type: 'square' }), 110);
  }

  dispose() {
    try {
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }
}

/** Single shared engine — settings are pushed into it from the game loop. */
export const audio = new AudioEngine();
