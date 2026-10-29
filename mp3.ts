import { Mp3Encoder } from '@breezystack/lamejs';

/** Encodes float samples (-1..1) as an MP3 (CBR). Works in the browser, no server. */
export function encodeMp3(channels: Float32Array[], sampleRate: number, kbps: number): ArrayBuffer {
  if (channels.length < 1 || channels.length > 2) throw new Error('MP3 export supports mono or stereo only.');
  const frames = channels[0].length;
  const toInt16 = (src: Float32Array): Int16Array => {
    const out = new Int16Array(src.length);
    for (let i = 0; i < src.length; i++) { const s = Math.max(-1, Math.min(1, src[i])); out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff); }
    return out;
  };
  const left = toInt16(channels[0]);
  const right = channels.length === 2 ? toInt16(channels[1]) : undefined;
  const encoder = new Mp3Encoder(channels.length, sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  const BLOCK = 1152 * 8;
  for (let i = 0; i < frames; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK);
    const part = right ? encoder.encodeBuffer(l, right.subarray(i, i + BLOCK)) : encoder.encodeBuffer(l);
    if (part.length) chunks.push(new Uint8Array(part));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}
