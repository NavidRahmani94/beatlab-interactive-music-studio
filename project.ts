import { DrumPattern, INSTRUMENTS, LEGACY_STEPS, STEPS } from './pattern';
import { MAX_MIDI, MIN_MIDI, MelodyNote, SCALES, ScaleName, makePreset, makeTrackPreset, noteToMidi } from './melody';
import { CHANNEL_NAMES, Channels, MAX_FEEDBACK, MasterSettings, VOLUME_MAX_DB, VOLUME_MIN_DB, EQ_MAX_DB, EQ_MIN_DB, defaultChannel, defaultChannels, defaultMaster, effectiveMuted, isDelayDivision, isReverbSize } from './mixer';
import { DrumKitId, MELODIC_TRACKS, MelodicTrack, MelodyInstrumentId, TRACK_DEFAULT_INSTRUMENT, isDrumKit, isMelodyInstrument } from './instruments';
import { ArpSettings, defaultArp, isArpMode, isArpOctaves, isArpRate } from './arp';
import { MAX_BARS, MAX_PATTERNS, PatternData, Playlist, defaultPatternData, emptyDrumPattern, emptyPattern } from './song';
import { toggleNote } from './melody';

export const SCHEMA_VERSION = 3;
export const MAX_FILE_BYTES = 1_000_000;
export const MAX_NOTES = 256; // per track, per pattern

export type TrackInstruments = Record<MelodicTrack, MelodyInstrumentId>;

export type BeatLabProject = {
  schemaVersion: 3;
  name: string;
  bpm: number;
  patterns: PatternData[];
  playlist: Playlist;
  tracks: TrackInstruments;
  arp: ArpSettings;
  drumKit: DrumKitId;
  melodyView: { key: number; scale: ScaleName };
  channels: Channels;
  master: MasterSettings;
};

export type ParseResult = { ok: true; project: BeatLabProject } | { ok: false; error: string };

export const emptyDrums = emptyDrumPattern;

export function defaultTracks(): TrackInstruments {
  return { melody: TRACK_DEFAULT_INSTRUMENT.melody, ambient: TRACK_DEFAULT_INSTRUMENT.ambient, arp: TRACK_DEFAULT_INSTRUMENT.arp };
}

export function defaultProject(): BeatLabProject {
  return {
    schemaVersion: 3, name: 'Untitled', bpm: 120,
    patterns: [defaultPatternData('Pattern 1', makePreset('happy', 0).notes)], playlist: [0],
    tracks: defaultTracks(), arp: defaultArp(), drumKit: 'classic', melodyView: { key: 0, scale: 'majorPent' },
    channels: defaultChannels(), master: defaultMaster()
  };
}

const on = (steps: number[]): boolean[] => Array.from({ length: STEPS }, (_, i) => steps.includes(i));
const rep16 = (steps: number[]): number[] => [...steps, ...steps.map(x => x + LEGACY_STEPS)];
/** Drums written for 16 steps, played twice in the 32-step pattern. */
const drumsOf = (kick: number[], snare: number[], hat: number[], clap: number[]): DrumPattern => ({ kick: on(rep16(kick)), snare: on(rep16(snare)), hat: on(rep16(hat)), clap: on(rep16(clap)) });
/** Drums written for all 32 steps. */
const drums32 = (kick: number[], snare: number[], hat: number[], clap: number[]): DrumPattern => ({ kick: on(kick), snare: on(snare), hat: on(hat), clap: on(clap) });
/** [midi, step, length, velocity] list -> notes */
const notesOf = (list: [number, number, number, number][]): MelodyNote[] => list.reduce<MelodyNote[]>((acc, [m, st, len, v]) => toggleNote(acc, m, st, len, v), []);
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];

function single(name: string, p: PatternData, extra: Partial<BeatLabProject>): BeatLabProject {
  return { ...defaultProject(), name, patterns: [p], playlist: [0], ...extra };
}

