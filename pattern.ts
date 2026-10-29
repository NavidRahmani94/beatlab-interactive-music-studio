export const INSTRUMENTS = ['kick', 'snare', 'hat', 'clap'] as const;
export type Instrument = typeof INSTRUMENTS[number];
export type DrumPattern = Record<Instrument, boolean[]>;
export const STEPS = 32;        // one pattern = 32 sixteenth-note steps (2 bars of 4/4), scrolled horizontally in the editors
export const LEGACY_STEPS = 16; // length of a pattern in files made before v0.8
export function makePattern(): DrumPattern {
  return {
    kick: Array.from({length: STEPS}, (_, i) => i % 4 === 0),
    snare: Array.from({length: STEPS}, (_, i) => i % 16 === 4 || i % 16 === 12),
    hat: Array.from({length: STEPS}, (_, i) => i % 2 === 0),
    clap: Array.from({length: STEPS}, () => false)
  };
}
export function toggleStep(pattern: DrumPattern, instrument: Instrument, step: number): DrumPattern {
  if (!Number.isInteger(step) || step < 0 || step >= STEPS) return pattern;
  return {...pattern, [instrument]: pattern[instrument].map((v, i) => i === step ? !v : v)};
}
export function clampBpm(value: number): number { return Number.isFinite(value) ? Math.max(60, Math.min(200, Math.round(value))) : 120; }
