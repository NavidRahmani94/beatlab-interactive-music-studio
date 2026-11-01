// Global pitch ("tuning") and tempo styles.
// The whole song (every track and every Synth Lab sound, the live keyboard too) can be moved up or down from the standard A = 440 Hz:
// whole semitones (transpose, a different key) plus cents (fine tuning, e.g. A = 432 Hz). The drums are never changed.
export type Tuning = { semitones: number; cents: number };
export const TUNING_MAX_SEMITONES = 12;
export const TUNING_MAX_CENTS = 50;
export const defaultTuning = (): Tuning => ({ semitones: 0, cents: 0 });

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const clampSemitones = (v: number): number => finite(v) ? Math.max(-TUNING_MAX_SEMITONES, Math.min(TUNING_MAX_SEMITONES, Math.round(v))) : 0;
export const clampCents = (v: number): number => finite(v) ? Math.max(-TUNING_MAX_CENTS, Math.min(TUNING_MAX_CENTS, Math.round(v))) : 0;
export const cleanTuning = (t: Partial<Tuning> | undefined | null): Tuning => ({ semitones: clampSemitones(t?.semitones as number), cents: clampCents(t?.cents as number) });
/** Total shift in semitones (fractions allowed). */
export const tuningTotal = (t: Tuning): number => t.semitones + t.cents / 100;
export const isDefaultTuning = (t: Tuning): boolean => t.semitones === 0 && t.cents === 0;
/** The frequency the note A4 is played at (440 Hz when the tuning is 0). */
export const a4Hz = (t: Tuning): number => 440 * Math.pow(2, tuningTotal(t) / 12);
export const fmtA4 = (t: Tuning): string => `A = ${a4Hz(t).toFixed(1)} Hz`;

export function validateTuning(v: unknown): { ok: true; tuning: Tuning } | { ok: false; error: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return { ok: false, error: '"tuning" must be an object.' };
  const o = v as Record<string, unknown>;
  if (!finite(o.semitones) || !Number.isInteger(o.semitones) || Math.abs(o.semitones) > TUNING_MAX_SEMITONES) return { ok: false, error: `tuning.semitones must be a whole number from -${TUNING_MAX_SEMITONES} to ${TUNING_MAX_SEMITONES}.` };
  if (!finite(o.cents) || !Number.isInteger(o.cents) || Math.abs(o.cents) > TUNING_MAX_CENTS) return { ok: false, error: `tuning.cents must be a whole number from -${TUNING_MAX_CENTS} to ${TUNING_MAX_CENTS}.` };
  return { ok: true, tuning: { semitones: o.semitones, cents: o.cents } };
}

/** Typical tempos of some styles. Picking one only sets the tempo; the slider can still be moved afterwards. */
export const TEMPO_STYLES: { id: string; label: string; bpm: number }[] = [
  { id: 'ballad', label: 'Ballad', bpm: 68 },
  { id: 'lofi', label: 'Lo-Fi', bpm: 75 },
  { id: 'rnb', label: 'R&B', bpm: 85 },
  { id: 'hiphop', label: 'Hip Hop', bpm: 90 },
  { id: 'pop', label: 'Pop', bpm: 100 },
  { id: 'funk', label: 'Funk', bpm: 108 },
  { id: 'disco', label: 'Disco', bpm: 118 },
  { id: 'house', label: 'House', bpm: 124 },
  { id: 'techno', label: 'Techno', bpm: 130 },
  { id: 'trance', label: 'Trance', bpm: 138 },
  { id: 'dubstep', label: 'Dubstep', bpm: 140 },
  { id: 'dnb', label: 'Drum & Bass', bpm: 174 }
];
export const styleForBpm = (bpm: number): string => TEMPO_STYLES.find(s => s.bpm === bpm)?.id ?? 'custom';
