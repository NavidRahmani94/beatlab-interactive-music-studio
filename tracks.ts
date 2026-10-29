// The song's tracks. DRUMS is fixed (kick / snare / hi-hat / clap). Every other track is created by the user:
// pick a kind (melody, ambient, arpeggio, synth), give it any name, add or delete it freely. Each track has its own notes in every
// pattern, its own instrument, and its own mixer channel.
import { ArpSettings, defaultArp } from './arp';

export const TRACK_KINDS = {
  melody: { label: 'Melody', hint: 'the tune' },
  ambient: { label: 'Ambient', hint: 'long, slow atmosphere (pads, drones)' },
  arp: { label: 'Arpeggio', hint: 'a held chord is played note by note' },
  synth: { label: 'Synth', hint: 'notes played by your own Synth Lab sound' }
} as const;
export type TrackKind = keyof typeof TRACK_KINDS;
export const TRACK_KIND_IDS = Object.keys(TRACK_KINDS) as TrackKind[];
export const isTrackKind = (v: unknown): v is TrackKind => typeof v === 'string' && Object.prototype.hasOwnProperty.call(TRACK_KINDS, v);

export type TrackDef = { id: string; name: string; kind: TrackKind; instrument: string; arp: ArpSettings };

export const MAX_TRACKS = 8;
export const MAX_TRACK_NAME = 20;
export const TRACK_ID_PATTERN = /^[a-z0-9_-]{1,24}$/;
export const DRUM_IDS = ['kick', 'snare', 'hat', 'clap'] as const;
export const DRUMS_TAB = 'drums';   // the fixed drum tab (not a track id)
/** Words a track id may not be: the drum tab, the Synth Lab tab, the drum channels and names every JS object already has. */
export const RESERVED_IDS: readonly string[] = [...DRUM_IDS, 'drums', 'lab', '__proto__', 'constructor', 'prototype'];
export const isValidTrackId = (id: unknown): id is string => typeof id === 'string' && TRACK_ID_PATTERN.test(id) && !RESERVED_IDS.includes(id);

export const KIND_DEFAULT_INSTRUMENT: Record<TrackKind, string> = { melody: 'electricPiano', ambient: 'warmPad', arp: 'pluck', synth: 'sawLead' };
/** Default length (in steps) of a note added with a single click. */
export const KIND_DEFAULT_LENGTH: Record<TrackKind, number> = { melody: 1, ambient: 8, arp: 8, synth: 1 };
const ACCENTS = ['#7cf0c2', '#9db4ff', '#ffb86b', '#ff8fb1', '#c8a1ff', '#89d7ff', '#ffd36b', '#d9ff71'];
export const trackAccent = (index: number): string => ACCENTS[((index % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];

export function cleanTrackName(name: string, fallback: string): string {
  const t = name.replace(/\s+/g, ' ').trim().slice(0, MAX_TRACK_NAME);
  return t || fallback;
}

export function makeTrack(id: string, name: string, kind: TrackKind, instrument: string = KIND_DEFAULT_INSTRUMENT[kind], arp: ArpSettings = defaultArp()): TrackDef {
  return { id, name, kind, instrument, arp };
}

/** The tracks every new project starts with (all can be renamed or deleted; more can be added). */
export function defaultTrackDefs(): TrackDef[] {
  return [
    makeTrack('melody', 'Melody', 'melody'),
    makeTrack('ambient', 'Ambient', 'ambient'),
    makeTrack('arp', 'Arpeggio', 'arp'),
    makeTrack('synth', 'Synth', 'synth')
  ];
}

export function nextTrackId(tracks: TrackDef[]): string {
  let n = tracks.length + 1;
  while (tracks.some(t => t.id === `t${n}`)) n++;
  return `t${n}`;
}
/** "Melody", then "Melody 2", "Melody 3" ... (first name not used yet). */
export function nextTrackName(tracks: TrackDef[], kind: TrackKind): string {
  const base = TRACK_KINDS[kind].label;
  if (!tracks.some(t => t.name === base)) return base;
  for (let i = 2; i < 100; i++) if (!tracks.some(t => t.name === `${base} ${i}`)) return `${base} ${i}`;
  return base;
}

export function addTrack(tracks: TrackDef[], kind: TrackKind, opts: { name?: string; instrument?: string } = {}): TrackDef[] {
  if (tracks.length >= MAX_TRACKS) return tracks;
  const name = cleanTrackName(opts.name ?? '', nextTrackName(tracks, kind));
  return [...tracks, makeTrack(nextTrackId(tracks), name, kind, opts.instrument)];
}
export const removeTrack = (tracks: TrackDef[], id: string): TrackDef[] => tracks.filter(t => t.id !== id);
export const updateTrack = (tracks: TrackDef[], id: string, patch: Partial<Omit<TrackDef, 'id'>>): TrackDef[] =>
  tracks.map(t => t.id === id ? { ...t, ...patch, name: patch.name === undefined ? t.name : cleanTrackName(patch.name, t.name) } : t);
/** While typing a name the text may be empty for a moment, so this keeps the raw text (cleaned only when saved to a file). */
export const renameTrackLive = (tracks: TrackDef[], id: string, name: string): TrackDef[] => tracks.map(t => t.id === id ? { ...t, name: name.slice(0, MAX_TRACK_NAME) } : t);
export const trackById = (tracks: TrackDef[], id: string): TrackDef | undefined => tracks.find(t => t.id === id);
