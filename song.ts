import { DrumPattern, STEPS, makePattern } from './pattern';
import { MelodyNote } from './melody';

// A PATTERN is 32 steps (2 bars) of all four tracks. The PLAYLIST places patterns in slots, so a song can be any length.
export type PatternData = { name: string; drums: DrumPattern; notes: Record<string, MelodyNote[]> };
/** The notes of one track in a pattern (tracks added later simply start empty). */
export const notesFor = (p: PatternData, trackId: string): MelodyNote[] => p.notes[trackId] ?? [];
/** Notes are stored canonically: a track with no notes in a pattern simply has no entry. */
export const compactNotes = (notes: Record<string, MelodyNote[]>): Record<string, MelodyNote[]> =>
  Object.fromEntries(Object.entries(notes).filter(([, list]) => list.length > 0));
export const withNotes = (p: PatternData, trackId: string, notes: MelodyNote[]): PatternData => ({ ...p, notes: compactNotes({ ...p.notes, [trackId]: notes }) });
/** Forgets the notes of a deleted track in every pattern. */
export function dropTrackNotes(patterns: PatternData[], trackId: string): PatternData[] {
  return patterns.map(p => { if (!(trackId in p.notes)) return p; const { [trackId]: _gone, ...rest } = p.notes; return { ...p, notes: rest }; });
}
/** One slot per pattern-length (32 steps): the index of a pattern, or null for a silent slot. */
export type Playlist = (number | null)[];
export type PlayMode = 'pattern' | 'song';

export const MAX_PATTERNS = 16;
export const MAX_BARS = 64; // playlist slots (each slot = one 32-step pattern)
export const MIN_BARS = 1;
export const MAX_PATTERN_NAME = 24;

export function emptyDrumPattern(): DrumPattern {
  return { kick: Array(STEPS).fill(false), snare: Array(STEPS).fill(false), hat: Array(STEPS).fill(false), clap: Array(STEPS).fill(false) };
}
export function emptyPattern(name: string): PatternData { return { name, drums: emptyDrumPattern(), notes: {} }; }
export function defaultPatternData(name = 'Pattern 1', melody: MelodyNote[] = []): PatternData { return { name, drums: makePattern(), notes: compactNotes({ melody }) }; }

export function cleanPatternName(name: string, fallback: string): string {
  const t = name.replace(/\s+/g, ' ').trim().slice(0, MAX_PATTERN_NAME);
  return t || fallback;
}

/** Next free name like "Pattern 3". */
export function nextPatternName(patterns: PatternData[]): string {
  for (let i = patterns.length + 1; i < patterns.length + 100; i++) if (!patterns.some(p => p.name === `Pattern ${i}`)) return `Pattern ${i}`;
  return `Pattern ${patterns.length + 1}`;
}

const clonePattern = (p: PatternData, name: string): PatternData => JSON.parse(JSON.stringify({ ...p, name })) as PatternData;

export function addPattern(patterns: PatternData[]): PatternData[] {
  if (patterns.length >= MAX_PATTERNS) return patterns;
  return [...patterns, emptyPattern(nextPatternName(patterns))];
}

export function duplicatePattern(patterns: PatternData[], index: number): PatternData[] {
  if (patterns.length >= MAX_PATTERNS || index < 0 || index >= patterns.length) return patterns;
  return [...patterns, clonePattern(patterns[index], cleanPatternName(`${patterns[index].name} copy`, nextPatternName(patterns)))];
}

export function renamePattern(patterns: PatternData[], index: number, name: string): PatternData[] {
  if (index < 0 || index >= patterns.length) return patterns;
  return patterns.map((p, i) => i === index ? { ...p, name: cleanPatternName(name, p.name) } : p);
}

/** Removes a pattern (at least one must remain). Bars that used it become silent; later pattern numbers shift down. */
export function deletePattern(patterns: PatternData[], playlist: Playlist, index: number): { patterns: PatternData[]; playlist: Playlist } {
  if (patterns.length <= 1 || index < 0 || index >= patterns.length) return { patterns, playlist };
  return {
    patterns: patterns.filter((_, i) => i !== index),
    playlist: playlist.map(s => s === null ? null : s === index ? null : s > index ? s - 1 : s)
  };
}

export function setSlot(playlist: Playlist, bar: number, pattern: number | null): Playlist {
  if (!Number.isInteger(bar) || bar < 0 || bar >= playlist.length) return playlist;
  if (playlist[bar] === pattern) return playlist;
  return playlist.map((s, i) => i === bar ? pattern : s);
}

export function resizePlaylist(playlist: Playlist, bars: number): Playlist {
  const n = Math.max(MIN_BARS, Math.min(MAX_BARS, Math.round(bars) || MIN_BARS));
  if (n === playlist.length) return playlist;
  return n < playlist.length ? playlist.slice(0, n) : [...playlist, ...Array<number | null>(n - playlist.length).fill(null)];
}

/** Number of bars up to and including the last one that holds a pattern (at least 1). Used by the WAV export. */
export function usedBars(playlist: Playlist): number {
  for (let i = playlist.length - 1; i >= 0; i--) if (playlist[i] !== null) return i + 1;
  return 1;
}

export type Frame = { bar: number; step: number; pattern: number | null; songStep: number };

/**
 * Where playback is at a given 16th-note tick (counted from the start of playback).
 * PATTERN mode loops the chosen pattern; SONG mode walks the playlist bar by bar and loops at its end.
 */
export function frameAt(tick: number, playlist: Playlist, mode: PlayMode, current: number): Frame {
  const t = Math.max(0, Math.floor(tick));
  const step = t % STEPS;
  if (mode === 'pattern' || playlist.length === 0) return { bar: 0, step, pattern: current, songStep: step };
  const bar = Math.floor(t / STEPS) % playlist.length;
  return { bar, step, pattern: playlist[bar], songStep: bar * STEPS + step };
}
