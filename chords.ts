// Smart Chord Builder: pure music theory. Chords are built from the song's key and scale, placed on the step grid,
// and the next chord is suggested from the one before. No sound or UI code here, so it is easy to test.
import { MAX_MIDI, MIN_MIDI, MelodyNote, NOTE_NAMES, SCALES, ScaleName, clampVelocity, midiToNote, noteToMidi, normalizeNotes, DEFAULT_VELOCITY } from './melody';
import { STEPS } from './pattern';

export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | 'maj7' | 'min7' | 'dom7' | 'm7b5';
export type Register = 'low' | 'mid';
export type ChordStyle = 'block' | 'strum' | 'arp';
export type Mode = 'major' | 'minor';

export const REGISTERS: Record<Register, { label: string; base: number }> = { low: { label: 'LOW', base: 48 }, mid: { label: 'MID', base: 60 } };
export const CHORD_STYLES: Record<ChordStyle, { label: string; hint: string }> = {
  block: { label: 'BLOCK', hint: 'all notes at once' },
  strum: { label: 'STRUM', hint: 'notes start one after another, end together' },
  arp: { label: 'ARP', hint: 'notes run up the chord, repeating' }
};
const SUFFIX: Record<ChordQuality, string> = { maj: '', min: 'm', dim: 'dim', aug: 'aug', maj7: 'maj7', min7: 'm7', dom7: '7', m7b5: 'm7♭5' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const SHAPES: Record<string, ChordQuality> = {
  '0,4,7': 'maj', '0,3,7': 'min', '0,3,6': 'dim', '0,4,8': 'aug',
  '0,4,7,11': 'maj7', '0,3,7,10': 'min7', '0,4,7,10': 'dom7', '0,3,6,10': 'm7b5'
};

export type ChordInfo = { index: number; rootPc: number; quality: ChordQuality; offsets: number[]; name: string; roman: string };

/** Pentatonic scales use the chords of their parent 7-note scale. */
export const modeOf = (scale: ScaleName): Mode => (scale === 'major' || scale === 'majorPent' ? 'major' : 'minor');

export function chordName(rootPc: number, quality: ChordQuality): string { return NOTE_NAMES[((rootPc % 12) + 12) % 12] + SUFFIX[quality]; }

function romanFor(index: number, quality: ChordQuality): string {
  const base = ROMAN[index];
  switch (quality) {
    case 'maj': return base;
    case 'min': return base.toLowerCase();
    case 'dim': return base.toLowerCase() + '°';
    case 'aug': return base + '+';
    case 'maj7': return base + 'maj7';
    case 'min7': return base.toLowerCase() + '7';
    case 'dom7': return base + '7';
    case 'm7b5': return base.toLowerCase() + 'ø';
  }
}

/** The seven chords that belong to the key (triads, or four-note 7th chords). */
export function diatonicChords(keyPc: number, scale: ScaleName, sevenths = false): ChordInfo[] {
  const iv = SCALES[modeOf(scale)].intervals;
  return iv.map((_, d) => {
    const at = (k: number) => iv[(d + k) % 7] + 12 * Math.floor((d + k) / 7) - iv[d];
    const offsets = sevenths ? [0, at(2), at(4), at(6)] : [0, at(2), at(4)];
    const quality = SHAPES[offsets.join(',')] ?? 'maj';
    const rootPc = (((keyPc + iv[d]) % 12) + 12) % 12;
    return { index: d, rootPc, quality, offsets, name: chordName(rootPc, quality), roman: romanFor(d, quality) };
  });
}

/** MIDI notes of a chord: the root in the chosen register, optionally inverted, always inside the piano roll. */
export function voiceChord(rootPc: number, offsets: number[], register: Register, inversion = 0): number[] {
  const base = REGISTERS[register].base;
  const root = base + ((((rootPc - base) % 12) + 12) % 12);
  let midis = offsets.map(o => root + o);
  const inv = Math.max(0, Math.min(Math.floor(inversion) || 0, midis.length - 1));
  for (let i = 0; i < inv; i++) { const first = midis[0]; midis = [...midis.slice(1), first + 12]; }
  const fitted = midis.map(m => { let x = m; while (x > MAX_MIDI) x -= 12; while (x < MIN_MIDI) x += 12; return x; });
  return [...new Set(fitted)].sort((a, b) => a - b);
}

function note(midi: number, step: number, length: number, velocity: number): MelodyNote {
  return { id: `n${midi}_${step}`, pitch: midiToNote(midi), step, lengthSteps: length, velocity: clampVelocity(velocity) };
}

/** The notes of one chord played in a style, starting at `step` and lasting `length` steps (cut off at the end of the pattern). */
export function chordNotes(midis: number[], step: number, length: number, style: ChordStyle, velocity = DEFAULT_VELOCITY): MelodyNote[] {
  if (!Number.isInteger(step) || step < 0 || step >= STEPS || midis.length === 0) return [];
  const end = Math.min(STEPS, step + Math.max(1, Math.round(length)));
  const out: MelodyNote[] = [];
  if (style === 'block') {
    midis.forEach(m => out.push(note(m, step, end - step, velocity)));
  } else if (style === 'strum') {
    midis.forEach((m, i) => { const s = step + i; if (s < end) out.push(note(m, s, end - s, velocity)); });
  } else {
    let i = 0;
    for (let s = step; s < end; s += 2, i++) out.push(note(midis[i % midis.length], s, Math.min(2, end - s), velocity));
  }
  return out;
}

/** Adds notes to a track; a new note replaces anything on the same pitch that it overlaps. */
export function mergeNotes(existing: MelodyNote[], added: MelodyNote[]): MelodyNote[] {
  let out = existing;
  for (const n of added) {
    const m = noteToMidi(n.pitch);
    out = out.filter(e => !(noteToMidi(e.pitch) === m && e.step < n.step + n.lengthSteps && e.step + e.lengthSteps > n.step));
  }
  return normalizeNotes([...out, ...added]);
}

// ---------- what to play next ----------
export type Suggestion = { index: number; why: string };
const NEXT: Record<Mode, Record<number, Suggestion[]>> = {
  major: {
    0: [{ index: 3, why: 'I → IV: opens up, warm' }, { index: 4, why: 'I → V: pushes forward' }, { index: 5, why: 'I → vi: softer, a little sad' }, { index: 1, why: 'I → ii: leads toward V' }],
    1: [{ index: 4, why: 'ii → V: the classic lead-in' }, { index: 3, why: 'ii → IV: stays calm' }, { index: 6, why: 'ii → vii°: tense' }],
    2: [{ index: 5, why: 'iii → vi: smooth fall' }, { index: 3, why: 'iii → IV: bright lift' }],
    3: [{ index: 4, why: 'IV → V: builds to a release' }, { index: 0, why: 'IV → I: gentle “amen” ending' }, { index: 1, why: 'IV → ii: floating' }],
    4: [{ index: 0, why: 'V → I: the strongest resolution' }, { index: 5, why: 'V → vi: a surprise (deceptive)' }, { index: 3, why: 'V → IV: pop rock' }],
    5: [{ index: 3, why: 'vi → IV: emotional pop' }, { index: 1, why: 'vi → ii: moves toward V' }, { index: 4, why: 'vi → V: tension' }],
    6: [{ index: 0, why: 'vii° → I: resolves up' }, { index: 2, why: 'vii° → iii: smooth' }]
  },
  minor: {
    0: [{ index: 5, why: 'i → VI: epic and open' }, { index: 3, why: 'i → iv: dark and deeper' }, { index: 6, why: 'i → VII: driving' }, { index: 4, why: 'i → v: moody' }],
    1: [{ index: 4, why: 'ii° → v: pulls toward home' }, { index: 6, why: 'ii° → VII: lifts' }],
    2: [{ index: 5, why: 'III → VI: warm' }, { index: 3, why: 'III → iv: back to the dark' }, { index: 6, why: 'III → VII: bright push' }],
    3: [{ index: 4, why: 'iv → v: builds' }, { index: 6, why: 'iv → VII: lifts out' }, { index: 0, why: 'iv → i: sad ending' }],
    4: [{ index: 0, why: 'v → i: returns home' }, { index: 5, why: 'v → VI: opens up' }],
    5: [{ index: 6, why: 'VI → VII: climbs' }, { index: 2, why: 'VI → III: bright turn' }, { index: 3, why: 'VI → iv: stays dark' }],
    6: [{ index: 0, why: 'VII → i: home' }, { index: 2, why: 'VII → III: bright turn' }, { index: 5, why: 'VII → VI: floating' }]
  }
};
/** Chords that sound good after `previous` (a chord index 0–6), best first. Without a previous chord: the home chord first. */
export function suggestNext(previous: number | null, scale: ScaleName): Suggestion[] {
  const mode = modeOf(scale);
  if (previous === null || previous < 0 || previous > 6) return [{ index: 0, why: 'Start at home (the first chord of the key)' }, { index: mode === 'major' ? 5 : 5, why: 'or start on the sad / epic side' }];
  return NEXT[mode][previous] ?? [];
}

// ---------- ready-made progressions (chord indices, one chord per `length` steps) ----------
export type Progression = { id: string; label: string; mode: Mode; chords: number[] };
export const PROGRESSIONS: Progression[] = [
  { id: 'pop', label: 'Pop  I–V–vi–IV', mode: 'major', chords: [0, 4, 5, 3] },
  { id: 'emotional', label: 'Emotional  vi–IV–I–V', mode: 'major', chords: [5, 3, 0, 4] },
  { id: 'fifties', label: '50s  I–vi–IV–V', mode: 'major', chords: [0, 5, 3, 4] },
  { id: 'jazz', label: 'Jazz  ii–V–I–I', mode: 'major', chords: [1, 4, 0, 0] },
  { id: 'epic', label: 'Epic  i–VI–III–VII', mode: 'minor', chords: [0, 5, 2, 6] },
  { id: 'dark', label: 'Dark  i–iv–v–i', mode: 'minor', chords: [0, 3, 4, 0] },
  { id: 'drive', label: 'Drive  i–VII–VI–VII', mode: 'minor', chords: [0, 6, 5, 6] },
  { id: 'andalus', label: 'Andalusian  i–VII–VI–V', mode: 'minor', chords: [0, 6, 5, 4] }
];
export const progressionsFor = (scale: ScaleName): Progression[] => PROGRESSIONS.filter(p => p.mode === modeOf(scale));

/** A whole progression laid out from step 0 (e.g. four chords of 8 steps fill a 32-step pattern). */
export function progressionNotes(keyPc: number, scale: ScaleName, chords: number[], opts: { sevenths?: boolean; register?: Register; style?: ChordStyle; length?: number; velocity?: number } = {}): MelodyNote[] {
  const { sevenths = false, register = 'mid', style = 'block', length = 8, velocity = DEFAULT_VELOCITY } = opts;
  const all = diatonicChords(keyPc, scale, sevenths);
  let out: MelodyNote[] = [];
  chords.forEach((c, i) => {
    const info = all[c]; if (!info) return;
    out = mergeNotes(out, chordNotes(voiceChord(info.rootPc, info.offsets, register), i * length, length, style, velocity));
  });
  return out;
}
