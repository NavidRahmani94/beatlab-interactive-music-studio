// Drum Groove Engine: swing, humanize, ghost notes and phrase fills. Pure functions: the same step and tick always give the same
// result, so what you hear while playing is exactly what the WAV / MP3 export renders (nothing is left to chance).
import { DrumPattern, Instrument, STEPS } from './pattern';

export type Groove = { swing: number; humanize: number; ghost: number; fill: number };   // every value 0 … 1
export const GROOVE_KEYS: (keyof Groove)[] = ['swing', 'humanize', 'ghost', 'fill'];
export const GROOVE_LABELS: Record<keyof Groove, { label: string; hint: string }> = {
  swing: { label: 'SWING', hint: 'every second 16th note is played a little late (shuffle)' },
  humanize: { label: 'HUMANIZE', hint: 'tiny random timing and loudness differences, like a real player' },
  ghost: { label: 'GHOST NOTES', hint: 'very quiet extra snare hits next to the backbeat' },
  fill: { label: 'VARIATION', hint: 'a drum fill every 4th bar and the odd missing hi-hat' }
};
export const defaultGroove = (): Groove => ({ swing: 0, humanize: 0, ghost: 0, fill: 0 });
export const GROOVE_PRESETS: Record<string, Groove> = {
  Straight: defaultGroove(),
  'Light swing': { swing: 0.25, humanize: 0.2, ghost: 0, fill: 0 },
  'MPC swing': { swing: 0.55, humanize: 0.3, ghost: 0.2, fill: 0.1 },
  'Lo-Fi loose': { swing: 0.4, humanize: 0.7, ghost: 0.35, fill: 0.2 },
  'Live drummer': { swing: 0.1, humanize: 0.5, ghost: 0.5, fill: 0.6 }
};

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? round2(Math.max(0, Math.min(1, v))) : 0);
export function clampGroove(g: Partial<Groove>): Groove { return { swing: clamp01(g.swing), humanize: clamp01(g.humanize), ghost: clamp01(g.ghost), fill: clamp01(g.fill) }; }
export const isGrooveOn = (g: Groove): boolean => g.swing > 0 || g.humanize > 0 || g.ghost > 0 || g.fill > 0;

/** Checks a groove read from a file. */
export function validateGroove(raw: unknown): { ok: true; groove: Groove } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: '"groove" must be an object.' };
  const o = raw as Record<string, unknown>;
  for (const k of GROOVE_KEYS) {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return { ok: false, error: `"groove.${k}" must be a number between 0 and 1.` };
  }
  return { ok: true, groove: clampGroove(o as Partial<Groove>) };
}

export const MAX_SWING_STEPS = 0.4;   // at 100 % the odd 16th is late by 0.4 of a step
export const swingDelay = (step: number, stepSeconds: number, swing: number): number => (step % 2 === 1 ? swing * MAX_SWING_STEPS * stepSeconds : 0);

/** A repeatable pseudo-random number in [0, 1) for a given step counter and purpose (salt). */
export function rand(tick: number, salt: number): number {
  let h = (Math.imul(tick | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export type DrumHit = { inst: Instrument; delay: number; velocity: number };
const ORDER: Instrument[] = ['kick', 'snare', 'hat', 'clap'];
const SALT: Record<Instrument, number> = { kick: 1, snare: 2, hat: 3, clap: 4 };

/** Every drum hit that happens on this step (the pattern's own hits, plus ghost notes and fills when switched on). */
export function drumHits(drums: DrumPattern, step: number, tick: number, g: Groove): DrumHit[] {
  const hits: DrumHit[] = [];
  const fillZone = g.fill > 0 && Math.floor(tick / STEPS) % 4 === 3 && step >= 26;
  for (const inst of ORDER) {
    const salt = SALT[inst] * 100;
    let on = !!drums[inst][step];
    let velocity = 1;
    if (on && inst === 'hat' && step % 2 === 1 && !fillZone && g.fill > 0 && rand(tick, salt + 9) < g.fill * 0.2) on = false;   // the odd missing hat
    if (!on && inst === 'snare' && g.ghost > 0 && !drums.kick[step]) {
      const nextToBackbeat = (step + 1 < STEPS && drums.snare[step + 1]) || (step > 0 && drums.snare[step - 1]);
      if (nextToBackbeat && rand(tick, salt + 5) < g.ghost * 0.7) { on = true; velocity = 0.14 + 0.14 * rand(tick, salt + 6); }
    }
    if (!on && inst === 'snare' && fillZone && rand(tick, salt + step) < g.fill * (0.35 + 0.1 * (step - 26))) { on = true; velocity = 0.45 + 0.08 * (step - 24); }
    if (!on && inst === 'kick' && fillZone && step === 30 && rand(tick, salt + 7) < g.fill * 0.5) { on = true; velocity = 0.8; }
    if (!on) continue;
    if (g.humanize > 0) velocity *= 1 - g.humanize * 0.4 * rand(tick, salt + 1);
    const delay = g.humanize > 0 ? g.humanize * (inst === 'kick' ? 0.007 : 0.014) * rand(tick, salt + 2) : 0;
    hits.push({ inst, delay, velocity: Math.max(0.05, Math.min(1, velocity)) });
  }
  return hits;
}

/** Timing and loudness drift for melodic notes of one step (the whole step moves together, so chords stay together). */
export function stepDrift(tick: number, g: Groove): { delay: number; gain: number } {
  if (g.humanize <= 0) return { delay: 0, gain: 1 };
  return { delay: g.humanize * 0.008 * rand(tick, 777), gain: 1 - g.humanize * 0.2 * rand(tick, 778) };
}
