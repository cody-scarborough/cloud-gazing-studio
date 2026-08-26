/** Tiny procedural ambience: wind bed, bird chirps, goose honks, balloon burner. */
export class SkyAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  enabled = false;

  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const len = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.6;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.18;

    noise.connect(filter).connect(windGain).connect(master);
    noise.start();

    this.ctx = ctx;
    this.master = master;
    this.noise = noise;
    this.windGain = windGain;
    this.windFilter = filter;
    return ctx;
  }

  async setEnabled(on: boolean) {
    this.enabled = on;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (on && ctx.state === "suspended") await ctx.resume();
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(on ? 0.55 : 0, ctx.currentTime + 0.8);
  }

  /** wind 0..1 */
  setWind(amount: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.12 + amount * 0.5, t, 0.3);
    this.windFilter.frequency.setTargetAtTime(380 + amount * 1300, t, 0.3);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    at = 0,
    bend = 1,
  ) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  honk() {
    const base = 300 + Math.random() * 90;
    for (let i = 0; i < 3; i++) {
      this.tone(base * (1 + i * 0.04), 0.22, "sawtooth", 0.05, i * 0.42, 0.72);
    }
  }

  chirp() {
    this.tone(2100 + Math.random() * 900, 0.09, "sine", 0.035, 0, 1.5);
    this.tone(2400 + Math.random() * 800, 0.07, "sine", 0.028, 0.13, 1.4);
  }

  burner() {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 0.9;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0.09;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  gust() {
    if (!this.enabled) return;
    this.setWind(1);
    window.setTimeout(() => this.setWind(0.15), 1400);
  }

  dispose() {
    try {
      this.noise?.stop();
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
  }
}
