// Standard MIDI File (.mid) writer and reader. Pure data in, bytes out (and back), so it can be tested without a browser.
// One BeatLab step (a 16th note) is 120 ticks at 480 ticks per quarter note.
import { MAX_MIDI, MIN_MIDI, MelodyNote, midiToNote, noteToMidi, normalizeNotes } from './melody';
import { DrumPattern, INSTRUMENTS, Instrument, STEPS, makePattern } from './pattern';
import { PatternData, Playlist, notesFor } from './song';
import { TrackDef } from './tracks';

export const PPQ = 480;
export const TICKS_PER_STEP = PPQ / 4;
export const MAX_MIDI_FILE_BYTES = 1_000_000;
export const MAX_IMPORT_NOTES = 20000;
/** General MIDI drum notes used when writing, and the notes accepted when reading. */
export const GM_DRUM: Record<Instrument, number> = { kick: 36, snare: 38, hat: 42, clap: 39 };
const GM_READ: Record<number, Instrument> = { 35: 'kick', 36: 'kick', 37: 'snare', 38: 'snare', 40: 'snare', 39: 'clap', 42: 'hat', 44: 'hat', 46: 'hat' };

export type MidiNote = { midi: number; startTick: number; durationTicks: number; velocity: number; channel: number };
export type MidiTrackData = { name: string; notes: MidiNote[] };
export type MidiData = { ppq: number; bpm: number | null; tracks: MidiTrackData[] };

// ---------- writing ----------
const vlq = (n: number): number[] => {
  let v = Math.max(0, Math.floor(n));
  const out = [v & 0x7f];
  while ((v >>= 7) > 0) out.unshift((v & 0x7f) | 0x80);
  return out;
};
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number): number[] => [(n >> 8) & 255, n & 255];
const text = (s: string): number[] => Array.from(new TextEncoder().encode(s));

type Ev = { tick: number; order: number; bytes: number[] };
function trackChunk(events: Ev[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let last = 0;
  for (const e of sorted) { body.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
  const end = last;
  body.push(...vlq(0), 0xff, 0x2f, 0x00);
  void end;
  return [0x4d, 0x54, 0x72, 0x6b, ...u32(body.length), ...body];
}
const meta = (tick: number, type: number, data: number[]): Ev => ({ tick, order: 0, bytes: [0xff, type, ...vlq(data.length), ...data] });
const noteOn = (tick: number, ch: number, note: number, vel: number): Ev => ({ tick, order: 2, bytes: [0x90 | ch, note & 127, Math.max(1, Math.min(127, vel))] });
const noteOff = (tick: number, ch: number, note: number): Ev => ({ tick, order: 1, bytes: [0x80 | ch, note & 127, 0] });

export type MidiExportOptions = { bpm: number; patterns: PatternData[]; playlist: Playlist; tracks: TrackDef[]; mode: 'song' | 'pattern'; pattern: number; name?: string };

/** The song (or one pattern) as a format-1 MIDI file: a tempo track, the drums on channel 10, and one track per BeatLab track. */
export function encodeMidi(o: MidiExportOptions): Uint8Array {
  const slots: (PatternData | null)[] = o.mode === 'pattern' ? [o.patterns[o.pattern] ?? null] : o.playlist.map(i => (i === null ? null : o.patterns[i] ?? null));
  const tempo = Math.round(60_000_000 / Math.max(20, Math.min(300, o.bpm)));
  const chunks: number[][] = [];
  chunks.push(trackChunk([meta(0, 0x03, text(o.name ?? 'BeatLab')), meta(0, 0x51, [(tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255]), meta(0, 0x58, [4, 2, 24, 8])]));
  const drums: Ev[] = [meta(0, 0x03, text('Drums'))];
  slots.forEach((p, k) => {
    if (!p) return;
    INSTRUMENTS.forEach(inst => p.drums[inst].forEach((on, s) => {
      if (!on) return;
      const t = (k * STEPS + s) * TICKS_PER_STEP;
      drums.push(noteOn(t, 9, GM_DRUM[inst], 100), noteOff(t + TICKS_PER_STEP / 2, 9, GM_DRUM[inst]));
    }));
  });
  chunks.push(trackChunk(drums));
  o.tracks.forEach((def, i) => {
    const ch = i < 9 ? i : i + 1;                       // channel 10 (index 9) belongs to the drums
    const evs: Ev[] = [meta(0, 0x03, text(def.name))];
    slots.forEach((p, k) => {
      if (!p) return;
      notesFor(p, def.id).forEach(n => {
        const m = noteToMidi(n.pitch);
        if (m === null) return;
        const t = (k * STEPS + n.step) * TICKS_PER_STEP;
        evs.push(noteOn(t, ch, m, Math.round(n.velocity * 127)), noteOff(t + n.lengthSteps * TICKS_PER_STEP, ch, m));
      });
    });
    chunks.push(trackChunk(evs));
  });
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, ...u32(6), ...u16(1), ...u16(chunks.length), ...u16(PPQ), ...chunks.flat()]);
}

// ---------- reading ----------
export type MidiParse = { ok: true; data: MidiData } | { ok: false; error: string };

export function decodeMidi(bytes: Uint8Array): MidiParse {
  if (bytes.length > MAX_MIDI_FILE_BYTES) return { ok: false, error: 'That MIDI file is too large (max 1 MB).' };
  let pos = 0;
  const fail = (error: string): MidiParse => ({ ok: false, error });
  const need = (n: number) => pos + n <= bytes.length;
  const tag = (): string => { const s = String.fromCharCode(...bytes.slice(pos, pos + 4)); pos += 4; return s; };
  const r32 = () => { const v = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0; pos += 4; return v; };
  const r16 = () => { const v = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2; return v; };
  if (!need(14) || tag() !== 'MThd') return fail('This is not a MIDI file.');
  const hlen = r32(); const format = r16(); const ntrks = r16(); const division = r16();
  if (hlen < 6) return fail('The MIDI header is damaged.');
  pos += hlen - 6;
  if (format > 2) return fail('Unsupported MIDI file type.');
  if (division & 0x8000) return fail('MIDI files with SMPTE timing are not supported.');
  if (division < 24 || division > 4000) return fail('The MIDI timing resolution is not supported.');
  const out: MidiData = { ppq: division, bpm: null, tracks: [] };
  let total = 0;
  for (let t = 0; t < ntrks && need(8); t++) {
    const id = tag(); const len = r32();
    const end = Math.min(bytes.length, pos + len);
    if (id !== 'MTrk') { pos = end; continue; }
    const track: MidiTrackData = { name: '', notes: [] };
    const open = new Map<number, { start: number; vel: number }>();
    let tick = 0; let running = 0;
    const vlqRead = (): number => { let v = 0; for (let i = 0; i < 4 && pos < end; i++) { const b = bytes[pos++]; v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) break; } return v; };
    const close = (ch: number, note: number, at: number) => {
      const k = ch * 128 + note; const o = open.get(k);
      if (!o) return;
      open.delete(k);
      if (++total > MAX_IMPORT_NOTES) return;
      track.notes.push({ midi: note, startTick: o.start, durationTicks: Math.max(1, at - o.start), velocity: o.vel / 127, channel: ch });
    };
    while (pos < end) {
      tick += vlqRead();
      let status = bytes[pos];
      if (status === undefined) break;
      if (status < 0x80) status = running; else { pos++; if (status < 0xf0) running = status; }
      if (status === 0xff) {
        const type = bytes[pos++]; const l = vlqRead();
        if (type === 0x03 && !track.name) track.name = new TextDecoder().decode(bytes.slice(pos, pos + l)).slice(0, 40);
        if (type === 0x51 && l === 3 && out.bpm === null) out.bpm = Math.round(60_000_000 / ((bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2]));
        pos += l;
      } else if (status === 0xf0 || status === 0xf7) { pos += vlqRead(); }
      else {
        const kind = status & 0xf0; const ch = status & 15;
        const a = bytes[pos++];
        const b = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[pos++];
        if (kind === 0x90 && b > 0) { close(ch, a, tick); open.set(ch * 128 + a, { start: tick, vel: b }); }
        else if (kind === 0x80 || (kind === 0x90 && b === 0)) close(ch, a, tick);
      }
    }
    open.forEach((_, k) => close(Math.floor(k / 128), k % 128, tick));   // notes that never ended
    if (track.notes.length) out.tracks.push({ ...track, notes: track.notes.sort((x, y) => x.startTick - y.startTick || x.midi - y.midi) });
    pos = end;
  }
  if (total > MAX_IMPORT_NOTES) return fail(`That MIDI file has too many notes (max ${MAX_IMPORT_NOTES}).`);
  if (out.tracks.length === 0) return fail('That MIDI file has no notes.');
  return { ok: true, data: out };
}

