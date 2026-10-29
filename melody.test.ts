import { describe, expect, it } from 'vitest';
import {
  MAX_MIDI, MIN_MIDI, PRESETS, PRESET_NAMES, SCALES, ScaleName, easyRoot, inScale, makePreset, generateMelody, setStepVelocity, stepVelocity, clampVelocity,
  midiToNote, noteAt, resizeNote, makeTrackPreset, presetsForTrack, TRACK_PRESETS, TRACK_PRESET_NAMES, noteToMidi, normalizeNotes, scaleRows, snapNotesToScale, toggleNote, transposeNotes, remapToScale
} from './melody';
import { isMelodyInstrument } from './instruments';

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

describe('moods (presets)', () => {
  it('there are nine moods', () => { expect(PRESET_NAMES).toHaveLength(9); });
  it('moods use several different instruments and scales', () => {
    expect(new Set(PRESET_NAMES.map(n => PRESETS[n].instrument)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(PRESET_NAMES.map(n => PRESETS[n].scale)).size).toBeGreaterThanOrEqual(3);
  });
  it('every cell is a single step (no 2-by-2 blocks)', () => {
    PRESET_NAMES.forEach(n => makePreset(n, 0).notes.forEach(x => expect(x.lengthSteps).toBe(1)));
  });
  PRESET_NAMES.forEach(name => {
    it(`${name} is valid in every key and has a real instrument`, () => {
      expect(isMelodyInstrument(PRESETS[name].instrument)).toBe(true);
      for (let pc = 0; pc < 12; pc++) {
        const { scale, notes, instrument } = makePreset(name, pc);
        expect(instrument).toBe(PRESETS[name].instrument);
        expect(notes).toHaveLength(PRESETS[name].notes.length);
        expect(normalizeNotes(notes)).toEqual(notes);
        const rows = scaleRows(pc, scale);
        notes.forEach(n => {
          expect(rows).toContain(noteToMidi(n.pitch));
          expect(n.step + n.lengthSteps).toBeLessThanOrEqual(16);
          expect(n.velocity).toBeGreaterThan(0);
        });
      }
    });
  });
});

describe('velocity', () => {
  it('new notes carry the given velocity', () => { expect(toggleNote([], 60, 0, 1, 0.3)[0].velocity).toBe(0.3); });
  it('clamps velocity into 0.05..1', () => { expect(clampVelocity(5)).toBe(1); expect(clampVelocity(-1)).toBe(0.05); expect(clampVelocity(NaN)).toBe(0.8); });
  it('setStepVelocity changes only notes that start on that step', () => {
    let n = toggleNote([], 60, 0, 4, 0.8);          // C4 starts at 0, covers 0..3
    n = toggleNote(n, 64, 0, 1, 0.8);               // E4 starts at 0
    n = toggleNote(n, 67, 2, 1, 0.8);               // G4 starts at 2
    const m = setStepVelocity(n, 0, 0.4);
    expect(m.filter(x => x.step === 0).every(x => x.velocity === 0.4)).toBe(true);
    expect(m.find(x => x.step === 2)?.velocity).toBe(0.8);
    expect(stepVelocity(m, 0)).toBe(0.4);
    expect(stepVelocity(m, 1)).toBeUndefined();     // no note STARTS on step 1
    expect(setStepVelocity(n, 5, 0.1)).toBe(n);     // nothing starts there -> same reference
  });
  it('velocity survives transpose and snap', () => {
    const n = toggleNote([], 61, 0, 1, 0.33);
    expect(transposeNotes(n, 2)[0].velocity).toBe(0.33);
    expect(snapNotesToScale(n, 0, 'majorPent')[0].velocity).toBe(0.33);
  });
});

describe('auto melody', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(generateMelody(0, 'majorPent', 'happy', 42)).toEqual(generateMelody(0, 'majorPent', 'happy', 42));
    expect(generateMelody(0, 'majorPent', 'happy', 1)).not.toEqual(generateMelody(0, 'majorPent', 'happy', 2));
  });
  it('is always in key, inside the bar, non-overlapping, and never nearly empty', () => {
    (Object.keys(SCALES) as ScaleName[]).forEach(scale => PRESET_NAMES.forEach(mood => {
      for (const seed of [1, 7, 99, 12345, 987654321]) {
        for (const pc of [0, 5, 11]) {
          const notes = generateMelody(pc, scale, mood, seed);
          const rows = scaleRows(pc, scale);
          expect(notes.length).toBeGreaterThanOrEqual(3);
          expect(normalizeNotes(notes)).toEqual(notes);
          notes.forEach(n => { expect(rows).toContain(noteToMidi(n.pitch)); expect(n.step + n.lengthSteps).toBeLessThanOrEqual(16); });
          expect(noteToMidi(notes[notes.length - 1].pitch)).toBe(rows[0]); // resolves on the root
          expect(notes[0].step).toBe(0);
        }
      }
    }));
  });
});

