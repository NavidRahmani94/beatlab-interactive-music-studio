import { describe, expect, it } from 'vitest';
import { BeatPulse, attackRelease, bandsOf, dbToUnit, isVizMode } from './vizMath';

describe('visualiser maths', () => {
  it('maps dB to 0..1 and survives bad numbers', () => {
    expect(dbToUnit(-100)).toBe(0); expect(dbToUnit(-20)).toBe(1); expect(dbToUnit(NaN)).toBe(0); expect(dbToUnit(-Infinity)).toBe(0);
  });
  it('silence has no energy, no input is safe', () => {
    expect(bandsOf(new Float32Array(128).fill(-100)).level).toBe(0);
    expect(bandsOf(null).level).toBe(0); expect(bandsOf(new Float32Array(0)).level).toBe(0);
  });
  it('puts a low tone in the bass band and a high tone in the high band', () => {
    const lo = new Float32Array(128).fill(-100); lo[0] = -20; lo[1] = -20;      // ≈ 0–345 Hz
    const hi = new Float32Array(128).fill(-100); for (let i = 40; i < 60; i++) hi[i] = -20; // ≈ 7–10 kHz
    const a = bandsOf(lo), b = bandsOf(hi);
    expect(a.bass).toBeGreaterThan(a.high); expect(b.high).toBeGreaterThan(b.bass);
    expect(a.level).toBeGreaterThan(0); expect(a.level).toBeLessThanOrEqual(1);
  });
  it('beat pulse fires on a bass jump, then decays, and is not retriggered at once', () => {
    const bp = new BeatPulse();
    for (let i = 0; i < 30; i++) bp.update(0.1);
    expect(bp.update(0.9)).toBe(1);
    const after = bp.update(0.95); expect(after).toBeLessThan(1);
    for (let i = 0; i < 60; i++) bp.update(0.9);
    expect(bp.update(0.9)).toBe(0);
  });
  it('a steady loud sound does not keep firing', () => {
    const bp = new BeatPulse(); let fires = 0;
    for (let i = 0; i < 600; i++) { const v = bp.update(0.7); if (i >= 300 && v === 1) fires++; }
    expect(fires).toBe(0);
  });
  it('falls slowly, rises at once', () => {
    expect(attackRelease(0.5, 0.9)).toBe(0.9); expect(attackRelease(0.5, 0, 0.1)).toBeCloseTo(0.4);
  });
  it('knows its modes', () => { expect(isVizMode('rings')).toBe(true); expect(isVizMode('x')).toBe(false); });
});
