import { describe, expect, it } from 'vitest';
import { TAB_ORDER, TAB_LABELS, MELODIC_TRACKS, TRACK_DEFAULT_INSTRUMENT, TRACK_DEFAULT_LENGTH, isMelodicTrack, DRUM_KIT_IDS, MELODY_INSTRUMENT_IDS, isDrumKit, isMelodyInstrument } from './instruments';

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

describe('the four modes', () => {
  it('there are four tabs: ambient, drums, melody, arp', () => {
    expect([...TAB_ORDER].sort()).toEqual(['ambient', 'arp', 'drums', 'melody']);
    TAB_ORDER.forEach(t => expect(TAB_LABELS[t]).toBeTruthy());
  });
  it('each melodic track has a real default instrument and note length', () => {
    MELODIC_TRACKS.forEach(t => { expect(isMelodyInstrument(TRACK_DEFAULT_INSTRUMENT[t])).toBe(true); expect(TRACK_DEFAULT_LENGTH[t]).toBeGreaterThanOrEqual(1); });
    expect(isMelodicTrack('arp')).toBe(true);
    expect(isMelodicTrack('drums')).toBe(false);
    expect(isMelodyInstrument('strings') && isMelodyInstrument('drone') && isMelodyInstrument('airPad') && isMelodyInstrument('glassPad')).toBe(true);
  });
});