export const SAMPLE_PROJECTS: Record<string, () => BeatLabProject> = {
  'Basic House Beat': () => single('Basic House Beat', { ...emptyPattern('Pattern 1'), drums: drumsOf([0, 4, 8, 12], [], [2, 6, 10, 14], [4, 12]) }, { bpm: 124 }),
  'Simple Melody': () => {
    const preset = makePreset('chill', 9);
    return single('Simple Melody', { ...emptyPattern('Pattern 1'), drums: drumsOf([0, 8], [12], EIGHTHS, []), melody: preset.notes },
      { bpm: 100, tracks: { ...defaultTracks(), melody: preset.instrument }, melodyView: { key: 9, scale: preset.scale } });
  },
  'Epic Night': () => {
    const preset = makePreset('epic', 9);
    return single('Epic Night', { ...emptyPattern('Pattern 1'), drums: drumsOf([0, 4, 8, 12], [4, 12], EIGHTHS, [4, 12]), melody: preset.notes },
      { bpm: 128, drumKit: 'tight', tracks: { ...defaultTracks(), melody: preset.instrument }, melodyView: { key: 9, scale: preset.scale }, master: { ...defaultMaster(), reverbMix: 0.2 } });
  },
  'Dreamy 808': () => {
    const preset = makePreset('dreamy', 2);
    return single('Dreamy 808', { ...emptyPattern('Pattern 1'), drums: drumsOf([0, 7, 10], [4, 12], EIGHTHS, [12]), melody: preset.notes },
      { bpm: 84, drumKit: 'kit808', tracks: { ...defaultTracks(), melody: preset.instrument }, melodyView: { key: 2, scale: preset.scale }, master: { ...defaultMaster(), reverbMix: 0.3, reverbSize: 'cathedral' } });
  },
  // Four tracks + three patterns placed on an 8-bar playlist.
  'Full Song': () => {
    const key = 9; // A minor
    const pad = makeTrackPreset('ambientAbyss', key);
    const shimmer = makeTrackPreset('ambientShimmer', key);
    const arpChord = makeTrackPreset('arpMinor', key);
    const arpTwo = makeTrackPreset('arpChanges', key);
    const tune = makePreset('sad', key);
    const intro: PatternData = { ...emptyPattern('Intro'), ambient: pad.notes, arp: arpChord.notes };
    const groove: PatternData = { name: 'Groove', drums: drumsOf([0, 4, 8, 12], [4, 12], EIGHTHS, [12]), melody: tune.notes, ambient: pad.notes, arp: arpTwo.notes };
    const breakdown: PatternData = { ...emptyPattern('Breakdown'), ambient: shimmer.notes, melody: tune.notes };
    return {
      ...defaultProject(), name: 'Full Song', bpm: 96, patterns: [intro, groove, breakdown], playlist: [0, 0, 1, 1, 1, 1, 2, 2],
      tracks: { melody: 'electricPiano', ambient: pad.instrument, arp: arpChord.instrument }, melodyView: { key, scale: 'minor' },
      master: { ...defaultMaster(), reverbMix: 0.18, compAmount: 0.3 }
    };
  }
};

/**
 * "Hip Hop Demo" – boom-bap at 90 BPM in A minor, 16 playlist slots (about 85 s):
 * 808 drums, a bass line (MELODY track), Rhodes chords played as an arpeggio (ARPEGGIO track), strings pad (AMBIENT track).
 */
