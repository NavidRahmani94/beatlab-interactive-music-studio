import { describe, expect, it } from 'vitest';
import { encodeWav, peakOf } from './wav';
import { encodeMp3 } from './mp3';
import { encodeAudio, isExportFormat, EXPORT_FORMATS } from './exporter';
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
  it('120 BPM, 4 patterns of 32 steps = 16 s + 3 s tail + 50 ms lead-in', () => { expect(exportDurationSeconds(120, 4)).toBeCloseTo(19.05); });
  it('slower tempo is longer', () => { expect(exportDurationSeconds(60, 1)).toBeCloseTo(11.05); });
});

describe('24-bit WAV', () => {
  it('writes a valid 24-bit header and scales samples', () => {
    const buf = encodeWav([Float32Array.from([1, -1, 0.5]), Float32Array.from([0, 0.25, -0.5])], 44100, 24); const v = new DataView(buf);
    expect(v.getUint16(34, true)).toBe(24);
    expect(v.getUint16(32, true)).toBe(6);                  // block align
    expect(v.getUint32(28, true)).toBe(44100 * 6);          // byte rate
    expect(v.getUint32(40, true)).toBe(3 * 6);              // data bytes
    expect(buf.byteLength).toBe(44 + 18);
    const s24 = (o: number) => { const x = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16); return x & 0x800000 ? x - 0x1000000 : x; };
    expect(s24(44)).toBe(8388607);   // L0 = +1
    expect(s24(47)).toBe(0);         // R0
    expect(s24(50)).toBe(-8388608);  // L1 = -1
    expect(s24(56)).toBe(4194304);   // L2 = 0.5 (rounded)
  });
});

describe('MP3 encoder', () => {
  const sine = (n: number, hz = 440) => Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(2 * Math.PI * hz * i / 44100));
  it('makes MPEG audio frames of the expected size', () => {
    const n = 44100 * 2;
    const mp3 = new Uint8Array(encodeMp3([sine(n), sine(n, 660)], 44100, 192));
    // find the first frame header 0xFFEx (skip an optional ID3 tag)
    let i = 0; while (i < mp3.length - 1 && !(mp3[i] === 0xff && (mp3[i + 1] & 0xe0) === 0xe0)) i++;
    expect(i).toBeLessThan(2000);
    expect((mp3[i + 1] >> 3) & 3).toBe(3);   // MPEG-1
    expect((mp3[i + 1] >> 1) & 3).toBe(1);   // Layer III
    expect(mp3[i + 2] >> 4).toBe(0b1011);    // bitrate index 11 = 192 kbps
    const expected = 192000 / 8 * 2;         // bytes for 2 seconds at 192 kbps
    expect(mp3.length).toBeGreaterThan(expected * 0.9);
    expect(mp3.length).toBeLessThan(expected * 1.15);
  });
  it('320 kbps is bigger than 192 kbps', () => {
    const n = 44100;
    expect(encodeMp3([sine(n), sine(n)], 44100, 320).byteLength).toBeGreaterThan(encodeMp3([sine(n), sine(n)], 44100, 192).byteLength * 1.4);
  });
  it('rejects more than two channels', () => { expect(() => encodeMp3([sine(10), sine(10), sine(10)], 44100, 192)).toThrow(); });
  it('format table and encodeAudio agree', async () => {
    expect(isExportFormat('mp3_320')).toBe(true); expect(isExportFormat('flac')).toBe(false); expect(isExportFormat('toString')).toBe(false);
    for (const f of Object.keys(EXPORT_FORMATS) as (keyof typeof EXPORT_FORMATS)[]) {
      const blob = encodeAudio([sine(4410), sine(4410)], 44100, f);
      expect(blob.type).toBe(EXPORT_FORMATS[f].mime); expect(blob.size).toBeGreaterThan(1000);
    }
  });
});
