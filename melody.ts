import { STEPS } from './pattern';
import { MelodyInstrumentId } from './instruments';

// One data model for BOTH Easy and Advanced melody views.
export type MelodyNote = { id: string; pitch: string; step: number; lengthSteps: number; velocity: number };

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const MIN_MIDI = 48; // C3
export const MAX_MIDI = 84; // C6
export const DEFAULT_VELOCITY = 0.8;
export const MIN_VELOCITY = 0.05;

// ---------- scales ----------
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

const round2 = (v: number) => Math.round(v * 100) / 100;
export function clampVelocity(v: number): number {
  return Number.isFinite(v) ? round2(Math.max(MIN_VELOCITY, Math.min(1, v))) : DEFAULT_VELOCITY;
}

function make(midi: number, step: number, lengthSteps: number, velocity = DEFAULT_VELOCITY): MelodyNote {
  return { id: `n${midi}_${step}`, pitch: midiToNote(midi), step, lengthSteps, velocity: clampVelocity(velocity) };
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
export function toggleNote(notes: MelodyNote[], midi: number, step: number, lengthSteps: number, velocity = DEFAULT_VELOCITY): MelodyNote[] {
  if (!Number.isInteger(midi) || midi < MIN_MIDI || midi > MAX_MIDI) return notes;
  if (!Number.isInteger(step) || step < 0 || step >= STEPS) return notes;
  const existing = noteAt(notes, midi, step);
  if (existing) return notes.filter(n => n !== existing);
  const len = Math.max(1, Math.min(Math.round(lengthSteps) || 1, STEPS - step));
  const kept = notes.filter(n => !(midiOf(n) === midi && n.step < step + len && n.step + n.lengthSteps > step));
  return normalizeNotes([...kept, make(midi, step, len, velocity)]);
}

// ---------- velocity (loudness of each note) ----------
/** Highest velocity among the notes that START on this step, or undefined when none starts there. */
export function stepVelocity(notes: MelodyNote[], step: number): number | undefined {
  const v = notes.filter(n => n.step === step).map(n => n.velocity);
  return v.length ? Math.max(...v) : undefined;
}

/** Sets the velocity of every note that starts on this step (the velocity lane under the piano roll). */
export function setStepVelocity(notes: MelodyNote[], step: number, velocity: number): MelodyNote[] {
  if (!notes.some(n => n.step === step)) return notes;
  const v = clampVelocity(velocity);
  return notes.map(n => n.step === step ? { ...n, velocity: v } : n);
}

// ---------- key / scale changes ----------
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

/**
 * Changing the scale really changes the music: each note keeps its scale DEGREE (1st, 2nd, 3rd…) and octave,
 * so a Major tune becomes its Minor version instead of staying the same.
 */
export function remapToScale(notes: MelodyNote[], keyPc: number, from: ScaleName, to: ScaleName): MelodyNote[] {
  if (from === to) return normalizeNotes(notes);
  const fromIv = SCALES[from].intervals;
  const toIv = SCALES[to].intervals;
  return normalizeNotes(notes.map(n => {
    const rel = midiOf(n) - keyPc;
    let octave = Math.floor(rel / 12);
    const pc = rel - octave * 12;
    let degree = 0;
    let best = Infinity;
    fromIv.forEach((iv, i) => { const d = Math.abs(iv - pc); if (d < best) { best = d; degree = i; } });
    if (12 - pc < best) { degree = 0; octave += 1; }
    const midi = keyPc + octave * 12 + toIv[Math.min(degree, toIv.length - 1)];
    return make(wrap(midi), n.step, n.lengthSteps, n.velocity);
  }));
}

// ---------- moods (ready-made melodies: each sets scale + instrument + notes) ----------
export type PresetName = 'happy' | 'chill' | 'dark' | 'dreamy' | 'epic' | 'playful' | 'sad' | 'mystery' | 'groovy';
export type Preset = { label: string; scale: ScaleName; instrument: MelodyInstrumentId; notes: [number, number, number, number][] };
// notes: [step, scale degree (0 = root, last = octave), length in steps, velocity]. Every cell is its own single step.
export const PRESETS: Record<PresetName, Preset> = {
  happy: { label: 'HAPPY', scale: 'majorPent', instrument: 'electricPiano', notes: [[0, 2, 1, 0.9], [2, 3, 1, 0.7], [4, 4, 1, 0.9], [6, 3, 1, 0.65], [8, 1, 1, 0.85], [10, 2, 1, 0.7], [12, 0, 1, 0.95], [14, 1, 1, 0.65]] },
  chill: { label: 'CHILL', scale: 'minorPent', instrument: 'softSynth', notes: [[0, 3, 1, 0.7], [3, 2, 1, 0.55], [6, 1, 1, 0.6], [8, 2, 1, 0.7], [11, 1, 1, 0.5], [14, 0, 1, 0.7]] },
  dark: { label: 'DARK', scale: 'minor', instrument: 'pluck', notes: [[0, 0, 1, 0.95], [2, 2, 1, 0.65], [3, 0, 1, 0.8], [6, 4, 1, 0.7], [8, 3, 1, 0.9], [10, 2, 1, 0.65], [12, 1, 1, 0.75], [14, 0, 1, 0.9]] },
  dreamy: { label: 'DREAMY', scale: 'major', instrument: 'warmPad', notes: [[0, 4, 1, 0.6], [2, 2, 1, 0.5], [4, 5, 1, 0.6], [6, 3, 1, 0.5], [8, 4, 1, 0.6], [10, 2, 1, 0.5], [12, 3, 1, 0.6], [14, 0, 1, 0.55]] },
  epic: { label: 'EPIC', scale: 'minor', instrument: 'lead', notes: [[0, 0, 1, 1], [1, 0, 1, 0.75], [3, 2, 1, 0.85], [4, 4, 1, 0.95], [6, 3, 1, 0.8], [8, 2, 1, 0.9], [10, 1, 1, 0.8], [12, 0, 1, 1]] },
  playful: { label: 'PLAYFUL', scale: 'majorPent', instrument: 'bell', notes: [[0, 0, 1, 0.8], [1, 2, 1, 0.65], [2, 4, 1, 0.8], [3, 5, 1, 0.9], [4, 4, 1, 0.65], [6, 2, 1, 0.7], [8, 3, 1, 0.8], [9, 4, 1, 0.65], [10, 3, 1, 0.7], [12, 2, 1, 0.8], [14, 0, 1, 0.9]] },
  sad: { label: 'SAD', scale: 'minor', instrument: 'electricPiano', notes: [[0, 4, 1, 0.7], [2, 3, 1, 0.55], [3, 2, 1, 0.55], [4, 1, 1, 0.7], [8, 2, 1, 0.6], [10, 1, 1, 0.55], [11, 0, 1, 0.55], [12, 0, 1, 0.75]] },
  mystery: { label: 'MYSTERY', scale: 'minor', instrument: 'bell', notes: [[0, 0, 1, 0.7], [3, 4, 1, 0.6], [6, 2, 1, 0.6], [8, 6, 1, 0.7], [11, 5, 1, 0.55], [13, 4, 1, 0.6], [15, 3, 1, 0.5]] },
  groovy: { label: 'GROOVY', scale: 'minorPent', instrument: 'bass', notes: [[0, 0, 1, 0.95], [3, 0, 1, 0.75], [6, 2, 1, 0.8], [8, 0, 1, 0.9], [10, 3, 1, 0.8], [11, 2, 1, 0.65], [14, 1, 1, 0.8]] }
};
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

export function makePreset(name: PresetName, keyPc: number): { scale: ScaleName; instrument: MelodyInstrumentId; notes: MelodyNote[] } {
  const p = PRESETS[name];
  const rows = scaleRows(keyPc, p.scale);
  return { scale: p.scale, instrument: p.instrument, notes: normalizeNotes(p.notes.map(([step, degree, len, vel]) => make(rows[degree], step, len, vel))) };
}

// ---------- automatic melody ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// How each mood "feels": how busy it is, how smoothly it moves, how loud.
const STYLE: Record<PresetName, { density: number; onBeat: number; stepwise: number; leap: number; velocity: number }> = {
  happy: { density: 0.55, onBeat: 0.95, stepwise: 0.55, leap: 0.35, velocity: 0.75 },
  chill: { density: 0.3, onBeat: 0.8, stepwise: 0.8, leap: 0.1, velocity: 0.62 },
  dark: { density: 0.5, onBeat: 0.9, stepwise: 0.45, leap: 0.2, velocity: 0.78 },
  dreamy: { density: 0.3, onBeat: 0.75, stepwise: 0.6, leap: 0.35, velocity: 0.58 },
  epic: { density: 0.6, onBeat: 1, stepwise: 0.4, leap: 0.5, velocity: 0.88 },
  playful: { density: 0.8, onBeat: 0.95, stepwise: 0.4, leap: 0.55, velocity: 0.72 },
  sad: { density: 0.35, onBeat: 0.85, stepwise: 0.85, leap: 0.1, velocity: 0.6 },
  mystery: { density: 0.3, onBeat: 0.6, stepwise: 0.3, leap: 0.6, velocity: 0.58 },
  groovy: { density: 0.6, onBeat: 0.9, stepwise: 0.25, leap: 0.35, velocity: 0.82 }
};

/**
 * Random-but-musical melody for the chosen key, scale and mood: a walk on the scale (single-step notes),
 * louder downbeats, starting on step 1 and resolving on the root. The same seed always gives the same tune.
 */
export function generateMelody(keyPc: number, scale: ScaleName, mood: PresetName, seed: number): MelodyNote[] {
  const rand = mulberry32(seed);
  const style = STYLE[mood];
  const rows = scaleRows(keyPc, scale);
  const top = rows.length - 1;
  let degree = Math.floor(top / 2);
  const picks: { step: number; degree: number; velocity: number }[] = [];
  for (let step = 0; step < STEPS; step++) {
    const onBeat = step % 4 === 0;
    if (step !== 0 && rand() >= (onBeat ? style.onBeat : style.density)) continue;
    const r = rand();
    const dir = rand() < 0.5 ? -1 : 1;
    if (r < style.stepwise) degree += dir;
    else if (r < style.stepwise + style.leap) degree += dir * (2 + Math.floor(rand() * 2));
    degree = Math.max(0, Math.min(top, degree));
    const accent = onBeat ? 0.15 : step % 2 === 0 ? 0 : -0.08;
    picks.push({ step, degree, velocity: style.velocity + accent + (rand() - 0.5) * 0.12 });
  }
  // never nearly empty
  for (const step of [8, 4, 12, 6, 10]) {
    if (picks.length >= 4) break;
    if (!picks.some(p => p.step === step)) picks.push({ step, degree: Math.floor(rand() * (top + 1)), velocity: style.velocity });
  }
  picks.sort((a, b) => a.step - b.step);
  picks[picks.length - 1].degree = 0; // resolve on the root
  return normalizeNotes(picks.map(p => make(rows[p.degree], p.step, 1, p.velocity)));
}

// ---------- stretching / moving notes (drag in the piano roll) ----------
/** Changes the length of one note. It can't pass the bar end or run into the next note of the same pitch. */
export function resizeNote(notes: MelodyNote[], id: string, lengthSteps: number): MelodyNote[] {
  const target = notes.find(n => n.id === id);
  if (!target || !Number.isFinite(lengthSteps)) return notes;
  const midi = midiOf(target);
  let limit = STEPS - target.step;
  for (const n of notes) if (n !== target && midiOf(n) === midi && n.step > target.step) limit = Math.min(limit, n.step - target.step);
  const len = Math.max(1, Math.min(Math.round(lengthSteps), limit));
  if (len === target.lengthSteps) return notes;
  return notes.map(n => n === target ? { ...n, lengthSteps: len } : n);
}

// ---------- ready-made patterns for the AMBIENT and ARPEGGIO tracks ----------
export type TrackPresetName = 'ambientDrift' | 'ambientAbyss' | 'ambientShimmer' | 'ambientSpace' | 'arpMinor' | 'arpMajor' | 'arpChanges' | 'arpBell';
export const TRACK_PRESETS: Record<TrackPresetName, { track: 'ambient' | 'arp'; label: string; scale: ScaleName; instrument: MelodyInstrumentId; notes: [number, number, number, number][] }> = {
  ambientDrift: { track: 'ambient', label: 'DRIFT', scale: 'majorPent', instrument: 'warmPad', notes: [[0, 0, 16, 0.5], [0, 2, 16, 0.45], [0, 3, 16, 0.45]] },
  ambientAbyss: { track: 'ambient', label: 'ABYSS', scale: 'minor', instrument: 'drone', notes: [[0, 0, 16, 0.6], [0, 4, 16, 0.4]] },
  ambientShimmer: { track: 'ambient', label: 'SHIMMER', scale: 'major', instrument: 'glassPad', notes: [[0, 0, 8, 0.5], [0, 2, 8, 0.45], [0, 4, 8, 0.45], [8, 3, 8, 0.5], [8, 5, 8, 0.45], [8, 7, 8, 0.4]] },
  ambientSpace: { track: 'ambient', label: 'SPACE', scale: 'minorPent', instrument: 'airPad', notes: [[0, 0, 8, 0.5], [0, 3, 8, 0.45], [8, 2, 8, 0.5], [8, 4, 8, 0.45]] },
  arpMinor: { track: 'arp', label: 'MINOR CHORD', scale: 'minor', instrument: 'pluck', notes: [[0, 0, 16, 0.8], [0, 2, 16, 0.8], [0, 4, 16, 0.8]] },
  arpMajor: { track: 'arp', label: 'MAJOR CHORD', scale: 'major', instrument: 'electricPiano', notes: [[0, 0, 16, 0.8], [0, 2, 16, 0.8], [0, 4, 16, 0.8]] },
  arpChanges: { track: 'arp', label: 'TWO CHORDS', scale: 'minor', instrument: 'pluck', notes: [[0, 0, 8, 0.8], [0, 2, 8, 0.8], [0, 4, 8, 0.8], [8, 5, 8, 0.8], [8, 7, 8, 0.8], [8, 2, 8, 0.8]] },
  arpBell: { track: 'arp', label: 'BELL ARP', scale: 'majorPent', instrument: 'bell', notes: [[0, 0, 16, 0.7], [0, 2, 16, 0.7], [0, 3, 16, 0.7]] }
};
export const TRACK_PRESET_NAMES = Object.keys(TRACK_PRESETS) as TrackPresetName[];
export const presetsForTrack = (track: 'ambient' | 'arp'): TrackPresetName[] => TRACK_PRESET_NAMES.filter(n => TRACK_PRESETS[n].track === track);

export function makeTrackPreset(name: TrackPresetName, keyPc: number): { scale: ScaleName; instrument: MelodyInstrumentId; notes: MelodyNote[] } {
  const p = TRACK_PRESETS[name];
  const rows = scaleRows(keyPc, p.scale);
  return { scale: p.scale, instrument: p.instrument, notes: normalizeNotes(p.notes.map(([step, degree, len, vel]) => make(rows[Math.min(degree, rows.length - 1)], step, len, vel))) };
}
