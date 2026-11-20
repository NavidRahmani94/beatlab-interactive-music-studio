import { describe, expect, it } from 'vitest';
import { clampOctave, keyToMidi, keyToPad, nextStep, octaveShift } from './keyboardPiano';
describe('keyboard piano', () => {
  it('A is C4 (60) and the keys climb like a piano', () => {
    expect(keyToMidi('a', 4)).toBe(60); expect(keyToMidi('w', 4)).toBe(61); expect(keyToMidi('j', 4)).toBe(71); expect(keyToMidi('k', 4)).toBe(72); expect(keyToMidi(';', 4)).toBe(76);
    expect(keyToMidi('A', 4)).toBe(60);
  });
  it('octave moves by 12 and stays in range', () => {
    expect(keyToMidi('a', 5)).toBe(72); expect(keyToMidi('a', 99)).toBe(clampOctave(99) * 12 + 12); expect(clampOctave(-3)).toBe(1);
  });
  it('other keys do nothing', () => { expect(keyToMidi('q', 4)).toBeNull(); expect(keyToMidi('Enter', 4)).toBeNull(); expect(keyToMidi('1', 4)).toBeNull(); });
  it('pads and octave keys', () => {
    expect(keyToPad('a')).toBe(36); expect(keyToPad('f')).toBe(39); expect(keyToPad('g')).toBeNull();
    expect(octaveShift('z')).toBe(-1); expect(octaveShift('x')).toBe(1); expect(octaveShift('a')).toBe(0);
  });
  it('the step cursor wraps', () => { expect(nextStep(31)).toBe(0); expect(nextStep(0, -1)).toBe(31); expect(nextStep(5, 2)).toBe(7); });
});
