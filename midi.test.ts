import { describe, expect, it } from 'vitest';
import { PPQ, barsOf, decodeMidi, drumsToGrid, encodeMidi, hasDrumNotes, notesToGrid, MAX_MIDI_FILE_BYTES } from './midiFile';
import { drumForNote, heldSteps, parseMidiMessage, quantizePosition } from './midiLive';
import { SAMPLE_PROJECTS, defaultProject } from './project';
import { toggleNote } from './melody';
import { notesFor } from './song';

const opts = (p = defaultProject()) => ({ bpm: p.bpm, patterns: p.patterns, playlist: p.playlist, tracks: p.tracks, mode: 'song' as const, pattern: 0, name: p.name });

describe('MIDI file round trip', () => {
  it('writes a valid header and reads back its own file', () => {
    const bytes = encodeMidi(opts());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    const r = decodeMidi(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.ppq).toBe(PPQ); expect(r.data.bpm).toBe(120); expect(r.data.tracks.length).toBeGreaterThan(0); }
  });
  it('notes keep pitch, start, length and loudness', () => {
    const p = defaultProject();
    p.patterns[0].notes = { synth: toggleNote([], 64, 5, 3, 0.5) };
    const r = decodeMidi(encodeMidi(opts(p)));
    if (!r.ok) throw new Error(r.error);
    const t = r.data.tracks.find(x => x.name === 'Synth')!;
    expect(t.notes).toHaveLength(1);
    expect(t.notes[0]).toMatchObject({ midi: 64, startTick: 5 * 120, durationTicks: 3 * 120, channel: 3 });
    expect(t.notes[0].velocity).toBeCloseTo(0.5, 1);
    const back = notesToGrid(t.notes, PPQ, 0);
    expect(back).toEqual(notesFor(p.patterns[0], 'synth'));
  });
  it('drums go to channel 10 as General MIDI notes and come back', () => {
    const p = defaultProject();
    const r = decodeMidi(encodeMidi({ ...opts(p), mode: 'pattern', pattern: 0 }));
    if (!r.ok) throw new Error(r.error);
    const d = r.data.tracks.find(x => x.name === 'Drums')!;
    expect(d.notes.every(n => n.channel === 9)).toBe(true);
    expect(hasDrumNotes(d.notes)).toBe(true);
    expect(drumsToGrid(d.notes, PPQ, 0)).toEqual(p.patterns[0].drums);
  });
  it('song mode places each playlist slot one bar (32 steps) later; empty slots stay empty', () => {
    const p = defaultProject(); p.playlist = [null, 0];
    const r = decodeMidi(encodeMidi(opts(p)));
    if (!r.ok) throw new Error(r.error);
    const all = r.data.tracks.flatMap(t => t.notes);
    expect(Math.min(...all.map(n => n.startTick))).toBeGreaterThanOrEqual(32 * 120);
    expect(barsOf(all, PPQ)).toBe(2);
  });
  it('every demo song exports and reads back', () => {
    ['Hip Hop Demo', 'Lo-Fi Chill', 'Trap 140', 'Full Song'].forEach(n => { const r = decodeMidi(encodeMidi(opts(SAMPLE_PROJECTS[n]()))); expect(r.ok, n).toBe(true); });
  });
});

