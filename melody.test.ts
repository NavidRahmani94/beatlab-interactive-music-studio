import { describe, expect, it } from 'vitest';
import {
  MAX_MIDI, MIN_MIDI, PRESETS, PresetName, SCALES, ScaleName, easyRoot, inScale, makePreset,
  midiToNote, noteAt, noteToMidi, normalizeNotes, scaleRows, snapNotesToScale, toggleNote, transposeNotes
} from './melody';

describe('note names', () => {
  it('converts midi <-> note names', () => {
    expect(midiToNote(60)).toBe('C4');
    expect(midiToNote(69)).toBe('A4');
    expect(midiToNote(61)).toBe('C#4');
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#3')).toBe(49);
    expect(noteToMidi('H4')).toBeNull();
  });
});

describe('scales', () => {
  it('C major pentatonic rows are C D E G A C', () => {
    expect(scaleRows(0, 'majorPent').map(midiToNote)).toEqual(['C4', 'D4', 'E4', 'G4', 'A4', 'C5']);
  });
  it('every key keeps the Easy rows inside the piano roll range', () => {
    for (let pc = 0; pc < 12; pc++) (Object.keys(SCALES) as ScaleName[]).forEach(s => {
      const rows = scaleRows(pc, s);
      expect(rows[0]).toBeGreaterThanOrEqual(MIN_MIDI);
      expect(rows[rows.length - 1]).toBeLessThanOrEqual(MAX_MIDI);
      rows.forEach(r => expect(inScale(r, pc, s) || r === rows[rows.length - 1]).toBe(true));
    });
  });
  it('inScale works', () => {
    expect(inScale(60, 0, 'majorPent')).toBe(true);
    expect(inScale(61, 0, 'majorPent')).toBe(false);
  });
});

describe('toggleNote', () => {
  it('adds then removes a note', () => {
    const a = toggleNote([], 60, 4, 2);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ pitch: 'C4', step: 4, lengthSteps: 2 });
    expect(toggleNote(a, 60, 5, 2)).toHaveLength(0); // clicking a covered cell removes it
  });
  it('clips length at the end of the bar', () => {
    expect(toggleNote([], 60, 14, 8)[0].lengthSteps).toBe(2);
  });
  it('a new long note replaces a later same-pitch note it runs into, not other pitches', () => {
    let n = toggleNote([], 60, 4, 2);   // C4 at 4..5
    n = toggleNote(n, 64, 4, 2);        // E4 at 4..5
    n = toggleNote(n, 60, 2, 4);        // empty cell at step 2, length 4 -> runs over the C4 at step 4
    expect(n.filter(x => x.pitch === 'C4')).toHaveLength(1);
    expect(n.find(x => x.pitch === 'C4')?.step).toBe(2);
    expect(n.some(x => x.pitch === 'E4')).toBe(true);
  });
  it('allows chords (same step, different pitch)', () => {
    let n = toggleNote([], 60, 0, 1);
    n = toggleNote(n, 64, 0, 1);
    expect(n).toHaveLength(2);
  });
  it('rejects invalid input', () => {
    const n = toggleNote([], 60, 0, 1);
    expect(toggleNote(n, 10, 0, 1)).toBe(n);
    expect(toggleNote(n, 60, 16, 1)).toBe(n);
    expect(toggleNote(n, 60, -1, 1)).toBe(n);
  });
  it('noteAt finds covered cells', () => {
    const n = toggleNote([], 60, 4, 4);
    expect(noteAt(n, 60, 7)).toBeDefined();
    expect(noteAt(n, 60, 8)).toBeUndefined();
  });
});

describe('transpose and snap', () => {
  it('transposes by semitones and keeps range', () => {
    const n = toggleNote([], 60, 0, 1);
    expect(transposeNotes(n, 7)[0].pitch).toBe('G4');
    const high = toggleNote([], MAX_MIDI, 0, 1);
    const t = transposeNotes(high, 5)[0];
    expect(noteToMidi(t.pitch)!).toBeLessThanOrEqual(MAX_MIDI);
  });
  it('changing key via easyRoot shift keeps notes on Easy rows', () => {
    const { notes } = makePreset('happy', 0);
    const shifted = transposeNotes(notes, easyRoot(7) - easyRoot(0));
    const rows = scaleRows(7, 'majorPent');
    shifted.forEach(n => expect(rows).toContain(noteToMidi(n.pitch)));
  });
  it('snaps out-of-scale notes into the scale', () => {
    const n = toggleNote([], 61, 0, 1); // C#4 is not in C major pentatonic
    const s = snapNotesToScale(n, 0, 'majorPent');
    expect(inScale(noteToMidi(s[0].pitch)!, 0, 'majorPent')).toBe(true);
  });
});

describe('presets', () => {
  (['happy', 'chill', 'dark'] as PresetName[]).forEach(name => {
    it(`${name} is valid in every key`, () => {
      for (let pc = 0; pc < 12; pc++) {
        const { scale, notes } = makePreset(name, pc);
        expect(notes).toHaveLength(PRESETS[name].notes.length);
        expect(normalizeNotes(notes)).toEqual(notes);
        const rows = scaleRows(pc, scale);
        notes.forEach(n => {
          expect(rows).toContain(noteToMidi(n.pitch));
          expect(n.step + n.lengthSteps).toBeLessThanOrEqual(16);
        });
      }
    });
  });
});
