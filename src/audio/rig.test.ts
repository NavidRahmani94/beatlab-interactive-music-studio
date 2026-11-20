import { describe, expect, it } from 'vitest';

import { softClip } from './rig';
describe('safety soft clip', () => {
  it('leaves normal levels untouched and never reaches 1', () => {
    expect(softClip(0.5)).toBe(0.5); expect(softClip(-0.9)).toBe(-0.9);
    for (const x of [0.95, 1, 1.5, 3, 20]) { expect(softClip(x)).toBeLessThan(1); expect(softClip(x)).toBeGreaterThan(0.9); expect(softClip(-x)).toBe(-softClip(x)); }
    expect(softClip(1)).toBeGreaterThan(softClip(0.95));
  });
});
