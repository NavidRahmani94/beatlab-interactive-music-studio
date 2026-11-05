// FILE: SHAPE LAB music rules. A shape with N corners is a chord with N notes. A turning arm plays the corners as an arpeggio, or all at once as a chord.
// No graphics and no sound here: only plain functions, so they are easy to test.
import { MelodyNote, midiToNote, normalizeNotes } from './melody';
import { STEPS } from './pattern';

export type Rate = '1/4' | '1/8' | '1/16';
export type Mode = 'arp' | 'chord' | 'off';
/** One shape. sides = number of corners = number of notes in the chord (3 = triad, 4 = 7th chord, 5 = 9th, 6 = 11th). */
export type Layer = { sides: number; octave: number; rate: Rate; mode: Mode; pattern: number[]; instrument: string; volumeDb: number };
/** The chord progression: one degree (0 = first note of the scale) per bar. It repeats. */
export type Progression = number[];

export const MIN_SIDES = 3, MAX_SIDES = 6, MAX_LAYERS = 3, MAX_PROG = 8;
export const PATTERN_LENGTHS = [8, 16] as const;
/** How many 16th-note ticks one arp step lasts. */
export const DIV: Record<Rate, number> = { '1/16': 1, '1/8': 2, '1/4': 4 };
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const pcName = (midi: number): string => PC[((midi % 12) + 12) % 12];
export const noteLabel = (midi: number): string => `${pcName(midi)}${Math.floor(midi / 12) - 1}`;

export const clampSides = (n: number): number => Math.max(MIN_SIDES, Math.min(MAX_SIDES, Math.round(n)));
export const SIDES_NAME: Record<number, string> = { 3: 'TRIAD', 4: '7TH', 5: '9TH', 6: '11TH' };

/**
 * The notes of a chord built on one degree of the scale (stacked thirds inside the scale, so it is always in key).
 * `rows` = scaleRows(): the scale notes from the root up, with the octave on top. octave = -1, 0 or +1.
 */
export function chordNotes(rows: number[], degree: number, sides: number, octave = 0): number[] {
  const L = rows.length - 1;                          // notes in one octave of the scale
  if (L < 1) return [];
  let base = rows[0]; while (base >= 60) base -= 12; while (base < 48) base += 12;   // keep the chord roots around C3..B3
  const shift = base - rows[0] + 12 * octave;
  const d = ((Math.round(degree) % L) + L) % L;
  const out: number[] = [];
  for (let i = 0; i < clampSides(sides); i++) {
    const idx = d + 2 * i;
    out.push(rows[idx % L] + 12 * Math.floor(idx / L) + shift);
  }
  return out;
}

// chord names from the pitch classes above the root
const QUALITIES: [number[], string][] = [
  [[0, 4, 7], ''], [[0, 3, 7], 'm'], [[0, 3, 6], 'dim'], [[0, 4, 8], 'aug'], [[0, 2, 7], 'sus2'], [[0, 5, 7], 'sus4'],
  [[0, 4, 7, 11], 'maj7'], [[0, 4, 7, 10], '7'], [[0, 3, 7, 10], 'm7'], [[0, 3, 6, 10], 'm7b5'], [[0, 3, 6, 9], 'dim7'], [[0, 3, 7, 11], 'mMaj7'], [[0, 4, 8, 10], '7#5'],
  [[0, 2, 4, 7, 11], 'maj9'], [[0, 2, 4, 7, 10], '9'], [[0, 2, 3, 7, 10], 'm9'], [[0, 1, 3, 6, 10], 'm9b5'], [[0, 2, 3, 7, 11], 'mMaj9'], [[0, 1, 3, 7, 10], 'm7b9'],
  [[0, 2, 4, 5, 7, 11], 'maj11'], [[0, 2, 4, 5, 7, 10], '11'], [[0, 2, 3, 5, 7, 10], 'm11'],
];
/** A chord name like "Am7". The lowest note is the root. If the notes do not fit a known chord, it is the root plus the number of notes. */
export function chordName(midis: number[]): string {
  if (midis.length === 0) return '';
  const root = Math.min(...midis);
  const set = [...new Set(midis.map(m => (((m - root) % 12) + 12) % 12))].sort((a, b) => a - b);
  const q = QUALITIES.find(([s]) => s.length === set.length && s.every((v, i) => v === set[i]));
  return pcName(root) + (q ? q[1] : ` (${midis.length})`);
}

/** One tick of the 16th-note clock. Gives what should sound now, or null when this shape is quiet on this tick. */
export type Tick = { play: number[]; vertices: number[]; chord: number[]; name: string; degree: number; bar: number; rest: boolean };
export function tickEvents(layer: Layer, prog: Progression, t: number, rows: number[]): Tick | null {
  if (layer.mode === 'off' || prog.length === 0 || layer.pattern.length === 0) return null;
  const div = DIV[layer.rate]; if (t % div !== 0) return null;
  const bar = Math.floor(t / 16);
  const degree = prog[bar % prog.length];
  const chord = chordNotes(rows, degree, layer.sides, layer.octave);
  const name = chordName(chord); const base = { chord, name, degree, bar };
  const slot = layer.pattern[(t / div) % layer.pattern.length];
  if (!slot) return { ...base, play: [], vertices: [], rest: true };
  if (layer.mode === 'chord') return { ...base, play: chord, vertices: chord.map((_, i) => i), rest: false };
  const v = (slot - 1) % chord.length;
  return { ...base, play: [chord[v]], vertices: [v], rest: false };
}

