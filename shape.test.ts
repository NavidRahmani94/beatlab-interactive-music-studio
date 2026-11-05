import { describe, expect, it } from 'vitest';
import { DIV, Layer, MAX_SIDES, PATTERN_KINDS, SHAPE_INSTRUMENTS, chordName, chordNotes, clampVolDb, defaultLayer, makePattern, noteLabel, noteSeconds, shapeToPatterns, tickEvents } from './shapeMusic';
import { MELODY_INSTRUMENTS } from './instruments';
import { noteToMidi } from './melody';

const C_MAJOR = [48, 50, 52, 53, 55, 57, 59, 60];          // scaleRows style: the scale with the octave on top
const A_MINOR = [57, 59, 60, 62, 64, 65, 67, 69];
const PENTA = [48, 50, 52, 55, 57, 60];                    // C major pentatonic

describe('chords from shapes', () => {
  it('a triangle is a triad, a square a 7th chord, a pentagon a 9th (C major, degree I)', () => {
    expect(chordNotes(C_MAJOR, 0, 3)).toEqual([48, 52, 55]); expect(chordName(chordNotes(C_MAJOR, 0, 3))).toBe('C');
    expect(chordName(chordNotes(C_MAJOR, 0, 4))).toBe('Cmaj7'); expect(chordName(chordNotes(C_MAJOR, 0, 5))).toBe('Cmaj9');
  });
  it('all degrees give the right names in C major', () => {
    const names = [0, 1, 2, 3, 4, 5, 6].map(d => chordName(chordNotes(C_MAJOR, d, 3)));
    expect(names).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect([0, 1, 4, 6].map(d => chordName(chordNotes(C_MAJOR, d, 4)))).toEqual(['Cmaj7', 'Dm7', 'G7', 'Bm7b5']);
  });
  it('A minor: Am, F, C, G and the 7th chords', () => {
    expect([0, 5, 2, 6].map(d => chordName(chordNotes(A_MINOR, d, 3)))).toEqual(['Am', 'F', 'C', 'G']);
    expect(chordName(chordNotes(A_MINOR, 0, 4))).toBe('Am7');
  });
  it('every note stays inside the scale, also for a pentatonic scale, and the root stays near C3..B3', () => {
    const pcs = new Set(PENTA.map(m => m % 12));
    for (let d = 0; d < 7; d++) for (let s = 3; s <= MAX_SIDES; s++) chordNotes(PENTA, d, s).forEach(m => expect(pcs.has(m % 12)).toBe(true));
    for (let d = 0; d < 7; d++) { const r = chordNotes(C_MAJOR, d, 3); expect(r[0]).toBeGreaterThanOrEqual(48); expect(r[0]).toBeLessThanOrEqual(71); }
    expect(chordNotes(C_MAJOR, 0, 3, 1)).toEqual([60, 64, 67]); expect(chordNotes(C_MAJOR, 0, 3, -1)).toEqual([36, 40, 43]);
  });
  it('notes go up from corner to corner; wrong input is safe', () => {
    const c = chordNotes(C_MAJOR, 4, 6); for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1]);
    expect(chordNotes([], 0, 3)).toEqual([]); expect(chordNotes(C_MAJOR, -1, 99).length).toBe(MAX_SIDES); expect(chordName([])).toBe('');
    expect(noteLabel(60)).toBe('C4'); expect(noteLabel(61)).toBe('C#4');
  });
});

describe('the clock: arp and chord on the beat', () => {
  const prog = [0, 4, 5, 3];
  const arp: Layer = { sides: 3, octave: 0, rate: '1/16', mode: 'arp', pattern: [1, 2, 3, 2], instrument: 'pluck', volumeDb: -8 };
  it('1/16 arp plays one corner every tick, in the pattern order', () => {
    const notes = Array.from({ length: 4 }, (_, t) => tickEvents(arp, prog, t, C_MAJOR)!.play[0]);
    expect(notes).toEqual([48, 52, 55, 52]);
  });
  it('the chord changes on the bar line (every 16 ticks) and the progression repeats', () => {
    const name = (t: number) => tickEvents(arp, prog, t, C_MAJOR)!.name;
    expect([0, 15, 16, 31, 32, 48, 64].map(name)).toEqual(['C', 'C', 'G', 'G', 'Am', 'F', 'C']);
  });
  it('rates: 1/8 only plays on even ticks, 1/4 every fourth tick', () => {
    const l8 = { ...arp, rate: '1/8' as const }, l4 = { ...arp, rate: '1/4' as const };
    expect([0, 1, 2, 3, 4].map(t => !!tickEvents(l8, prog, t, C_MAJOR))).toEqual([true, false, true, false, true]);
    expect([0, 1, 4, 8, 6].map(t => !!tickEvents(l4, prog, t, C_MAJOR))).toEqual([true, false, true, true, false]);
    expect(DIV['1/4']).toBe(4);
  });
  it('CHORD mode plays all corners together, and the pattern is the rhythm (0 = rest)', () => {
    const ch: Layer = { sides: 4, octave: 0, rate: '1/8', mode: 'chord', pattern: [1, 0, 1, 1], instrument: 'warmPad', volumeDb: -8 };
    const e0 = tickEvents(ch, prog, 0, C_MAJOR)!; expect(e0.play).toHaveLength(4); expect(e0.name).toBe('Cmaj7');
    const e1 = tickEvents(ch, prog, 2, C_MAJOR)!; expect(e1.rest).toBe(true); expect(e1.play).toEqual([]);
  });
  it('mode off, empty progression or empty pattern are quiet', () => {
    expect(tickEvents({ ...arp, mode: 'off' }, prog, 0, C_MAJOR)).toBeNull(); expect(tickEvents(arp, [], 0, C_MAJOR)).toBeNull(); expect(tickEvents({ ...arp, pattern: [] }, prog, 0, C_MAJOR)).toBeNull();
  });
  it('a pattern number bigger than the corners wraps round (no crash)', () => {
    const l: Layer = { ...arp, pattern: [6] }; expect(C_MAJOR).toBeTruthy(); expect(tickEvents(l, prog, 0, C_MAJOR)!.play).toHaveLength(1);
  });
  it('note length is shorter than its step, so notes do not run together', () => {
    expect(noteSeconds(120, '1/8', 'arp')).toBeLessThan(0.25); expect(noteSeconds(120, '1/4', 'chord')).toBeLessThan(0.5); expect(noteSeconds(120, '1/16', 'arp')).toBeGreaterThan(0.05);
  });
});