// ---------- from MIDI notes to BeatLab patterns ----------
const stepTicks = (ppq: number) => ppq / 4;
/** How many 32-step patterns the notes of this source cover. */
export function barsOf(notes: MidiNote[], ppq: number): number {
  const last = notes.reduce((m, n) => Math.max(m, n.startTick), 0);
  return Math.max(1, Math.floor(last / stepTicks(ppq) / STEPS) + 1);
}
export const foldToRange = (m: number): number => { let x = m; while (x > MAX_MIDI) x -= 12; while (x < MIN_MIDI) x += 12; return x; };

/** Notes that start inside bar `bar` (0-based, 32 steps each), snapped to the 16th-note grid, folded into the piano roll's range. */
export function notesToGrid(notes: MidiNote[], ppq: number, bar: number): MelodyNote[] {
  const st = stepTicks(ppq); const out: MelodyNote[] = [];
  for (const n of notes) {
    const step = Math.round(n.startTick / st) - bar * STEPS;
    if (step < 0 || step >= STEPS) continue;
    const m = foldToRange(n.midi);
    out.push({ id: `n${m}_${step}`, pitch: midiToNote(m), step, lengthSteps: Math.max(1, Math.min(STEPS - step, Math.round(n.durationTicks / st))), velocity: Math.max(0.05, Math.min(1, n.velocity)) });
  }
  return normalizeNotes(out);
}
/** General MIDI drum notes (kick 35/36, snare 37/38/40, clap 39, hi-hat 42/44/46) as a drum pattern. */
export function drumsToGrid(notes: MidiNote[], ppq: number, bar: number): DrumPattern {
  const d = makePattern(); const st = stepTicks(ppq);
  for (const n of notes) {
    const inst = GM_READ[n.midi]; if (!inst) continue;
    const step = Math.round(n.startTick / st) - bar * STEPS;
    if (step >= 0 && step < STEPS) d[inst][step] = true;
  }
  return d;
}
/** The notes of one source chosen in the import dialog: a MIDI track, or all drum notes ('drums'). */
export function sourceNotes(data: MidiData, source: number | 'drums'): MidiNote[] {
  if (source !== 'drums') return data.tracks[source]?.notes ?? [];
  const all = data.tracks.flatMap(t => t.notes);
  const ch10 = all.filter(n => n.channel === 9);
  return ch10.length ? ch10 : all.filter(n => GM_READ[n.midi] !== undefined);
}
export const hasDrumNotes = (notes: MidiNote[]): boolean => notes.some(n => GM_READ[n.midi] !== undefined);
