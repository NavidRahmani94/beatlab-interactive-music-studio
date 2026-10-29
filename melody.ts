import { STEPS } from './pattern';

// One data model for BOTH Easy and Advanced melody views.
export type MelodyNote = { id: string; pitch: string; step: number; lengthSteps: number; velocity: number };

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const MIN_MIDI = 48; // C3
export const MAX_MIDI = 84; // C6
export const DEFAULT_VELOCITY = 0.8;

export type ScaleName = 'majorPent' | 'minorPent' | 'major' | 'minor';
export const SCALES: Record<ScaleName, { label: string; intervals: number[] }> = {
  majorPent: { label: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
  minorPent: { label: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
  major: { label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] }
};

export function midiToNote(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function noteToMidi(pitch: string): number | null {
  const m = /^([A-G]#?)(-?\d+)$/.exec(pitch);
  if (!m) return null;
  return (parseInt(m[2], 10) + 1) * 12 + NOTE_NAMES.indexOf(m[1] as typeof NOTE_NAMES[number]);
}

/** Lowest note shown in Easy mode for a key (keeps the 1-octave range inside C3..C6). */
export function easyRoot(keyPc: number): number { return 60 + (keyPc >= 6 ? keyPc - 12 : keyPc); }

/** Ascending MIDI notes of the scale, including the octave on top. */
export function scaleRows(keyPc: number, scale: ScaleName): number[] {
  const root = easyRoot(keyPc);
  return [...SCALES[scale].intervals, 12].map(i => root + i);
}

export function inScale(midi: number, keyPc: number, scale: ScaleName): boolean {
  return SCALES[scale].intervals.includes((((midi - keyPc) % 12) + 12) % 12);
}

function make(midi: number, step: number, lengthSteps: number, velocity = DEFAULT_VELOCITY): MelodyNote {
  return { id: `n${midi}_${step}`, pitch: midiToNote(midi), step, lengthSteps, velocity };
}

function midiOf(n: MelodyNote): number { return noteToMidi(n.pitch) ?? -1; }

/** Sorts, clips lengths to the bar, drops invalid notes and overlapping notes of the same pitch. */
export function normalizeNotes(notes: MelodyNote[]): MelodyNote[] {
  const valid = notes
    .map(n => ({ n, midi: midiOf(n) }))
    .filter(({ n, midi }) => midi >= MIN_MIDI && midi <= MAX_MIDI && Number.isInteger(n.step) && n.step >= 0 && n.step < STEPS && n.lengthSteps >= 1)
    .sort((a, b) => a.n.step - b.n.step || a.midi - b.midi);
  const lastEnd = new Map<number, number>();
  const out: MelodyNote[] = [];
  for (const { n, midi } of valid) {
    if (n.step < (lastEnd.get(midi) ?? 0)) continue;
    const len = Math.min(Math.round(n.lengthSteps), STEPS - n.step);
    lastEnd.set(midi, n.step + len);
    out.push(make(midi, n.step, len, n.velocity));
  }
  return out;
}

export function noteAt(notes: MelodyNote[], midi: number, step: number): MelodyNote | undefined {
  return notes.find(n => midiOf(n) === midi && step >= n.step && step < n.step + n.lengthSteps);
}

/** Click behaviour: click an existing note to remove it, click an empty cell to add a note. */
export function toggleNote(notes: MelodyNote[], midi: number, step: number, lengthSteps: number): MelodyNote[] {
  if (!Number.isInteger(midi) || midi < MIN_MIDI || midi > MAX_MIDI) return notes;
  if (!Number.isInteger(step) || step < 0 || step >= STEPS) return notes;
  const existing = noteAt(notes, midi, step);
  if (existing) return notes.filter(n => n !== existing);
  const len = Math.max(1, Math.min(Math.round(lengthSteps) || 1, STEPS - step));
  const kept = notes.filter(n => !(midiOf(n) === midi && n.step < step + len && n.step + n.lengthSteps > step));
  return normalizeNotes([...kept, make(midi, step, len)]);
}

function wrap(midi: number): number {
  let m = midi;
  while (m > MAX_MIDI) m -= 12;
  while (m < MIN_MIDI) m += 12;
  return m;
}

export function transposeNotes(notes: MelodyNote[], semitones: number): MelodyNote[] {
  return normalizeNotes(notes.map(n => make(wrap(midiOf(n) + semitones), n.step, n.lengthSteps, n.velocity)));
}

/** Moves every note to the nearest note of the scale (ties go down) so it always sounds in key. */
export function snapNotesToScale(notes: MelodyNote[], keyPc: number, scale: ScaleName): MelodyNote[] {
  const snap = (midi: number): number => {
    for (let d = 0; d < 12; d++) {
      if (inScale(midi - d, keyPc, scale)) return midi - d;
      if (inScale(midi + d, keyPc, scale)) return midi + d;
    }
    return midi;
  };
  return normalizeNotes(notes.map(n => make(wrap(snap(midiOf(n))), n.step, n.lengthSteps, n.velocity)));
}

export type PresetName = 'happy' | 'chill' | 'dark';
// [step, scale degree (0 = root, last = octave), length in steps]
export const PRESETS: Record<PresetName, { label: string; scale: ScaleName; notes: [number, number, number][] }> = {
  happy: { label: 'HAPPY', scale: 'majorPent', notes: [[0, 2, 2], [2, 3, 2], [4, 4, 2], [6, 3, 1], [7, 2, 1], [8, 1, 2], [10, 2, 2], [12, 0, 4]] },
  chill: { label: 'CHILL', scale: 'minorPent', notes: [[0, 3, 4], [4, 2, 2], [6, 1, 2], [8, 2, 4], [12, 0, 2], [14, 1, 2]] },
  dark: { label: 'DARK', scale: 'minor', notes: [[0, 0, 2], [2, 2, 2], [4, 4, 2], [6, 3, 2], [8, 2, 2], [10, 1, 2], [12, 0, 4]] }
};

export function makePreset(name: PresetName, keyPc: number): { scale: ScaleName; notes: MelodyNote[] } {
  const p = PRESETS[name];
  const rows = scaleRows(keyPc, p.scale);
  return { scale: p.scale, notes: normalizeNotes(p.notes.map(([step, degree, len]) => make(rows[degree], step, len))) };
}
