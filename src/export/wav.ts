/** Encodes float samples (-1..1) as a standard 16-bit (default) or 24-bit PCM stereo/mono WAV file. */
export function encodeWav(channels: Float32Array[], sampleRate: number, bits: 16 | 24 = 16): ArrayBuffer {
  if (channels.length < 1 || channels.length > 2) throw new Error('WAV export supports mono or stereo only.');
  const frames = channels[0].length;
  if (channels.some(c => c.length !== frames)) throw new Error('Channel lengths differ.');
  const numChannels = channels.length;
  const bytesPerSample = bits / 8;
  const dataSize = frames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);                                   // fmt chunk size
  view.setUint16(20, 1, true);                                    // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true);         // block align
  view.setUint16(34, bits, true);                                 // bits per sample
  writeText(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      if (bits === 16) {
        view.setInt16(offset, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      } else {
        const v = s < 0 ? Math.round(s * 0x800000) : Math.round(s * 0x7fffff);
        view.setUint8(offset, v & 0xff); view.setUint8(offset + 1, (v >> 8) & 0xff); view.setUint8(offset + 2, (v >> 16) & 0xff);
      }
      offset += bytesPerSample;
    }
  }
  return buffer;
}

export function peakOf(channels: Float32Array[]): number {
  let peak = 0;
  channels.forEach(c => { for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i])); });
  return peak;
}
