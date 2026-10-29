import { describe, expect, it } from 'vitest';
import { formatTime, positionSteps, rulerMarks, secondsToStep, stepSeconds, stepsToSeconds, tickEvery } from './timeline';

describe('timeline maths', () => {
  it('a step is a sixteenth note', () => { expect(stepSeconds(120)).toBeCloseTo(0.125); expect(stepsToSeconds(32, 120)).toBeCloseTo(4); expect(stepSeconds(96)).toBeCloseTo(0.15625); });
  it('seconds go back to the nearest step and stay in range', () => {
    expect(secondsToStep(4, 120, 64)).toBe(32); expect(secondsToStep(4.04, 120, 64)).toBe(32); expect(secondsToStep(-3, 120, 64)).toBe(0); expect(secondsToStep(999, 120, 64)).toBe(63);
    expect(secondsToStep(5, 120, 0)).toBe(0);
  });
  it('formats m:ss', () => { expect(formatTime(0)).toBe('0:00'); expect(formatTime(65.9)).toBe('1:05'); expect(formatTime(5.25, 1)).toBe('0:05.3'); expect(formatTime(-2)).toBe('0:00'); expect(formatTime(600)).toBe('10:00'); });
  it('ruler marks are round and not crowded', () => {
    expect(tickEvery(85, 1000)).toBe(5); expect(tickEvery(10, 1000)).toBe(1); expect(tickEvery(85, 200)).toBe(30);
    expect(rulerMarks(20, 5)).toEqual([0, 5, 10, 15, 20]); expect(rulerMarks(0, 5)).toEqual([0]);
  });
  it('the playhead moves smoothly between steps but never into the next', () => {
    expect(positionSteps(10, 0, 120)).toBe(10); expect(positionSteps(10, 62.5, 120)).toBeCloseTo(10.5); expect(positionSteps(10, 9999, 120)).toBeLessThan(11); expect(positionSteps(10, -5, 120)).toBe(10);
  });
});
