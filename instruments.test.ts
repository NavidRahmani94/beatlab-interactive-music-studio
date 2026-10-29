import { describe, expect, it } from 'vitest';
import { DRUM_KIT_IDS, MELODY_INSTRUMENT_IDS, isDrumKit, isMelodyInstrument } from './instruments';

describe('instrument catalogue', () => {
  it('offers several melody instruments and drum kits', () => {
    expect(MELODY_INSTRUMENT_IDS.length).toBeGreaterThanOrEqual(6);
    expect(DRUM_KIT_IDS.length).toBeGreaterThanOrEqual(3);
  });
  it('type guards accept only known ids', () => {
    expect(isMelodyInstrument('bell')).toBe(true);
    expect(isMelodyInstrument('toString')).toBe(false);
    expect(isMelodyInstrument(5)).toBe(false);
    expect(isDrumKit('kit808')).toBe(true);
    expect(isDrumKit('constructor')).toBe(false);
  });
});
