import { describe, it, expect } from 'vitest';
import { LEGACY_PATCHES } from './legacyPatches';
import { WORKLET_TRIM_DB, workletTrim } from './workletTrim';
import { FACTORY_SOUNDS, validatePatch } from './synth';
import { MELODY_INSTRUMENT_IDS } from './instruments';
import workletSource from './voiceWorklet.js?raw';

describe('sound engine 2 data', () => {
  it('every basic instrument has a valid patch', () => {
    MELODY_INSTRUMENT_IDS.filter(id => !(id in FACTORY_SOUNDS)).forEach(id => { expect(LEGACY_PATCHES[id], id).toBeDefined(); expect(validatePatch(LEGACY_PATCHES[id]).ok, id).toBe(true); });
  });
  it('loudness trims only name known sounds and stay within +-12 dB', () => {
    for (const [id, db] of Object.entries(WORKLET_TRIM_DB)) { expect(id in FACTORY_SOUNDS || id in LEGACY_PATCHES, id).toBe(true); expect(Math.abs(db)).toBeLessThanOrEqual(12); }
    expect(workletTrim('does-not-exist')).toBe(0);
  });
  it('the worklet file registers its processor and has no syntax problems', () => {
    const src = workletSource;
    expect(src).toContain("registerProcessor('beatlab-synth'");
    expect(() => new Function('AudioWorkletProcessor', 'registerProcessor', 'currentTime', 'sampleRate', src)(class { port = {}; }, () => {}, 0, 44100)).not.toThrow();
  });
});
