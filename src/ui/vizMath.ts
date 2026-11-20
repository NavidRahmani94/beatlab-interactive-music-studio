/** Pure helpers for the visualiser: turn an FFT (dB values) into bass / mid / treble energy, loudness and a beat pulse. */
export type Bands = { bass: number; mid: number; high: number; level: number };
export const VIZ_MODES = ['bars', 'rings', 'particles', 'aurora'] as const;
export type VizMode = (typeof VIZ_MODES)[number];
export const VIZ_LABEL: Record<VizMode, string> = { bars: 'BARS', rings: 'RINGS', particles: 'PARTICLES', aurora: 'AURORA' };
export const isVizMode = (v: unknown): v is VizMode => typeof v === 'string' && (VIZ_MODES as readonly string[]).includes(v);

/** dB (-100..0) → 0..1 */
export const dbToUnit = (db: number): number => (Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 90) / 70)) : 0);

/** Mean energy of an FFT in three bands. `sampleRate` is the audio rate; the FFT covers 0..sampleRate/2. */
export function bandsOf(spec: ArrayLike<number> | null, sampleRate = 44100): Bands {
  if (!spec || spec.length === 0) return { bass: 0, mid: 0, high: 0, level: 0 };
  const hz = sampleRate / 2 / spec.length;
  const avg = (lo: number, hi: number) => {
    const a = Math.max(0, Math.floor(lo / hz)), b = Math.min(spec.length, Math.max(a + 1, Math.ceil(hi / hz)));
    let s = 0; for (let i = a; i < b; i++) s += dbToUnit(spec[i]);
    return s / (b - a);
  };
  const bass = avg(20, 150), mid = avg(150, 2000), high = avg(2000, 12000);
  return { bass, mid, high, level: Math.min(1, bass * 0.5 + mid * 0.35 + high * 0.15) };
}

/** Beat detector: fires when the bass jumps clearly above its own recent average. Returns a pulse that decays 1 → 0. */
export class BeatPulse {
  private avg = 0; private pulse = 0; private cool = 0;
  update(bass: number, dt = 1 / 60): number {
    this.cool = Math.max(0, this.cool - dt);
    this.pulse = Math.max(0, this.pulse - dt * 4);
    if (bass > this.avg * 1.25 + 0.08 && this.cool === 0) { this.pulse = 1; this.cool = 0.18; }
    this.avg += (bass - this.avg) * Math.min(1, dt * 3);
    return this.pulse;
  }
  reset() { this.avg = 0; this.pulse = 0; this.cool = 0; }
}

/** Smooth a value upward fast and downward slowly (for bars and glow). */
export const attackRelease = (prev: number, target: number, release = 0.04): number => Math.max(target, prev - release);