describe('changing the scale changes the music', () => {
  it('Major -> Minor keeps each note\'s degree, so the notes really change', () => {
    const major = makePreset('dreamy', 0).notes;                 // C major
    const minor = remapToScale(major, 0, 'major', 'minor');
    expect(minor.map(n => n.step)).toEqual(major.map(n => n.step));
    expect(minor.map(n => n.pitch)).not.toEqual(major.map(n => n.pitch));
    minor.forEach(n => expect(inScale(noteToMidi(n.pitch)!, 0, 'minor')).toBe(true));
    // the 3rd of C major (E) becomes the 3rd of C minor (Eb)
    const third = remapToScale([...toggleNote([], 64, 0, 1)], 0, 'major', 'minor')[0];
    expect(third.pitch).toBe('D#4');
  });
  it('same scale is a no-op and velocity is kept', () => {
    const n = toggleNote([], 64, 3, 1, 0.37);
    expect(remapToScale(n, 0, 'major', 'major')).toEqual(n);
    expect(remapToScale(n, 0, 'major', 'minor')[0].velocity).toBe(0.37);
  });
  it('moods differ in feel: epic is louder and busier than chill', () => {
    const avg = (mood: 'epic' | 'chill') => {
      let notes = 0, vel = 0;
      for (let seed = 1; seed <= 40; seed++) { const m = generateMelody(0, 'minor', mood, seed); notes += m.length; vel += m.reduce((a, x) => a + x.velocity, 0) / m.length; }
      return { notes: notes / 40, vel: vel / 40 };
    };
    expect(avg('epic').notes).toBeGreaterThan(avg('chill').notes);
    expect(avg('epic').vel).toBeGreaterThan(avg('chill').vel);
  });
  it('auto melody uses single-step cells only', () => {
    generateMelody(3, 'major', 'playful', 5).forEach(n => expect(n.lengthSteps).toBe(1));
  });
});

describe('stretching notes', () => {
  it('resizeNote changes the length and keeps everything else', () => {
    const n = toggleNote([], 60, 2, 1);
    const r = resizeNote(n, n[0].id, 6);
    expect(r[0]).toMatchObject({ pitch: 'C4', step: 2, lengthSteps: 6, velocity: n[0].velocity });
  });
  it('cannot pass the end of the bar', () => {
    const n = toggleNote([], 60, 12, 1);
    expect(resizeNote(n, n[0].id, 10)[0].lengthSteps).toBe(4);
  });
  it('cannot run into the next note of the same pitch, but ignores other pitches', () => {
    let n = toggleNote([], 60, 0, 1);
    n = toggleNote(n, 60, 6, 1);
    n = toggleNote(n, 64, 3, 1);
    const id = n.find(x => x.step === 0)!.id;
    expect(resizeNote(n, id, 12).find(x => x.step === 0)?.lengthSteps).toBe(6);
  });
  it('minimum length is 1; unknown id and NaN change nothing', () => {
    const n = toggleNote([], 60, 0, 4);
    expect(resizeNote(n, n[0].id, 0)[0].lengthSteps).toBe(1);
    expect(resizeNote(n, 'nope', 3)).toBe(n);
    expect(resizeNote(n, n[0].id, NaN)).toBe(n);
    expect(resizeNote(n, n[0].id, 4)).toBe(n);
  });
});

describe('ambient and arpeggio ready-made patterns', () => {
  it('there are patterns for both tracks', () => {
    expect(presetsForTrack('ambient').length).toBeGreaterThanOrEqual(3);
    expect(presetsForTrack('arp').length).toBeGreaterThanOrEqual(3);
  });
  TRACK_PRESET_NAMES.forEach(name => it(`${name} is valid in every key`, () => {
    for (let pc = 0; pc < 12; pc++) {
      const { scale, notes, instrument } = makeTrackPreset(name, pc);
      expect(isMelodyInstrument(instrument)).toBe(true);
      expect(notes).toHaveLength(TRACK_PRESETS[name].notes.length);
      expect(normalizeNotes(notes)).toEqual(notes);
      const rows = scaleRows(pc, scale);
      notes.forEach(n => { expect(rows).toContain(noteToMidi(n.pitch)); expect(n.step + n.lengthSteps).toBeLessThanOrEqual(16); });
    }
  }));
  it('ambient notes are long', () => {
    presetsForTrack('ambient').forEach(n => makeTrackPreset(n, 0).notes.forEach(x => expect(x.lengthSteps).toBeGreaterThanOrEqual(8)));
  });
});
