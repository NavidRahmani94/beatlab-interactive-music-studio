// Playing and recording from a MIDI keyboard: pure helpers (the browser part lives in midiInput.ts).
import { STEPS, Instrument } from './pattern';
import { PlayMode, Playlist, Frame } from './song';

export type MidiMsg = { kind: 'on' | 'off'; channel: number; note: number; velocity: number } | { kind: 'other' };

/** Reads the 2–3 raw bytes of a MIDI message. Note-on with velocity 0 counts as note-off. */
export function parseMidiMessage(data: ArrayLike<number>): MidiMsg {
  if (data.length < 2) return { kind: 'other' };
  const status = data[0] & 0xf0; const channel = data[0] & 15;
  const note = data[1] & 127; const vel = (data[2] ?? 0) & 127;
  if (status === 0x90 && vel > 0) return { kind: 'on', channel, note, velocity: vel / 127 };
  if (status === 0x80 || status === 0x90) return { kind: 'off', channel, note, velocity: 0 };
  return { kind: 'other' };
}

/** The drum a pad / key plays (General MIDI drum notes, and the low white keys of a normal keyboard as a fallback). */
export function drumForNote(note: number): Instrument | null {
  if (note === 35 || note === 36) return 'kick';
  if (note === 37 || note === 38 || note === 40) return 'snare';
  if (note === 39 || note === 41 || note === 43) return 'clap';
  if (note === 42 || note === 44 || note === 46) return 'hat';
  return null;
}

/**
 * Where in the song a key press lands: the step the music is on plus how far into it we are (0 … 1 of a step), rounded to the nearest step.
 * Rounding up past the end of a pattern moves to the first step of the next bar.
 */
export function quantizePosition(frame: Frame, fraction: number, playlist: Playlist, mode: PlayMode, current: number): { pattern: number | null; step: number } {
  const n = frame.step + Math.max(0, Math.min(1, fraction));
  const step = Math.round(n);
  if (step < STEPS) return { pattern: frame.pattern, step };
  if (mode === 'pattern' || playlist.length === 0) return { pattern: current, step: 0 };
  return { pattern: playlist[(frame.bar + 1) % playlist.length], step: 0 };
}

/** Length (in steps) of a key that was held for `ms` milliseconds at this tempo; at least one step. */
export function heldSteps(ms: number, bpm: number): number {
  return Math.max(1, Math.round(ms / (60000 / bpm / 4)));
}
