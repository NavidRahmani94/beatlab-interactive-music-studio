import { describe, expect, it } from 'vitest';
import { SAMPLE_PROJECTS, startupProject } from './project';
import { SCALES, noteToMidi } from '../music/melody';

const A_MINOR = new Set(SCALES.minor.intervals.map(i => (9 + i) % 12));   // A B C D E F G

describe('Still D.R.E. style (the song every new project starts with)', () => {
  const p = SAMPLE_PROJECTS['Still D.R.E. style']();
  it('is what the app starts with', () => { expect(startupProject().name).toBe('Still D.R.E. style'); });
  it('is 93 BPM in A minor with a piano, a sub bass and a dry kit', () => {
    expect(p.bpm).toBe(93);
    expect(p.melodyView).toEqual({ key: 9, scale: 'minor' });
    expect(p.tracks.find(t => t.id === 'melody')?.instrument).toBe('piano');
    expect(p.tracks.find(t => t.id === 'ambient')?.instrument).toBe('subBass');
    expect(p.drumKit).toBe('tight');
  });
  it('uses only notes of A minor', () => {
    p.patterns.forEach(pt => Object.values(pt.notes).forEach(list => list.forEach(n => expect(A_MINOR.has((noteToMidi(n.pitch) ?? 0) % 12), n.pitch).toBe(true))));
  });
  it('the piano plays the three chord shapes (C-E-A, B-E-A, B-E-G) and the bass roots are A and E', () => {
    const groove = p.patterns[1];
    const at = (track: string, step: number) => groove.notes[track].filter(n => n.step === step).map(n => noteToMidi(n.pitch)).sort();
    expect(at('melody', 0)).toEqual([60, 64, 69]); expect(at('melody', 6)).toEqual([59, 64, 69]); expect(at('melody', 10)).toEqual([59, 64, 67]);
    expect(at('ambient', 0)).toEqual([45]); expect(at('ambient', 6)).toEqual([40]);
  });
  it('the bass is lower than the piano and the drums have a kick and a backbeat snare', () => {
    const g = p.patterns[1];
    expect(Math.max(...g.notes.ambient.map(n => noteToMidi(n.pitch) ?? 0))).toBeLessThan(Math.min(...g.notes.melody.map(n => noteToMidi(n.pitch) ?? 0)));
    expect(g.drums.kick[0]).toBe(true); expect(g.drums.snare[4]).toBe(true); expect(g.drums.snare[12]).toBe(true);
  });
  it('the mix (checked by rendering it): the piano leads, the bass sits under it, the snare is clear and the hats are soft', () => {
    expect(p.channels.melody.volumeDb).toBeGreaterThan(p.channels.ambient.volumeDb);
    expect(p.channels.snare.volumeDb).toBeGreaterThan(p.channels.hat.volumeDb + 10);
    expect(p.channels.kick.volumeDb).toBeGreaterThan(p.channels.hat.volumeDb);
    expect(p.channels.ambient.reverbSend).toBe(0);   // a sub bass stays dry
  });
});
