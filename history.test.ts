import { describe, expect, it } from 'vitest';
import { MAX_HISTORY, commit, emptyHistory, redo, undo } from './history';
import { AUTOSAVE_KEY, AutosaveStore, clearAutosave, readAutosave, saveAutosave } from './autosave';

describe('undo / redo', () => {
  it('nothing to undo or redo at the start', () => {
    expect(undo(emptyHistory<number>(), 1)).toBeNull();
    expect(redo(emptyHistory<number>(), 1)).toBeNull();
  });
  it('undo goes back, redo goes forward again', () => {
    let h = commit(commit(emptyHistory<number>(), 1), 2);            // states 1 -> 2 -> 3 (present 3)
    const u1 = undo(h, 3)!; expect(u1.value).toBe(2); h = u1.history;
    const u2 = undo(h, 2)!; expect(u2.value).toBe(1); h = u2.history;
    expect(undo(h, 1)).toBeNull();
    const r1 = redo(h, 1)!; expect(r1.value).toBe(2); h = r1.history;
    const r2 = redo(h, 2)!; expect(r2.value).toBe(3);
    expect(redo(r2.history, 3)).toBeNull();
  });
  it('a new change clears redo', () => {
    let h = commit(emptyHistory<number>(), 1);
    h = undo(h, 2)!.history;
    expect(h.future).toEqual([2]);
    h = commit(h, 1);
    expect(h.future).toEqual([]);
  });
  it('keeps at most MAX_HISTORY steps', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < MAX_HISTORY + 20; i++) h = commit(h, i);
    expect(h.past).toHaveLength(MAX_HISTORY);
    expect(h.past[h.past.length - 1]).toBe(MAX_HISTORY + 19);
  });
});

const memory = (): AutosaveStore & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; } };
};

describe('autosave', () => {
  it('saves, reads and clears', () => {
    const s = memory();
    expect(readAutosave(s)).toBeNull();
    expect(saveAutosave('{"a":1}', 1234, s)).toBe(true);
    expect(readAutosave(s)).toEqual({ json: '{"a":1}', savedAt: 1234 });
    clearAutosave(s);
    expect(readAutosave(s)).toBeNull();
  });
  it('ignores damaged data', () => {
    const s = memory();
    ['not json', '5', 'null', '{"json":1,"savedAt":"x"}', '{"json":"x"}'].forEach(raw => { s.data[AUTOSAVE_KEY] = raw; expect(readAutosave(s), raw).toBeNull(); });
  });
  it('never throws when storage is blocked or full', () => {
    const broken: AutosaveStore = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('no'); } };
    expect(saveAutosave('x', 1, broken)).toBe(false);
    expect(readAutosave(broken)).toBeNull();
    expect(() => clearAutosave(broken)).not.toThrow();
    expect(saveAutosave('x', 1, null)).toBe(false);
  });
});
