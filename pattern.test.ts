import { describe, expect, it } from 'vitest';
import { makePattern, toggleStep, clampBpm } from '../src/audio/pattern';
describe('drum pattern', () => {
  it('has 16 steps per instrument', () => { const p = makePattern(); Object.values(p).forEach(row => expect(row).toHaveLength(16)); });
  it('toggles only selected step immutably', () => { const p = makePattern(); const q = toggleStep(p, 'clap', 3); expect(q.clap[3]).toBe(true); expect(p.clap[3]).toBe(false); expect(q.kick).toEqual(p.kick); });
  it('rejects invalid steps', () => { const p = makePattern(); expect(toggleStep(p, 'kick', -1)).toBe(p); });
  it('clamps BPM', () => { expect(clampBpm(10)).toBe(60); expect(clampBpm(300)).toBe(200); expect(clampBpm(120)).toBe(120); });
});
