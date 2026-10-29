import { describe, expect, it } from 'vitest';
import { MAX_BARS, MAX_PATTERNS, addPattern, cleanPatternName, defaultPatternData, deletePattern, duplicatePattern, emptyPattern, frameAt, nextPatternName, renamePattern, resizePlaylist, setSlot, usedBars } from './song';
import { toggleNote } from './melody';

describe('patterns', () => {
  it('addPattern appends a blank, uniquely named pattern and stops at the limit', () => {
    let p = [defaultPatternData()];
    p = addPattern(p);
    expect(p).toHaveLength(2);
    expect(p[1].name).toBe('Pattern 2');
    expect(p[1].notes).toEqual({});
    expect(p[1].drums.kick.some(Boolean)).toBe(false);
    while (p.length < MAX_PATTERNS) p = addPattern(p);
    expect(addPattern(p)).toBe(p);
    expect(new Set(p.map(x => x.name)).size).toBe(p.length);
  });
  it('duplicate makes an independent copy', () => {
    const a = [{ ...emptyPattern('A'), notes: { melody: toggleNote([], 60, 0, 4) } }];
    const b = duplicatePattern(a, 0);
    expect(b).toHaveLength(2);
    expect(b[1].name).toBe('A copy');
    expect(b[1].notes.melody).toEqual(a[0].notes.melody);
    expect(b[1].notes.melody).not.toBe(a[0].notes.melody);
    expect(b[1].drums).not.toBe(a[0].drums);
    expect(duplicatePattern(a, 5)).toBe(a);
  });
  it('rename trims, limits length and keeps the old name when empty', () => {
    const a = [emptyPattern('A')];
    expect(renamePattern(a, 0, '  Verse   one ')[0].name).toBe('Verse one');
    expect(renamePattern(a, 0, '   ')[0].name).toBe('A');
    expect(cleanPatternName('x'.repeat(100), 'f')).toHaveLength(24);
    expect(renamePattern(a, 3, 'q')).toBe(a);
  });
  it('nextPatternName skips taken names', () => {
    expect(nextPatternName([emptyPattern('Pattern 2')])).toBe('Pattern 3');
  });
  it('delete removes the pattern, silences its bars, renumbers later ones, and keeps at least one', () => {
    const pats = [emptyPattern('A'), emptyPattern('B'), emptyPattern('C')];
    const r = deletePattern(pats, [0, 1, 2, null, 1], 1);
    expect(r.patterns.map(p => p.name)).toEqual(['A', 'C']);
    expect(r.playlist).toEqual([0, null, 1, null, null]);
    const single = [emptyPattern('A')];
    expect(deletePattern(single, [0], 0).patterns).toBe(single);
  });
});

describe('playlist', () => {
  it('setSlot paints one bar immutably and ignores bad bars', () => {
    const pl = [0, null, null];
    expect(setSlot(pl, 1, 0)).toEqual([0, 0, null]);
    expect(pl).toEqual([0, null, null]);
    expect(setSlot(pl, 1, null)).toBe(pl);
    expect(setSlot(pl, 9, 0)).toBe(pl);
    expect(setSlot(pl, -1, 0)).toBe(pl);
    expect(setSlot(pl, 0, null)).toEqual([null, null, null]);
  });
  it('resize grows with empty bars, shrinks, and clamps to 1..MAX_BARS', () => {
    expect(resizePlaylist([0], 3)).toEqual([0, null, null]);
    expect(resizePlaylist([0, 0, 0, 0], 2)).toEqual([0, 0]);
    expect(resizePlaylist([0], 0)).toHaveLength(1);
    expect(resizePlaylist([0], 999)).toHaveLength(MAX_BARS);
    expect(MAX_BARS).toBe(64);
    expect(resizePlaylist([0], NaN)).toHaveLength(1);
  });
  it('usedBars ignores trailing empty bars', () => {
    expect(usedBars([0, null, 0, null, null])).toBe(3);
    expect(usedBars([null, null])).toBe(1);
    expect(usedBars([0])).toBe(1);
  });
});

describe('frameAt (where playback is)', () => {
  const pl = [0, 1, null, 2];
  it('pattern mode loops one bar of the chosen pattern', () => {
    expect(frameAt(0, pl, 'pattern', 1)).toEqual({ bar: 0, step: 0, pattern: 1, songStep: 0 });
    expect(frameAt(37, pl, 'pattern', 1)).toMatchObject({ bar: 0, step: 5, pattern: 1 }); // 32 steps per pattern;
  });
  it('song mode walks the playlist and loops at the end', () => {
    expect(frameAt(0, pl, 'song', 0)).toMatchObject({ bar: 0, step: 0, pattern: 0 });
    expect(frameAt(32, pl, 'song', 0)).toMatchObject({ bar: 1, step: 0, pattern: 1 });
    expect(frameAt(65, pl, 'song', 0)).toMatchObject({ bar: 2, step: 1, pattern: null });
    expect(frameAt(127, pl, 'song', 0)).toMatchObject({ bar: 3, step: 31, pattern: 2, songStep: 127 });
    expect(frameAt(128, pl, 'song', 0)).toMatchObject({ bar: 0, step: 0, pattern: 0 });
  });
  it('handles odd input', () => {
    expect(frameAt(-5, pl, 'song', 0)).toMatchObject({ bar: 0, step: 0 });
    expect(frameAt(20, [], 'song', 3)).toMatchObject({ pattern: 3, step: 20 });
  });
});