/** How long a note lasts (seconds): a bit shorter than its step, so the notes do not run into each other. */
export const noteSeconds = (bpm: number, rate: Rate, mode: Mode): number => (60 / bpm / 4) * DIV[rate] * (mode === 'chord' ? 0.95 : 0.85);

// ---- ready-made chord progressions (degrees) and arpeggio patterns
export const PROG_PRESETS: { name: string; degrees: number[] }[] = [
  { name: 'I–V–vi–IV', degrees: [0, 4, 5, 3] }, { name: 'vi–IV–I–V', degrees: [5, 3, 0, 4] }, { name: 'i–VI–III–VII', degrees: [0, 5, 2, 6] },
  { name: 'ii–V–I–I', degrees: [1, 4, 0, 0] }, { name: 'I–IV–V–IV', degrees: [0, 3, 4, 3] }, { name: 'i–iv–v–i', degrees: [0, 3, 4, 0] },
];
export type PatternKind = 'up' | 'down' | 'updown' | 'skip' | 'random' | 'rhythm';
export const PATTERN_KINDS: { id: PatternKind; label: string }[] = [
  { id: 'up', label: 'UP' }, { id: 'down', label: 'DOWN' }, { id: 'updown', label: 'UP-DOWN' }, { id: 'skip', label: 'SKIP' }, { id: 'random', label: 'RANDOM' }, { id: 'rhythm', label: 'RHYTHM' },
];
/** A pattern of `len` slots. 0 = rest, 1..sides = which corner plays. (In CHORD mode every number above 0 is a hit.) */
export function makePattern(kind: PatternKind, sides: number, len: number, rand: () => number = Math.random): number[] {
  const n = clampSides(sides); const out: number[] = [];
  const cycle = kind === 'down' ? Array.from({ length: n }, (_, i) => n - i)
    : kind === 'updown' ? [...Array.from({ length: n }, (_, i) => i + 1), ...Array.from({ length: n - 2 }, (_, i) => n - 1 - i)]
    : kind === 'skip' ? Array.from({ length: n }, (_, i) => ((i * 2) % n) + 1 + (n % 2 === 0 && i * 2 >= n ? 1 : 0)).map(v => Math.min(n, v))
    : Array.from({ length: n }, (_, i) => i + 1);
  for (let i = 0; i < len; i++) {
    if (kind === 'random') out.push(rand() < 0.2 ? 0 : 1 + Math.floor(rand() * n));
    else if (kind === 'rhythm') out.push([1, 0, 0, 1, 0, 1, 0, 0][i % 8] ? 1 : 0);
    else out.push(cycle[i % cycle.length]);
  }
  return out;
}
/** Each shape has its own sound (it does not use the tracks of the song). */
export const SHAPE_INSTRUMENTS = ['electricPiano', 'warmPad', 'pluck'];
export const MIN_VOL_DB = -30, MAX_VOL_DB = 0;
export const clampVolDb = (v: number): number => Math.max(MIN_VOL_DB, Math.min(MAX_VOL_DB, Number.isFinite(v) ? Math.round(v) : -8));
export const defaultLayer = (i = 0): Layer => ({ sides: 3 + (i % 2), octave: i === 2 ? 1 : 0, rate: '1/8', mode: 'arp', pattern: makePattern('up', 3 + (i % 2), 8), instrument: SHAPE_INSTRUMENTS[i % SHAPE_INSTRUMENTS.length], volumeDb: -8 });

/**
 * Turns one shape into real notes for the piano roll: the whole chord progression, as arpeggio or chord, bar by bar.
 * A pattern of the song has 32 steps = 2 bars, so a progression of 4 bars gives 2 lists (one per pattern).
 */
export function shapeToPatterns(layer: Layer, prog: Progression, rows: number[]): MelodyNote[][] {
  const BAR = 16;
  const total = prog.length * BAR; const count = Math.max(1, Math.ceil(total / STEPS));
  const out: MelodyNote[][] = Array.from({ length: count }, () => []);
  const div = DIV[layer.rate];
  for (let t = 0; t < total; t++) {
    const ev = tickEvents(layer, prog, t, rows); if (!ev || ev.play.length === 0) continue;
    const k = Math.floor(t / STEPS), step = t % STEPS;
    ev.play.forEach(m => out[k].push({ id: `n${m}_${step}`, pitch: midiToNote(m), step, lengthSteps: Math.min(div, STEPS - step), velocity: layer.mode === 'chord' ? 0.6 : 0.75 }));
  }
  return out.map(normalizeNotes);
}
