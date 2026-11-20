import { describe, expect, it } from 'vitest';
import { STRUCTURES, autoSections, ROLES, addSection, buildStructure, clampSections, clearSlot, copySlot, guessRoles, insertSlot, moveSlot, removeSection, removeSlot, sectionIndexAt, sectionStartingAt, updateSection } from './arrangement';
import { MAX_BARS } from './song';

describe('slots', () => {
  it('move swaps with an occupied slot and leaves an empty one behind', () => {
    expect(moveSlot([0, 1, null], 0, 1)).toEqual([1, 0, null]);
    expect(moveSlot([0, 1, null], 0, 2)).toEqual([null, 1, 0]);
  });
  it('copy duplicates, clear empties, bad indexes change nothing', () => {
    const pl = [0, 1, null];
    expect(copySlot(pl, 1, 2)).toEqual([0, 1, 1]);
    expect(clearSlot(pl, 0)).toEqual([null, 1, null]);
    [moveSlot(pl, -1, 1), moveSlot(pl, 0, 9), moveSlot(pl, 1, 1), copySlot(pl, 5, 0), clearSlot(pl, 2), clearSlot(pl, 9)].forEach(r => expect(r).toBe(pl));
  });
  it('insert and remove shift the rest', () => {
    expect(insertSlot([0, 1], 1)).toEqual([0, null, 1]);
    expect(insertSlot([0, 1], 2)).toEqual([0, 1, null]);
    expect(removeSlot([0, 1, 2], 1)).toEqual([0, 2]);
    expect(removeSlot([0], 0)).toEqual([0]);
    const full = Array(MAX_BARS).fill(0); expect(insertSlot(full, 0)).toBe(full);
  });
});

describe('sections', () => {
  it('clamp to the playlist length', () => {
    expect(clampSections([{ name: 'A', start: 0, length: 4 }, { name: 'B', start: 6, length: 2 }, { name: 'C', start: 2, length: 9 }], 5)).toEqual([{ name: 'A', start: 0, length: 4 }, { name: 'C', start: 2, length: 3 }]);
  });
  it('add / update / remove keep the data valid', () => {
    let s = addSection([], 2, 99, '  Big   drop  ', 8);
    expect(s).toEqual([{ name: 'Big drop', start: 2, length: 6 }]);
    expect(addSection(s, 9, 1, 'x', 8)).toBe(s);
    s = updateSection(s, 0, { start: 7, length: 5 }, 8);
    expect(s[0]).toMatchObject({ start: 7, length: 1 });
    expect(removeSection(s, 0)).toEqual([]);
    let many = [] as ReturnType<typeof addSection>; for (let i = 0; i < 30; i++) many = addSection(many, 0, 1, 's', 8);
    expect(many).toHaveLength(16);
  });
  it('finds the section of a slot', () => {
    const s = [{ name: 'A', start: 0, length: 2 }, { name: 'B', start: 2, length: 2 }];
    expect(sectionStartingAt(s, 2)?.name).toBe('B'); expect(sectionStartingAt(s, 1)).toBeUndefined();
    expect(sectionIndexAt(s, 1)).toBe(0); expect(sectionIndexAt(s, 3)).toBe(1); expect(sectionIndexAt(s, 4)).toBe(-1);
  });
});

describe('automatic section names', () => {
  it('one section per run of the same pattern, empty slots are skipped', () => {
    expect(autoSections([{ name: 'Intro' }, { name: 'Verse' }], [0, 0, 1, 1, 1, null, 0])).toEqual([
      { name: 'Intro', start: 0, length: 2 }, { name: 'Verse', start: 2, length: 3 }, { name: 'Intro', start: 6, length: 1 }]);
    expect(autoSections([{ name: 'A' }], [null, null])).toEqual([]);
  });
});

describe('song structures', () => {
  it('every template fits the playlist and its sections tile it without gaps', () => {
    STRUCTURES.forEach(t => {
      const r = buildStructure(t.id, { intro: 0, verse: 1, chorus: 2, bridge: 3, outro: 0 })!;
      expect(r.playlist.length).toBeLessThanOrEqual(MAX_BARS);
      let at = 0; r.sections.forEach(s => { expect(s.start).toBe(at); at += s.length; });
      expect(at).toBe(r.playlist.length);
      expect(r.sections.length).toBeLessThanOrEqual(16);
    });
  });
  it('uses the chosen pattern for each role', () => {
    const r = buildStructure('short', { intro: 0, verse: 1, chorus: 2, bridge: null, outro: 3 })!;
    expect(r.playlist).toEqual([0, 1, 1, 2, 2, 3]);
    expect(buildStructure('nope', { intro: 0, verse: 0, chorus: 0, bridge: 0, outro: 0 })).toBeNull();
  });
  it('a role without a pattern leaves empty slots', () => {
    const r = buildStructure('hiphop', { intro: 0, verse: 1, chorus: 2, bridge: null, outro: 0 })!;
    expect(r.playlist.filter(x => x === null)).toHaveLength(1);
  });
  it('guesses roles from pattern names, otherwise spreads patterns', () => {
    const g = guessRoles([{ name: 'Intro' }, { name: 'Verse' }, { name: 'Hook' }, { name: 'Break' }]);
    expect(g).toMatchObject({ intro: 0, verse: 1, chorus: 2, bridge: 3 });
    const h = guessRoles([{ name: 'Pattern 1' }, { name: 'Pattern 2' }]);
    ROLES.forEach(r => { expect(h[r]).toBeGreaterThanOrEqual(0); expect(h[r]).toBeLessThan(2); });
    expect(guessRoles([]).intro).toBe(0);
  });
});
