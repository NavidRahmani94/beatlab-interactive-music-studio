/** The computer keyboard as a piano: the home row plays the white keys, the row above the black ones (like most DAWs). */
const OFFSETS: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 6;
export const DEFAULT_OCTAVE = 4;
export const clampOctave = (o: number): number => Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, Math.round(o)));

/** MIDI note for a pressed key, or null. C4 = 60 (octave 4). */
export function keyToMidi(key: string, octave: number): number | null {
  const off = OFFSETS[key.toLowerCase()];
  return off === undefined ? null : (clampOctave(octave) + 1) * 12 + off;
}
/** On the DRUMS tab the four left keys are the four pads (General MIDI notes: kick 36, snare 38, hat 42, clap 39). */
const PADS: Record<string, number> = { a: 36, s: 38, d: 42, f: 39 };
export const keyToPad = (key: string): number | null => PADS[key.toLowerCase()] ?? null;
/** Z / X move the keyboard one octave down / up. */
export const octaveShift = (key: string): -1 | 1 | 0 => (key.toLowerCase() === 'z' ? -1 : key.toLowerCase() === 'x' ? 1 : 0);
/** Step entry: the cursor walks along the 32 steps of the pattern. */
export const nextStep = (step: number, by = 1, steps = 32): number => (((step + by) % steps) + steps) % steps;