describe('MIDI file reading is strict', () => {
  it('rejects things that are not MIDI', () => {
    expect(decodeMidi(new Uint8Array([1, 2, 3])).ok).toBe(false);
    expect(decodeMidi(new TextEncoder().encode('RIFF....WAVEfmt ......')).ok).toBe(false);
    expect(decodeMidi(new Uint8Array(MAX_MIDI_FILE_BYTES + 1)).ok).toBe(false);
  });
  it('rejects SMPTE timing and files without notes', () => {
    const smpte = Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 0xe7, 0x28]);
    expect(decodeMidi(smpte).ok).toBe(false);
    const empty = Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 4, 0, 0xff, 0x2f, 0]);
    expect(decodeMidi(empty).ok).toBe(false);
  });
  it('truncated or random bytes never throw', () => {
    const good = encodeMidi(opts());
    for (let cut = 1; cut < 200; cut += 7) expect(() => decodeMidi(good.slice(0, cut))).not.toThrow();
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 255;
    for (let i = 0; i < 50; i++) { const junk = Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, 1, 0xe0, ...Array.from({ length: 60 }, rnd)]); expect(() => decodeMidi(junk)).not.toThrow(); }
  });
  it('reads running status and note-on with velocity 0 as note-off', () => {
    // MThd fmt0, 1 track, ppq 480; events: note on C4 (v100), running-status note on E4, off via vel 0 on both
    const trk = [0, 0x90, 60, 100, 0, 64, 100, 0x60, 60, 0, 0, 64, 0, 0, 0xff, 0x2f, 0];
    const f = Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, trk.length, ...trk]);
    const r = decodeMidi(f);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.tracks[0].notes.map(n => [n.midi, n.startTick, n.durationTicks])).toEqual([[60, 0, 96], [64, 0, 96]]);
  });
});

describe('importing notes onto the grid', () => {
  const n = (midi: number, startTick: number, durationTicks: number) => ({ midi, startTick, durationTicks, velocity: 0.8, channel: 0 });
  it('snaps to 16ths, folds into range, drops notes outside the bar', () => {
    const g = notesToGrid([n(60, 118, 130), n(30, 240, 100), n(100, 480, 120), n(62, 32 * 120 + 5, 120)], PPQ, 0);
    expect(g.map(x => [x.pitch, x.step, x.lengthSteps])).toEqual([['C4', 1, 1], ['F#3', 2, 1], ['E5', 4, 1]]);
    expect(notesToGrid([n(62, 32 * 120 + 5, 120)], PPQ, 1)).toHaveLength(1);
  });
  it('works with files that use another resolution', () => {
    expect(notesToGrid([{ midi: 60, startTick: 24, durationTicks: 24, velocity: 1, channel: 0 }], 96, 0)[0]).toMatchObject({ step: 1, lengthSteps: 1 });
  });
});

describe('live MIDI input', () => {
  it('parses note on / off and treats velocity 0 as off', () => {
    expect(parseMidiMessage([0x90, 60, 127])).toEqual({ kind: 'on', channel: 0, note: 60, velocity: 1 });
    expect(parseMidiMessage([0x93, 60, 0])).toMatchObject({ kind: 'off', channel: 3 });
    expect(parseMidiMessage([0x80, 60, 64])).toMatchObject({ kind: 'off' });
    expect(parseMidiMessage([0xb0, 1, 5])).toEqual({ kind: 'other' });
    expect(parseMidiMessage([])).toEqual({ kind: 'other' });
  });
  it('maps drum pads', () => { expect(drumForNote(36)).toBe('kick'); expect(drumForNote(38)).toBe('snare'); expect(drumForNote(42)).toBe('hat'); expect(drumForNote(39)).toBe('clap'); expect(drumForNote(60)).toBeNull(); });
  it('quantizes to the nearest step and rolls into the next bar', () => {
    const f = (step: number, bar = 0, pattern: number | null = 0) => ({ bar, step, pattern, songStep: bar * 32 + step });
    expect(quantizePosition(f(5), 0.3, [0, 1], 'song', 0)).toEqual({ pattern: 0, step: 5 });
    expect(quantizePosition(f(5), 0.7, [0, 1], 'song', 0)).toEqual({ pattern: 0, step: 6 });
    expect(quantizePosition(f(31), 0.8, [0, 1], 'song', 0)).toEqual({ pattern: 1, step: 0 });
    expect(quantizePosition(f(31, 1, 1), 0.8, [0, 1], 'song', 0)).toEqual({ pattern: 0, step: 0 });
    expect(quantizePosition(f(31), 0.8, [0, 1], 'pattern', 0)).toEqual({ pattern: 0, step: 0 });
  });
  it('held length is at least one step', () => { expect(heldSteps(10, 120)).toBe(1); expect(heldSteps(500, 120)).toBe(4); });
});