export function hipHopDemo(): BeatLabProject {
  const Am = [57, 60, 64], F = [53, 57, 60], C = [60, 64, 67], G = [55, 59, 62];
  const chords = (first: number[], second: number[], vel: number): [number, number, number, number][] =>
    [...first.map(m => [m, 0, 16, vel] as [number, number, number, number]), ...second.map(m => [m, 16, 16, vel] as [number, number, number, number])];
  const hats8 = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
  const intro: PatternData = {
    name: 'Intro',
    drums: drums32([0, 16], [], [0, 4, 8, 12, 16, 20, 24, 28], []),
    melody: [], ambient: notesOf(chords(Am, F, 0.4)), arp: notesOf(chords(Am, F, 0.6))
  };
  const verse: PatternData = {
    name: 'Verse',
    drums: drums32([0, 6, 10, 16, 22, 26], [4, 12, 20, 28], [...hats8, 15, 31], [12, 28]),
    melody: notesOf([[57, 0, 2, 0.95], [57, 3, 1, 0.7], [57, 6, 2, 0.85], [60, 10, 2, 0.8], [53, 16, 2, 0.95], [53, 19, 1, 0.7], [53, 22, 2, 0.85], [55, 26, 2, 0.8], [57, 30, 1, 0.7]]),
    ambient: notesOf(chords(Am, F, 0.4)), arp: notesOf(chords(Am, F, 0.6))
  };
  const hook: PatternData = {
    name: 'Hook',
    drums: drums32([0, 3, 10, 16, 19, 26, 28], [4, 12, 20, 28], [...hats8, 13, 15, 29, 31], [4, 12, 20, 28]),
    melody: notesOf([[60, 0, 2, 0.95], [60, 3, 1, 0.7], [55, 6, 2, 0.85], [52, 10, 2, 0.8], [55, 16, 2, 0.95], [55, 19, 1, 0.7], [50, 22, 2, 0.85], [59, 26, 2, 0.8], [55, 30, 1, 0.7]]),
    ambient: notesOf(chords(C, G, 0.5)), arp: notesOf(chords(C, G, 0.7))
  };
  const brk: PatternData = {
    name: 'Break',
    drums: drums32([0, 16], [28], [], [28]),
    melody: notesOf([[57, 0, 6, 0.9], [53, 16, 6, 0.9]]), ambient: notesOf(chords(Am, F, 0.45)), arp: []
  };
  const base = defaultProject();
  return {
    ...base, name: 'Hip Hop Demo', bpm: 90, drumKit: 'kit808',
    patterns: [intro, verse, hook, brk],
    playlist: [0, 0, 1, 1, 1, 1, 2, 2, 3, 1, 1, 2, 2, 2, 3, 0],
    tracks: { melody: 'bass', ambient: 'strings', arp: 'electricPiano' },
    arp: { mode: 'up', rate: '8n', octaves: 2, gate: 0.8 },
    melodyView: { key: 9, scale: 'minor' },
    channels: {
      ...base.channels,
      melody: { ...base.channels.melody, reverbSend: 0, delaySend: 0 },
      ambient: { ...base.channels.ambient, volumeDb: -4, reverbSend: 0.35 },
      arp: { ...base.channels.arp, volumeDb: -2, pan: 0.2, reverbSend: 0.2, delaySend: 0.25 }
    },
    master: { ...defaultMaster(), reverbMix: 0.14, delayFeedback: 0.3, eqLow: 2, compAmount: 0.35 }
  };
}

/** The song that is loaded when the app starts (NEW still gives a simple project). */
export function startupProject(): BeatLabProject { return hipHopDemo(); }

export const SAMPLE_PROJECTS_EXTRA: Record<string, () => BeatLabProject> = { 'Hip Hop Demo': hipHopDemo };

Object.assign(SAMPLE_PROJECTS, SAMPLE_PROJECTS_EXTRA);

export function serializeProject(project: BeatLabProject): string {
  return JSON.stringify(project, null, 2);
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
  return cleaned || 'beatlab_project';
}

export function patternHasSound(project: BeatLabProject, p: PatternData): boolean {
  const ch = project.channels;
  return INSTRUMENTS.some(i => !effectiveMuted(ch, i) && p.drums[i].some(Boolean)) ||
    MELODIC_TRACKS.some(t => !effectiveMuted(ch, t) && p[t].length > 0);
}

