import { describe, expect, it } from 'vitest';
import { SAMPLE_PROJECTS, hasAudibleContent, parseProject, serializeProject } from './project';
import { MAX_MIDI, MIN_MIDI, noteToMidi } from './melody';
import { isDrumKit, isMelodyInstrument } from './instruments';
import { STEPS } from './pattern';

const DEMOS = ['Hip Hop Demo', 'Lo-Fi Chill', 'House 124', 'Trap 140', 'Persian Mood', 'Synthwave 108', 'Chiptune 150'];

describe('demo songs in several styles', () => {
  it('are all listed as samples', () => { DEMOS.forEach(n => expect(Object.keys(SAMPLE_PROJECTS)).toContain(n)); });
  DEMOS.forEach(name => {
    describe(name, () => {
      const p = SAMPLE_PROJECTS[name]();
      it('has the right name and survives save + open', () => {
        expect(p.name).toBe(name);
        const r = parseProject(serializeProject(p));
        expect(r.ok, r.ok ? '' : r.error).toBe(true);
        if (r.ok) expect(r.project).toEqual(p);
      });
      it('would make sound and uses real instruments and a real drum kit', () => {
        expect(hasAudibleContent(p)).toBe(true);
        expect(isDrumKit(p.drumKit)).toBe(true);
        p.tracks.forEach(t => expect(isMelodyInstrument(t.instrument), `${t.id}: ${t.instrument}`).toBe(true));
      });
      it('has 32-step patterns with every note inside the keyboard range', () => {
        p.patterns.forEach(pt => {
          (Object.values(pt.drums) as boolean[][]).forEach(row => expect(row).toHaveLength(STEPS));
          Object.values(pt.notes).forEach(list => list.forEach(n => {
            const midi = noteToMidi(n.pitch) ?? -1;
            expect(midi).toBeGreaterThanOrEqual(MIN_MIDI); expect(midi).toBeLessThanOrEqual(MAX_MIDI);
            expect(n.step + n.lengthSteps).toBeLessThanOrEqual(STEPS);
          }));
        });
      });
      it('plays every pattern somewhere in the playlist, with a reasonable length', () => {
        const used = new Set(p.playlist.filter((x): x is number => x !== null));
        p.patterns.forEach((_, i) => expect(used.has(i), `pattern ${i}`).toBe(true));
        expect(p.playlist.length).toBeGreaterThanOrEqual(10);
        expect(p.bpm).toBeGreaterThanOrEqual(60); expect(p.bpm).toBeLessThanOrEqual(200);
      });
    });
  });
  it('they are different songs: different tempo and different sounds', () => {
    const list = DEMOS.map(n => SAMPLE_PROJECTS[n]());
    expect(new Set(list.map(p => p.bpm)).size).toBe(DEMOS.length);
    expect(new Set(list.map(p => p.drumKit)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(list.map(p => p.tracks[0].instrument)).size).toBe(DEMOS.length);
  });
});
