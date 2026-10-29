import { describe, expect, it } from 'vitest';
import { PROGRESSIONS, chordNotes, diatonicChords, mergeNotes, modeOf, progressionNotes, progressionsFor, suggestNext, voiceChord } from './chords';
import { MAX_MIDI, MIN_MIDI, noteToMidi } from './melody';
import { STEPS } from './pattern';

const names = (key: number, scale: any, sev = false) => diatonicChords(key, scale, sev).map(c => c.name);
describe('diatonic chords', () => {
  it('C major triads', () => expect(names(0, 'major')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']));
  it('A minor triads', () => expect(names(9, 'minor')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']));
  it('C major 7ths', () => expect(names(0, 'major', true)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']));
  it('G major has F#dim', () => expect(names(7, 'major')[6]).toBe('F#dim'));
  it('pentatonic scales use the parent scale', () => {
    expect(names(0, 'majorPent')).toEqual(names(0, 'major'));
    expect(names(9, 'minorPent')).toEqual(names(9, 'minor'));
    expect(modeOf('minorPent')).toBe('minor');
  });
  it('roman numerals show the quality', () => expect(diatonicChords(0, 'major').map(c => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']));
});

describe('voicing', () => {
  it('C major in the mid register is C4 E4 G4', () => expect(voiceChord(0, [0, 4, 7], 'mid')).toEqual([60, 64, 67]));
  it('inversion moves the lowest note up an octave', () => {
    expect(voiceChord(0, [0, 4, 7], 'mid', 1)).toEqual([64, 67, 72]);
    expect(voiceChord(0, [0, 4, 7], 'mid', 2)).toEqual([67, 72, 76]);
  });
  it('every chord in every key stays inside the piano roll', () => {
    for (let k = 0; k < 12; k++) for (const sc of ['major', 'minor'] as const) for (const sev of [false, true]) for (const reg of ['low', 'mid'] as const)
      diatonicChords(k, sc, sev).forEach(c => [0, 1, 2, 3].forEach(inv => voiceChord(c.rootPc, c.offsets, reg, inv).forEach(m => { expect(m).toBeGreaterThanOrEqual(MIN_MIDI); expect(m).toBeLessThanOrEqual(MAX_MIDI); })));
  });
});

describe('placing chords', () => {
  const triad = [60, 64, 67];
  it('block: all notes start together', () => {
    const n = chordNotes(triad, 4, 8, 'block');
    expect(n).toHaveLength(3); n.forEach(x => { expect(x.step).toBe(4); expect(x.lengthSteps).toBe(8); });
  });
  it('strum: staggered starts, common end', () => {
    const n = chordNotes(triad, 0, 8, 'strum');
    expect(n.map(x => x.step)).toEqual([0, 1, 2]); n.forEach(x => expect(x.step + x.lengthSteps).toBe(8));
  });
  it('arp: runs up the chord and repeats', () => {
    const n = chordNotes(triad, 0, 8, 'arp');
    expect(n.map(x => noteToMidi(x.pitch))).toEqual([60, 64, 67, 60]);
    expect(n.map(x => x.step)).toEqual([0, 2, 4, 6]);
  });
  it('is cut off at the end of the pattern and ignores bad steps', () => {
    chordNotes(triad, 28, 16, 'block').forEach(x => expect(x.step + x.lengthSteps).toBeLessThanOrEqual(STEPS));
    expect(chordNotes(triad, STEPS, 4, 'block')).toEqual([]);
    expect(chordNotes(triad, -1, 4, 'block')).toEqual([]);
    expect(chordNotes([], 0, 4, 'block')).toEqual([]);
  });
  it('merge replaces overlapping notes of the same pitch and keeps the rest', () => {
    const a = chordNotes([60], 0, 8, 'block'), b = chordNotes([60, 64], 4, 8, 'block');
    const m = mergeNotes(a, b);
    expect(m.filter(x => x.pitch === 'C4')).toHaveLength(1);
    expect(m).toHaveLength(2);
  });
});

describe('suggestions and progressions', () => {
  it('V resolves to I first in major, v to i in minor', () => {
    expect(suggestNext(4, 'major')[0].index).toBe(0);
    expect(suggestNext(4, 'minor')[0].index).toBe(0);
  });
  it('every chord has suggestions that exist in the key', () => {
    for (const sc of ['major', 'minor'] as const) for (let i = 0; i < 7; i++) { const s = suggestNext(i, sc); expect(s.length).toBeGreaterThan(0); s.forEach(x => { expect(x.index).toBeGreaterThanOrEqual(0); expect(x.index).toBeLessThan(7); expect(x.why).toBeTruthy(); }); }
  });
  it('with no previous chord it starts at home', () => expect(suggestNext(null, 'major')[0].index).toBe(0));
  it('progressions are listed per mode and fill the pattern', () => {
    expect(progressionsFor('major').every(p => p.mode === 'major')).toBe(true);
    PROGRESSIONS.forEach(p => {
      const notes = progressionNotes(0, p.mode === 'major' ? 'major' : 'minor', p.chords);
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach(n => expect(n.step + n.lengthSteps).toBeLessThanOrEqual(STEPS));
      expect(Math.max(...notes.map(n => n.step))).toBe(24);
    });
  });
  it('the pop progression in C is C G Am F', () => {
    const n = progressionNotes(0, 'major', [0, 4, 5, 3]);
    const roots = [0, 8, 16, 24].map(s => Math.min(...n.filter(x => x.step === s).map(x => noteToMidi(x.pitch)!)) % 12);
    expect(roots).toEqual([0, 7, 9, 5]);
  });
});
