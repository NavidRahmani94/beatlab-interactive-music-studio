import { describe, expect, it } from 'vitest';
import * as Tone from 'tone';
import { a4Hz, cleanTuning, clampCents, clampSemitones, defaultTuning, fmtA4, isDefaultTuning, styleForBpm, TEMPO_STYLES, tuningTotal, validateTuning } from './tuning';
import { defaultProject, parseProject, serializeProject } from './project';

describe('tuning', () => {
  it('is A = 440 Hz by default', () => { expect(a4Hz(defaultTuning())).toBeCloseTo(440, 6); expect(isDefaultTuning(defaultTuning())).toBe(true); expect(fmtA4(defaultTuning())).toBe('A = 440.0 Hz'); });
  it('12 semitones doubles the frequency, -32 cents is about 432 Hz', () => {
    expect(a4Hz({ semitones: 12, cents: 0 })).toBeCloseTo(880, 6);
    expect(a4Hz({ semitones: 0, cents: -32 })).toBeGreaterThan(431.8);
    expect(a4Hz({ semitones: 0, cents: -32 })).toBeLessThan(432.1);
    expect(tuningTotal({ semitones: 2, cents: 50 })).toBeCloseTo(2.5, 9);
  });
  it('clamps and cleans bad values', () => {
    expect(clampSemitones(99)).toBe(12); expect(clampSemitones(NaN)).toBe(0); expect(clampCents(-999)).toBe(-50);
    expect(cleanTuning({ semitones: 3.4, cents: Infinity })).toEqual({ semitones: 3, cents: 0 });
  });
  it('validates saved files', () => {
    expect(validateTuning({ semitones: 2, cents: -10 }).ok).toBe(true);
    expect(validateTuning({ semitones: 13, cents: 0 }).ok).toBe(false);
    expect(validateTuning({ semitones: 1.5, cents: 0 }).ok).toBe(false);
    expect(validateTuning(null).ok).toBe(false);
  });
  it('tempo styles are unique and in the slider range', () => {
    expect(new Set(TEMPO_STYLES.map(s => s.bpm)).size).toBe(TEMPO_STYLES.length);
    TEMPO_STYLES.forEach(s => { expect(s.bpm).toBeGreaterThanOrEqual(60); expect(s.bpm).toBeLessThanOrEqual(200); expect(styleForBpm(s.bpm)).toBe(s.id); });
    expect(styleForBpm(97)).toBe('custom');
  });
  it('Tone understands the "…hz" pitch strings the rig sends', () => {
    expect(Tone.Frequency('432.100hz').toFrequency()).toBeCloseTo(432.1, 3);
    expect(Tone.Frequency('A4').transpose(2.5).toFrequency()).toBeCloseTo(440 * Math.pow(2, 2.5 / 12), 3);
  });
  it('is saved in the project and old files load with no tuning', () => {
    const p = { ...defaultProject(), tuning: { semitones: -3, cents: 20 } };
    const back = parseProject(serializeProject(p));
    expect(back.ok && back.project.tuning).toEqual({ semitones: -3, cents: 20 });
    const old = JSON.parse(serializeProject(defaultProject())); delete old.tuning;
    const r = parseProject(JSON.stringify(old)); expect(r.ok && r.project.tuning).toEqual({ semitones: 0, cents: 0 });
    old.tuning = { semitones: 40, cents: 0 }; expect(parseProject(JSON.stringify(old)).ok).toBe(false);
  });
});