/** True when the song would make any sound (used to stop Play / Export from producing silence by accident). */
export function hasAudibleContent(project: BeatLabProject): boolean {
  return project.patterns.some(p => patternHasSound(project, p));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function validateNotes(raw: unknown, where: string): MelodyNote[] | string {
  if (!Array.isArray(raw)) return `${where} must be a list of notes.`;
  if (raw.length > MAX_NOTES) return `Too many notes in ${where} (max ${MAX_NOTES}).`;
  const notes: MelodyNote[] = [];
  for (let i = 0; i < raw.length; i++) {
    const n: unknown = raw[i];
    const w = `${where}[${i}]`;
    if (!isObj(n)) return `${w} is not a note.`;
    if (typeof n.id !== 'string') return `${w}.id must be text.`;
    const midi = typeof n.pitch === 'string' ? noteToMidi(n.pitch) : null;
    if (midi === null || midi < MIN_MIDI || midi > MAX_MIDI) return `${w}.pitch must be a note between C3 and C6.`;
    if (!isNum(n.step) || !Number.isInteger(n.step) || n.step < 0 || n.step >= STEPS) return `${w}.step must be a whole number 0–${STEPS - 1}.`;
    if (!isNum(n.lengthSteps) || !Number.isInteger(n.lengthSteps) || n.lengthSteps < 1 || n.step + n.lengthSteps > STEPS) return `${w}.lengthSteps must be a whole number ≥ 1 that fits inside the bar.`;
    if (!isNum(n.velocity) || n.velocity < 0 || n.velocity > 1) return `${w}.velocity must be between 0 and 1.`;
    notes.push({ id: n.id, pitch: n.pitch as string, step: n.step, lengthSteps: n.lengthSteps, velocity: n.velocity });
  }
  return notes;
}

function validateDrums(raw: unknown, where: string): DrumPattern | string {
  if (!isObj(raw)) return `${where} is missing.`;
  const drums = {} as DrumPattern;
  for (const name of INSTRUMENTS) {
    const row = raw[name];
    if (!Array.isArray(row) || row.length !== STEPS) return `${where}.${name} must have exactly ${STEPS} steps.`;
    if (!row.every(v => typeof v === 'boolean')) return `${where}.${name} may only contain true/false.`;
    drums[name] = [...row] as boolean[];
  }
  return drums;
}

/** Files from before v0.8 have 16-step patterns: play the same content twice so they still sound the same in 32 steps. */
function widenV2(data: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(data.patterns)) return data;
  const widenNotes = (v: unknown): unknown => {
    if (!Array.isArray(v)) return v;
    const copies = v.map(n => (isObj(n) && typeof n.id === 'string' && isNum(n.step) ? { ...n, id: `${n.id}_b`, step: n.step + LEGACY_STEPS } : n));
    return [...v, ...copies];
  };
  const patterns = data.patterns.map((p: unknown) => {
    if (!isObj(p)) return p;
    let drums = p.drums;
    if (isObj(drums)) {
      const d: Record<string, unknown> = {};
      for (const k of Object.keys(drums)) { const row = drums[k]; d[k] = Array.isArray(row) && row.length === LEGACY_STEPS ? [...row, ...row] : row; }
      drums = d;
    }
    return { ...p, drums, melody: widenNotes(p.melody), ambient: widenNotes(p.ambient), arp: widenNotes(p.arp) };
  });
  return { ...data, patterns, schemaVersion: SCHEMA_VERSION };
}

/** Version-1 files (one bar, one melody) become a single pattern in the new structure. */
function upgradeV1(data: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 2, name: data.name, bpm: data.bpm,
    patterns: [{ name: 'Pattern 1', drums: data.drums, melody: data.melody, ambient: [], arp: [] }],
    playlist: [0],
    tracks: { melody: data.melodyInstrument === undefined ? 'softSynth' : data.melodyInstrument },
    drumKit: data.drumKit, melodyView: data.melodyView, channels: data.channels, master: data.master, legacy: true
  };
}

