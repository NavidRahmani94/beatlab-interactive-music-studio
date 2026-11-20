import { describe, expect, it } from 'vitest';
import { arpAt, defaultArp, ArpSettings } from './arp';
import { toggleNote, noteToMidi } from './melody';

const chord = () => { let n = toggleNote([], 60, 0, 16); n = toggleNote(n, 64, 0, 16); n = toggleNote(n, 67, 0, 16); return n; };
const play = (notes = chord(), s: ArpSettings = defaultArp(), tick0 = 0) => Array.from({ length: 16 }, (_, st) => arpAt(notes, st, s, tick0)[0]?.pitch ?? null);

describe('arpeggiator', () => {
  it('up plays the held notes low to high and repeats', () => {
    expect(play().slice(0, 6)).toEqual(['C4', 'E4', 'G4', 'C4', 'E4', 'G4']);
  });
  it('down is the reverse', () => {
    expect(play(chord(), { ...defaultArp(), mode: 'down' }).slice(0, 4)).toEqual(['G4', 'E4', 'C4', 'G4']);
  });
  it('up-down bounces without repeating the ends', () => {
    expect(play(chord(), { ...defaultArp(), mode: 'updown' }).slice(0, 8)).toEqual(['C4', 'E4', 'G4', 'E4', 'C4', 'E4', 'G4', 'E4']);
  });
  it('octaves extend the run upwards', () => {
    const p = play(chord(), { ...defaultArp(), octaves: 2 }).slice(0, 6).map(x => noteToMidi(x!));
    expect(p).toEqual([60, 64, 67, 72, 76, 79]);
  });
  it('random is deterministic for the same tick and stays inside the chord', () => {
    const s: ArpSettings = { ...defaultArp(), mode: 'random' };
    expect(play(chord(), s, 5)).toEqual(play(chord(), s, 5));
    expect(play(chord(), s, 5)).not.toEqual(play(chord(), s, 6));
    play(chord(), s, 3).forEach(x => expect(['C4', 'E4', 'G4']).toContain(x));
  });
  it('1/8 rate plays every second step with longer notes', () => {
    const ev = Array.from({ length: 16 }, (_, st) => arpAt(chord(), st, { ...defaultArp(), rate: '8n' }, 0));
    ev.forEach((e, st) => expect(e.length).toBe(st % 2 === 0 ? 1 : 0));
    expect(ev[0][0].durationSteps).toBeCloseTo(1.2);
  });
  it('is silent where no note is held, and follows chord changes', () => {
    let n = toggleNote([], 60, 0, 8); n = toggleNote(n, 72, 8, 8);
    const out = play(n);
    expect(out.slice(0, 8).every(x => x === 'C4')).toBe(true);
    expect(out.slice(8).every(x => x === 'C5')).toBe(true);
    expect(arpAt([], 0, defaultArp(), 0)).toEqual([]);
    expect(arpAt(toggleNote([], 60, 0, 2), 5, defaultArp(), 0)).toEqual([]);
  });
  it('velocity comes from the held note; duration follows the gate', () => {
    const n = toggleNote([], 60, 0, 16, 0.4);
    const e = arpAt(n, 0, { ...defaultArp(), gate: 0.5 }, 0)[0];
    expect(e.velocity).toBe(0.4);
    expect(e.durationSteps).toBeCloseTo(0.5);
  });
});
