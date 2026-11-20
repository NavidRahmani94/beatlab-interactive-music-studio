import { describe, expect, it } from 'vitest';
import { AUDIO_MODES, loadAudioMode, saveAudioMode, audioLatencyMs } from './audioMode';

describe('audio buffer mode', () => {
  it('is SMOOTH by default (also when there is no storage, like in this test)', () => { expect(loadAudioMode()).toBe('smooth'); });
  it('there are three modes: FAST, SMOOTH and SAFE', () => { expect(AUDIO_MODES).toEqual(['fast', 'smooth', 'safe']); });
  it('saving without storage does not crash', () => { expect(() => saveAudioMode('fast')).not.toThrow(); });
  it('the delay is null when there is no audio (no crash)', () => { expect(audioLatencyMs()).toBeNull(); });
});
