import { describe, expect, it } from 'vitest';
import { GROOVE_PRESETS, MAX_SWING_STEPS, clampGroove, defaultGroove, drumHits, isGrooveOn, rand, stepDrift, swingDelay, validateGroove } from './groove';
import { STEPS } from './pattern';
import { emptyDrumPattern } from './song';

const beat = () => { const d = emptyDrumPattern(); [0, 8, 16, 24].forEach(i => { d.kick[i] = true; }); [8, 24].forEach(i => { d.snare[i] = true; }); for (let i = 0; i < STEPS; i += 2) d.hat[i] = true; return d; };
const all = (g: ReturnType<typeof defaultGroove>, ticks: number, d = beat()) => { const out: { tick: number; step: number; h: ReturnType<typeof drumHits> }[] = []; for (let t = 0; t < ticks; t++) out.push({ tick: t, step: t % STEPS, h: drumHits(d, t % STEPS, t, g) }); return out; };

describe('groove: off means unchanged', () => {
  it('with everything at 0 the hits are exactly the pattern, full velocity, no delay', () => {
    all(defaultGroove(), 128).forEach(({ step, h }) => {
      const d = beat();
      expect(h.map(x => x.inst).sort()).toEqual((['kick', 'snare', 'hat', 'clap'] as const).filter(i => d[i][step]).sort());
      h.forEach(x => { expect(x.velocity).toBe(1); expect(x.delay).toBe(0); });
    });
    expect(isGrooveOn(defaultGroove())).toBe(false);
  });
  it('swingDelay only moves odd steps, by at most 0.4 of a step', () => {
    expect(swingDelay(0, 0.125, 1)).toBe(0); expect(swingDelay(2, 0.125, 1)).toBe(0);
    expect(swingDelay(1, 0.125, 0)).toBe(0);
    expect(swingDelay(1, 0.125, 1)).toBeCloseTo(0.125 * MAX_SWING_STEPS);
  });
});

describe('groove: repeatable', () => {
  it('the same tick always gives the same answer (live play and export match)', () => {
    const g = GROOVE_PRESETS['Live drummer'];
    expect(JSON.stringify(all(g, 256))).toBe(JSON.stringify(all(g, 256)));
    expect(rand(5, 9)).toBe(rand(5, 9));
  });
  it('random numbers are in [0,1) and not all equal', () => {
    const v = Array.from({ length: 200 }, (_, i) => rand(i, 3));
    v.forEach(x => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
    expect(new Set(v).size).toBeGreaterThan(150);
  });
});

describe('humanize, ghost notes, variation', () => {
  it('humanize delays hits slightly and softens them, never silent or early', () => {
    const g = { ...defaultGroove(), humanize: 1 };
    const hits = all(g, 128).flatMap(x => x.h);
    expect(hits.some(h => h.delay > 0)).toBe(true);
    hits.forEach(h => { expect(h.delay).toBeGreaterThanOrEqual(0); expect(h.delay).toBeLessThan(0.02); expect(h.velocity).toBeGreaterThanOrEqual(0.05); expect(h.velocity).toBeLessThanOrEqual(1); });
    const drift = stepDrift(3, g); expect(drift.delay).toBeGreaterThanOrEqual(0); expect(drift.gain).toBeLessThanOrEqual(1);
    expect(stepDrift(3, defaultGroove())).toEqual({ delay: 0, gain: 1 });
  });
  it('ghost notes are quiet snares next to the backbeat, never on top of a kick or snare', () => {
    const d = beat();
    const hits = all({ ...defaultGroove(), ghost: 1 }, 512).filter(x => x.h.some(h => h.inst === 'snare' && h.velocity < 0.4 && !d.snare[x.step]));
    expect(hits.length).toBeGreaterThan(5);
    hits.forEach(x => { expect([7, 9, 23, 25]).toContain(x.step); expect(d.kick[x.step]).toBe(false); });
  });
  it('a fill appears only in the last bar of a 4-bar phrase, in its last steps', () => {
    const d = beat();
    const extra = all({ ...defaultGroove(), fill: 1 }, 8 * STEPS, d).filter(x => x.h.some(h => h.inst === 'snare' && !d.snare[x.step]));
    expect(extra.length).toBeGreaterThan(0);
    extra.forEach(x => { expect(Math.floor(x.tick / STEPS) % 4).toBe(3); expect(x.step).toBeGreaterThanOrEqual(26); });
  });
});

describe('groove data', () => {
  it('clamps and validates', () => {
    expect(clampGroove({ swing: 5, humanize: -1, ghost: NaN, fill: 0.456 })).toEqual({ swing: 1, humanize: 0, ghost: 0, fill: 0.46 });
    expect(validateGroove({ swing: 0.5, humanize: 0, ghost: 0.2, fill: 1 }).ok).toBe(true);
    ['x', null, [], { swing: 2, humanize: 0, ghost: 0, fill: 0 }, { swing: 0 }, { swing: 'a', humanize: 0, ghost: 0, fill: 0 }].forEach(v => expect(validateGroove(v).ok, JSON.stringify(v)).toBe(false));
  });
  it('presets are valid', () => Object.values(GROOVE_PRESETS).forEach(g => expect(validateGroove(g).ok).toBe(true)));
});
