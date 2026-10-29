import { describe, expect, it } from 'vitest';
import { encodeWav, peakOf } from './wav';
import { exportDurationSeconds, exportTailSeconds } from './exporter';
import { defaultMaster } from './mixer';

const text = (v: DataView, o: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(o + i)));

describe('WAV encoder', () => {
  it('writes a valid 16-bit stereo 44.1 kHz header', () => {
    const l = new Float32Array(441); const r = new Float32Array(441);
    const buf = encodeWav([l, r], 44100); const v = new DataView(buf);
    expect(text(v, 0, 4)).toBe('RIFF'); expect(text(v, 8, 4)).toBe('WAVE'); expect(text(v, 12, 4)).toBe('fmt '); expect(text(v, 36, 4)).toBe('data');
    expect(v.getUint16(20, true)).toBe(1);        // PCM
    expect(v.getUint16(22, true)).toBe(2);        // channels
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(44100 * 4);// byte rate
    expect(v.getUint16(32, true)).toBe(4);        // block align
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(441 * 4);  // data bytes
    expect(v.getUint32(4, true)).toBe(buf.byteLength - 8);
    expect(buf.byteLength).toBe(44 + 441 * 4);
  });
  it('interleaves channels and scales samples', () => {
    const buf = encodeWav([Float32Array.from([1, -1, 0.5]), Float32Array.from([0, 0.25, -0.5])], 8000); const v = new DataView(buf);
    expect(v.getInt16(44, true)).toBe(32767);   // L0
    expect(v.getInt16(46, true)).toBe(0);       // R0
    expect(v.getInt16(48, true)).toBe(-32768);  // L1
    expect(v.getInt16(50, true)).toBe(8192);    // R1
    expect(v.getInt16(52, true)).toBe(16384);   // L2
    expect(v.getInt16(54, true)).toBe(-16384);  // R2
  });
  it('clips instead of wrapping around', () => {
    const v = new DataView(encodeWav([Float32Array.from([3, -3])], 8000));
    expect(v.getInt16(44, true)).toBe(32767); expect(v.getInt16(46, true)).toBe(-32768);
  });
  it('rejects bad channel layouts', () => {
    expect(() => encodeWav([], 44100)).toThrow();
    expect(() => encodeWav([new Float32Array(1), new Float32Array(2)], 44100)).toThrow();
  });
  it('peakOf', () => { expect(peakOf([Float32Array.from([0.1, -0.7]), Float32Array.from([0.3])])).toBeCloseTo(0.7); });
});

describe('export length', () => {
  it('tail grows with a bigger master reverb and shrinks when reverb is off', () => {
    const m = defaultMaster();
    expect(exportTailSeconds({ ...m, reverbMix: 0 })).toBe(3);
    expect(exportTailSeconds({ ...m, reverbSize: 'room' })).toBe(3);   // 1.5 + 1.5 = 3
    expect(exportTailSeconds({ ...m, reverbSize: 'cathedral' })).toBeCloseTo(8.5);
  });
  it('120 BPM, 4 loops = 8 s + 3 s tail + 50 ms lead-in', () => { expect(exportDurationSeconds(120, 4)).toBeCloseTo(11.05); });
  it('slower tempo is longer', () => { expect(exportDurationSeconds(60, 1)).toBeCloseTo(7.05); });
});
