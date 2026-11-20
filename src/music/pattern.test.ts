import { describe, expect, it } from 'vitest';
import { makePattern, toggleStep, clampBpm } from './pattern';
describe('drum pattern', () => {
  it('has 32 steps per instrument', () => { const p = makePattern(); Object.values(p).forEach(row => expect(row).toHaveLength(32)); });
  it('toggles only selected step immutably', () => { const p = makePattern(); const q = toggleStep(p, 'clap', 3); expect(q.clap[3]).toBe(true); expect(p.clap[3]).toBe(false); expect(q.kick).toEqual(p.kick); });
  it('rejects invalid steps', () => { const p = makePattern(); expect(toggleStep(p, 'kick', -1)).toBe(p); });
  it('clamps BPM', () => { expect(clampBpm(10)).toBe(60); expect(clampBpm(300)).toBe(200); expect(clampBpm(120)).toBe(120); });
});
describe('pattern extras', () => {
  it('default pattern: kick on beats, snare on 2 and 4', () => {
    const p = makePattern();
    expect(p.kick.flatMap((v, i) => v ? [i] : [])).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
    expect(p.snare.flatMap((v, i) => v ? [i] : [])).toEqual([4, 12, 20, 28]);
  });
  it('toggling twice restores the pattern', () => {
    const p = makePattern();
    expect(toggleStep(toggleStep(p, 'hat', 1), 'hat', 1)).toEqual(p);
  });
  it('rejects step >= 32 and non-integers', () => {
    const p = makePattern();
    expect(toggleStep(p, 'kick', 32)).toBe(p);
    expect(toggleStep(p, 'kick', 1.5)).toBe(p);
  });
  it('clampBpm handles NaN/Infinity', () => {
    expect(clampBpm(NaN)).toBe(120);
    expect(clampBpm(Infinity)).toBe(120);
  });
});