describe('arpeggio patterns', () => {
  it('every kind gives the right length and legal numbers', () => {
    for (const k of PATTERN_KINDS) for (const n of [3, 4, 5, 6]) for (const len of [8, 16]) {
      const p = makePattern(k.id, n, len); expect(p).toHaveLength(len); p.forEach(v => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(n); });
    }
  });
  it('up, down and up-down for 4 corners', () => {
    expect(makePattern('up', 4, 8)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]); expect(makePattern('down', 4, 8)).toEqual([4, 3, 2, 1, 4, 3, 2, 1]); expect(makePattern('updown', 4, 8)).toEqual([1, 2, 3, 4, 3, 2, 1, 2]);
  });
  it('rhythm has rests; random is repeatable with a seeded generator; default layer is valid', () => {
    expect(makePattern('rhythm', 3, 8)).toContain(0); let s = 1; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; let s2 = 1; const r2 = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
    expect(makePattern('random', 4, 16, r)).toEqual(makePattern('random', 4, 16, r2)); const d = defaultLayer(0); expect(d.pattern).toHaveLength(8); expect(d.sides).toBe(3);
  });
});

describe('own sound and convert to pattern', () => {
  const prog = [0, 4, 5, 3];
  it('every shape starts with its own sound, a real instrument, and a safe volume', () => {
    for (let i = 0; i < 3; i++) { const l = defaultLayer(i); expect(l.instrument in MELODY_INSTRUMENTS).toBe(true); expect(l.volumeDb).toBeLessThan(0); }
    expect(SHAPE_INSTRUMENTS.every(id => id in MELODY_INSTRUMENTS)).toBe(true); expect(new Set([0, 1, 2].map(i => defaultLayer(i).instrument)).size).toBe(3);
    expect(clampVolDb(5)).toBe(0); expect(clampVolDb(-99)).toBe(-30); expect(clampVolDb(NaN)).toBe(-8);
  });
  it('4 bars become 2 patterns of 32 steps; the notes are the arpeggio of each chord, bar by bar', () => {
    const l: Layer = { sides: 3, octave: 0, rate: '1/8', mode: 'arp', pattern: [1, 2, 3, 2, 1, 2, 3, 2], instrument: 'pluck', volumeDb: -8 };
    const out = shapeToPatterns(l, prog, A_MINOR); expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(16); expect(out[1]).toHaveLength(16);                    // 1/8 = 8 notes per bar, 2 bars per pattern
    const first = out[0].filter(n => n.step < 16).sort((a, b) => a.step - b.step);
    expect(first.map(n => noteToMidi(n.pitch))).toEqual([57, 60, 64, 60, 57, 60, 64, 60].map(m => m + 0));      // A minor: A C E C A C E C
    expect(first.every(n => n.lengthSteps === 2 && n.step % 2 === 0)).toBe(true);
    expect(out[0].filter(n => n.step >= 16).map(n => noteToMidi(n.pitch))[0]).toBe(noteToMidi('E4'));   // bar 2 = Em: the first note is E (above the A of the Am chord)
  });
  it('CHORD mode writes all notes of the chord at the same step; rests write nothing', () => {
    const l: Layer = { sides: 4, octave: 0, rate: '1/4', mode: 'chord', pattern: [1, 0, 1, 1], instrument: 'warmPad', volumeDb: -8 };
    const out = shapeToPatterns(l, [0], A_MINOR); expect(out).toHaveLength(1);
    const at0 = out[0].filter(n => n.step === 0); expect(at0).toHaveLength(4); expect(out[0].filter(n => n.step === 4)).toHaveLength(0);
  });
  it('1 bar still gives one pattern; notes are inside the piano roll range and the steps are valid', () => {
    const l = defaultLayer(0); const out = shapeToPatterns(l, [0], A_MINOR); expect(out).toHaveLength(1);
    for (const p of shapeToPatterns({ ...l, octave: 1, sides: 6 }, prog, A_MINOR)) for (const n of p) { const m = noteToMidi(n.pitch)!; expect(m).toBeGreaterThanOrEqual(36); expect(m).toBeLessThanOrEqual(96); expect(n.step).toBeLessThan(32); expect(n.step + n.lengthSteps).toBeLessThanOrEqual(32); }
  });
});
