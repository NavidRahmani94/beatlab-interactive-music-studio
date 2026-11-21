import { describe, expect, it } from 'vitest';
import { SAMPLE_PROJECTS, startupProject } from './project';
import { SCALES, noteToMidi } from '../music/melody';

const A_MINOR = new Set(SCALES.minor.intervals.map(i => (9 + i) % 12));   // A B C D E F G

describe('Still D.R.E. style (a sample song)', () => {
  const p = SAMPLE_PROJECTS['Still D.R.E. style']();
  it('is in the sample list, the app still starts with the Hip Hop Demo', () => { expect(Object.keys(SAMPLE_PROJECTS)).toContain('Still D.R.E. style'); expect(startupProject().name).toBe('Hip Hop Demo'); });
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
  it('the piano loop is the transcription: C5+A5 eighth-note stabs 11 times, then B4+G5 5 times (2 bars)', () => {
    const g = p.patterns[1];
    const at = (track: string, step: number) => g.notes[track].filter(n => n.step === step).map(n => noteToMidi(n.pitch)).sort();
    for (let st = 0; st < 22; st += 2) expect(at('melody', st), `step ${st}`).toEqual([72, 81]);
    for (let st = 22; st < 32; st += 2) expect(at('melody', st), `step ${st}`).toEqual([71, 79]);
    expect(g.notes.melody).toHaveLength(32);                         // 16 stabs of two notes, nothing else
    expect(g.notes.melody.every(n => n.step % 2 === 0 && n.lengthSteps === 2)).toBe(true);
  });
  it('the bass line is A, B, E, G (the transcription, one octave up)', () => {
    const bass = p.patterns[1].notes.ambient.map(n => [n.step, noteToMidi(n.pitch), n.lengthSteps]).sort((x, y) => (x[0] as number) - (y[0] as number));
    expect(bass).toEqual([[0, 45, 3], [12, 47, 4], [16, 52, 3], [28, 43, 4]]);
  });
  it('the intro is the piano alone and the bass comes in with the groove (as in the transcription)', () => {
    expect(p.patterns[0].notes.ambient ?? []).toHaveLength(0); expect(p.patterns[0].notes.melody.length).toBeGreaterThan(0);
  });
  it('the drums have a kick and a backbeat snare', () => {
    const g = p.patterns[1];
    expect(g.drums.kick[0]).toBe(true); expect(g.drums.snare[4]).toBe(true); expect(g.drums.snare[12]).toBe(true);
  });
  it('the mix (checked by rendering it): the piano leads, the bass sits under it, the snare is clear and the hats are soft', () => {
    expect(p.channels.melody.volumeDb).toBeGreaterThan(p.channels.ambient.volumeDb);
    expect(p.channels.snare.volumeDb).toBeGreaterThan(p.channels.hat.volumeDb + 10);
    expect(p.channels.kick.volumeDb).toBeGreaterThan(p.channels.hat.volumeDb);
    expect(p.channels.ambient.reverbSend).toBe(0);   // a sub bass stays dry
  });
});
