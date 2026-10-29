import { describe, expect, it } from 'vitest';
import { DRUM_KIT_IDS, MELODY_INSTRUMENT_IDS, isDrumKit, isMelodyInstrument } from './instruments';
import { KIND_DEFAULT_INSTRUMENT, KIND_DEFAULT_LENGTH, TRACK_KIND_IDS } from './tracks';

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

describe('track kinds', () => {
  it('each kind has a real default instrument and note length', () => {
    TRACK_KIND_IDS.forEach(k => { expect(isMelodyInstrument(KIND_DEFAULT_INSTRUMENT[k])).toBe(true); expect(KIND_DEFAULT_LENGTH[k]).toBeGreaterThanOrEqual(1); });
    expect(isMelodyInstrument('strings') && isMelodyInstrument('drone') && isMelodyInstrument('airPad') && isMelodyInstrument('glassPad')).toBe(true);
  });
});
