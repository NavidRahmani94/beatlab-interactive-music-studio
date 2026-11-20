import { describe, expect, it } from 'vitest';
import { MelodyNote, isSlideTarget, linkEdges, linkNotes, slidePath } from './melody';

const n = (id: string, pitch: string, step: number, lengthSteps: number): MelodyNote => ({ id, pitch, step, lengthSteps, velocity: 0.8 });

describe('LINK (arrow from one note to a later note)', () => {
  it('turns the second note into a glide and stretches the first note up to it', () => {
    const out = linkNotes([n('a', 'C4', 0, 2), n('b', 'G4', 6, 4)], 'a', 'b');
    expect(out.find(x => x.id === 'a')?.lengthSteps).toBe(6);
    expect(out.find(x => x.id === 'b')?.slide).toBe(true);
    expect(isSlideTarget(out, out[1])).toBe(true);
    expect(slidePath(out, out[0])?.path).toEqual([{ at: 4, cents: 0 }, { at: 7, cents: 700 }]);   // SMOOTH: bends in the end of the first note and one step into the second
  });
  it('does not change a note that already reaches the second one', () => {
    const out = linkNotes([n('a', 'C4', 0, 8), n('b', 'E4', 4, 2)], 'a', 'b');
    expect(out.find(x => x.id === 'a')?.lengthSteps).toBe(8);
  });
  it('refuses a link backwards, to itself or to a missing note', () => {
    const base = [n('a', 'C4', 4, 2), n('b', 'G4', 0, 2)];
    expect(linkNotes(base, 'a', 'b')).toBe(base);
    expect(linkNotes(base, 'a', 'a')).toBe(base);
    expect(linkNotes(base, 'a', 'zz')).toBe(base);
  });
  it('gives one arrow per link and follows a chain', () => {
    let notes = [n('a', 'C4', 0, 2), n('b', 'E4', 4, 2), n('c', 'G4', 8, 2)];
    notes = linkNotes(notes, 'a', 'b'); notes = linkNotes(notes, 'b', 'c');
    expect(linkEdges(notes)).toEqual([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }]);
    expect(linkEdges([n('a', 'C4', 0, 2)])).toEqual([]);
  });
  it('each style makes its own glide', () => {
    const base = [n('a', 'C4', 0, 8), n('b', 'G4', 8, 4)];
    const path = (mode: Parameters<typeof linkNotes>[3]) => { const out = linkNotes(base, 'a', 'b', mode); return slidePath(out, out[0])?.path; };
    expect(path('smooth')).toEqual([{ at: 6, cents: 0 }, { at: 9, cents: 700 }]);
    expect(path('long')).toEqual([{ at: 0, cents: 0 }, { at: 9, cents: 700 }]);
    expect(path('snap')).toEqual([{ at: 7.75, cents: 0 }, { at: 8.25, cents: 700 }]);
    expect(path('tie')?.[0]).toEqual({ at: 8, cents: 0 });
    expect(path('tie')?.[1].at).toBeCloseTo(8.01, 5);
    expect(path('late')).toEqual([{ at: 8, cents: 0 }, { at: 12, cents: 700 }]);
  });
  it('a glide never starts before the first note and never ends after the second one', () => {
    const out = linkNotes([n('a', 'C4', 0, 1), n('b', 'E4', 1, 1)], 'a', 'b', 'long');
    const p = slidePath(out, out[0])?.path ?? [];
    expect(p[0].at).toBeGreaterThanOrEqual(0); expect(p[1].at).toBeLessThanOrEqual(2);
  });
});