/** Validates unknown data. Never throws; returns a readable error instead. Old (version 1) files are upgraded. */
export function validateProject(input: unknown): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, error });
  if (!isObj(input)) return fail('The file is not a BeatLab project (expected a JSON object).');
  let data = input;
  if (input.schemaVersion === 1) {
    if (input.stepsPerBar !== 16) return fail('"stepsPerBar" must be 16.');
    if (input.bars !== 1) return fail('"bars" must be 1 in a version-1 file.');
    data = widenV2(upgradeV1(input));
  } else if (input.schemaVersion === 2) {
    data = widenV2(input);
  } else if (input.schemaVersion !== SCHEMA_VERSION) {
    return fail(`Unsupported schemaVersion (${String(input.schemaVersion)}); this app reads versions 1, 2 and ${SCHEMA_VERSION}.`);
  }
  const legacy = data.legacy === true;
  if (typeof data.name !== 'string' || data.name.length > 80) return fail('"name" must be text of at most 80 characters.');
  if (!isNum(data.bpm) || data.bpm < 60 || data.bpm > 200) return fail('"bpm" must be a number between 60 and 200.');

  // patterns
  if (!Array.isArray(data.patterns) || data.patterns.length < 1) return fail('"patterns" must be a list with at least one pattern.');
  if (data.patterns.length > MAX_PATTERNS) return fail(`Too many patterns (max ${MAX_PATTERNS}).`);
  const patterns: PatternData[] = [];
  for (let i = 0; i < data.patterns.length; i++) {
    const p: unknown = data.patterns[i];
    const where = `patterns[${i}]`;
    if (!isObj(p)) return fail(`${where} is not a pattern.`);
    if (typeof p.name !== 'string' || p.name.length > 60) return fail(`${where}.name must be text.`);
    const drums = validateDrums(p.drums, legacy ? 'drums' : `${where}.drums`);
    if (typeof drums === 'string') return fail(drums);
    const lists: Record<MelodicTrack, MelodyNote[]> = { melody: [], ambient: [], arp: [] };
    for (const t of MELODIC_TRACKS) {
      const label = legacy ? t : `${where}.${t}`;
      const notes = validateNotes(p[t], label);
      if (typeof notes === 'string') return fail(notes);
      lists[t] = notes;
    }
    patterns.push({ name: p.name, drums, ...lists });
  }

  // playlist
  if (!Array.isArray(data.playlist) || data.playlist.length < 1 || data.playlist.length > MAX_BARS) return fail(`"playlist" must have 1–${MAX_BARS} bars.`);
  const playlist: Playlist = [];
  for (let i = 0; i < data.playlist.length; i++) {
    const s: unknown = data.playlist[i];
    if (s === null) { playlist.push(null); continue; }
    if (!isNum(s) || !Number.isInteger(s) || s < 0 || s >= patterns.length) return fail(`playlist[${i}] must be empty or the number of an existing pattern.`);
    playlist.push(s);
  }

  // instruments
  const tracks = defaultTracks();
  if (data.tracks !== undefined) {
    if (!isObj(data.tracks)) return fail('"tracks" must be an object.');
    for (const t of MELODIC_TRACKS) {
      const v = data.tracks[t];
      if (v === undefined) continue;
      if (!isMelodyInstrument(v)) return fail(`tracks.${t} is not a known instrument.`);
      tracks[t] = v;
    }
  }

  let arp = defaultArp();
  if (data.arp !== undefined) {
    const a = data.arp;
    if (!isObj(a) || !isArpMode(a.mode) || !isArpRate(a.rate) || !isArpOctaves(a.octaves) || !isNum(a.gate) || a.gate < 0.2 || a.gate > 1) return fail('"arp" must have a valid mode, rate, octaves (1–3) and gate (0.2–1).');
    arp = { mode: a.mode, rate: a.rate, octaves: a.octaves, gate: a.gate };
  }

  let drumKit: DrumKitId = 'classic';
  if (data.drumKit !== undefined) {
    if (!isDrumKit(data.drumKit)) return fail('"drumKit" is not a known drum kit.');
    drumKit = data.drumKit;
  }

  let melodyView = { key: 0, scale: 'majorPent' as ScaleName };
  if (data.melodyView !== undefined) {
    const v = data.melodyView;
    if (!isObj(v) || !isNum(v.key) || !Number.isInteger(v.key) || v.key < 0 || v.key > 11 || typeof v.scale !== 'string' || !own(SCALES, v.scale)) {
      return fail('"melodyView" must contain a key (0–11) and a valid scale.');
    }
    melodyView = { key: v.key, scale: v.scale as ScaleName };
  }

  // mixer
  if (!isObj(data.channels)) return fail('"channels" is missing.');
  const channels = {} as Channels;
  for (const name of CHANNEL_NAMES) {
    const c = data.channels[name];
    if (c === undefined && (name === 'ambient' || name === 'arp')) { channels[name] = defaultChannel(name); continue; } // files from before these tracks existed
    if (!isObj(c)) return fail(`channels.${name} is missing.`);
    if (!isNum(c.volumeDb) || c.volumeDb < VOLUME_MIN_DB || c.volumeDb > VOLUME_MAX_DB) return fail(`channels.${name}.volumeDb must be between ${VOLUME_MIN_DB} and ${VOLUME_MAX_DB}.`);
    if (typeof c.muted !== 'boolean') return fail(`channels.${name}.muted must be true or false.`);
    if (!isNum(c.reverbSend) || c.reverbSend < 0 || c.reverbSend > 1) return fail(`channels.${name}.reverbSend must be between 0 and 1.`);
    if (!isNum(c.delaySend) || c.delaySend < 0 || c.delaySend > 1) return fail(`channels.${name}.delaySend must be between 0 and 1.`);
    if (c.pan !== undefined && (!isNum(c.pan) || c.pan < -1 || c.pan > 1)) return fail(`channels.${name}.pan must be between -1 and 1.`);
    if (c.solo !== undefined && typeof c.solo !== 'boolean') return fail(`channels.${name}.solo must be true or false.`);
    channels[name] = { volumeDb: c.volumeDb, muted: c.muted, solo: c.solo === true, pan: c.pan === undefined ? 0 : c.pan, reverbSend: c.reverbSend, delaySend: c.delaySend };
  }

  let master = defaultMaster();
  if (data.master !== undefined) {
    const m = data.master;
    if (!isObj(m)) return fail('"master" must be an object.');
    if (!isNum(m.volumeDb) || m.volumeDb < VOLUME_MIN_DB || m.volumeDb > VOLUME_MAX_DB) return fail(`master.volumeDb must be between ${VOLUME_MIN_DB} and ${VOLUME_MAX_DB}.`);
    if (!isNum(m.reverbMix) || m.reverbMix < 0 || m.reverbMix > 1) return fail('master.reverbMix must be between 0 and 1.');
    if (!isReverbSize(m.reverbSize)) return fail('master.reverbSize must be room, hall or cathedral.');
    if (!isDelayDivision(m.delayDivision)) return fail('master.delayDivision must be sixteenth, eighth, dottedEighth or quarter.');
    if (!isNum(m.delayFeedback) || m.delayFeedback < 0 || m.delayFeedback > MAX_FEEDBACK) return fail(`master.delayFeedback must be between 0 and ${MAX_FEEDBACK}.`);
    const eq = (k: 'eqLow' | 'eqMid' | 'eqHigh'): number | string => {
      const v = m[k];
      if (v === undefined) return 0;
      return isNum(v) && v >= EQ_MIN_DB && v <= EQ_MAX_DB ? v : `master.${k} must be between ${EQ_MIN_DB} and ${EQ_MAX_DB}.`;
    };
    const lo = eq('eqLow'), mid = eq('eqMid'), hi = eq('eqHigh');
    for (const v of [lo, mid, hi]) if (typeof v === 'string') return fail(v);
    if (m.compAmount !== undefined && (!isNum(m.compAmount) || m.compAmount < 0 || m.compAmount > 1)) return fail('master.compAmount must be between 0 and 1.');
    master = {
      volumeDb: m.volumeDb, reverbMix: m.reverbMix, reverbSize: m.reverbSize, delayDivision: m.delayDivision, delayFeedback: m.delayFeedback,
      eqLow: lo as number, eqMid: mid as number, eqHigh: hi as number, compAmount: m.compAmount === undefined ? 0 : m.compAmount
    };
  }

  return { ok: true, project: { schemaVersion: 3, name: data.name, bpm: Math.round(data.bpm), patterns, playlist, tracks, arp, drumKit, melodyView, channels, master } };
}

export function parseProject(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'The file is too large to be a BeatLab project.' };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'The file is not valid JSON.' }; }
  return validateProject(data);
}
