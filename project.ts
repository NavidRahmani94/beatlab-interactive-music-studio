import { DrumPattern, INSTRUMENTS, LEGACY_STEPS, STEPS } from './pattern';
import { MAX_MIDI, MIN_MIDI, MelodyNote, SCALES, ScaleName, makePreset, makeTrackPreset, noteToMidi } from './melody';
import { DRUM_CHANNELS, ChannelSettings, Channels, MAX_FEEDBACK, MasterSettings, VOLUME_MAX_DB, VOLUME_MIN_DB, EQ_MAX_DB, EQ_MIN_DB, defaultChannel, defaultChannels, defaultMaster, effectiveMuted, isDelayDivision, isReverbSize } from './mixer';
import { DrumKitId, isDrumKit, isMelodyInstrument } from './instruments';
import { KIND_DEFAULT_INSTRUMENT, MAX_TRACKS, MAX_TRACK_NAME, TrackDef, defaultTrackDefs, isTrackKind, isValidTrackId, makeTrack } from './tracks';
import { ArpSettings, defaultArp, isArpMode, isArpOctaves, isArpRate } from './arp';
import { MAX_BARS, MAX_PATTERNS, PatternData, Playlist, compactNotes, defaultPatternData, emptyDrumPattern } from './song';
import { toggleNote } from './melody';
import { SynthSlot, customId, isCustomRef, validateSynths } from './synth';

export const SCHEMA_VERSION = 5;
export const MAX_FILE_BYTES = 1_000_000;
export const MAX_NOTES = 256; // per track, per pattern

export type BeatLabProject = {
  schemaVersion: 5;
  name: string;
  bpm: number;
  patterns: PatternData[];
  playlist: Playlist;
  tracks: TrackDef[];    // the user's tracks (drums are fixed and not listed). Each has a name, kind, instrument and (for arpeggio) its settings
  synths: SynthSlot[];   // the user's own Synth Lab sounds; a track uses one as "synth:<id>"
  drumKit: DrumKitId;
  melodyView: { key: number; scale: ScaleName };
  channels: Channels;
  master: MasterSettings;
};

export type ParseResult = { ok: true; project: BeatLabProject } | { ok: false; error: string };

export const emptyDrums = emptyDrumPattern;

export function defaultProject(): BeatLabProject {
  return {
    schemaVersion: 5, name: 'Untitled', bpm: 120,
    patterns: [defaultPatternData('Pattern 1', makePreset('happy', 0).notes)], playlist: [0],
    tracks: defaultTrackDefs(), synths: [], drumKit: 'classic', melodyView: { key: 0, scale: 'majorPent' },
    channels: defaultChannels(defaultTrackDefs()), master: defaultMaster()
  };
}

const on = (steps: number[]): boolean[] => Array.from({ length: STEPS }, (_, i) => steps.includes(i));
const rep16 = (steps: number[]): number[] => [...steps, ...steps.map(x => x + LEGACY_STEPS)];
/** Drums written for 16 steps, played twice in the 32-step pattern. */
const drumsOf = (kick: number[], snare: number[], hat: number[], clap: number[]): DrumPattern => ({ kick: on(rep16(kick)), snare: on(rep16(snare)), hat: on(rep16(hat)), clap: on(rep16(clap)) });
/** Drums written for all 32 steps. */
const drums32 = (kick: number[], snare: number[], hat: number[], clap: number[]): DrumPattern => ({ kick: on(kick), snare: on(snare), hat: on(hat), clap: on(clap) });
/** The three classic tracks with chosen instruments (and arpeggio settings). */
const trackSet = (instr: { melody?: string; ambient?: string; arp?: string } = {}, arp: ArpSettings = defaultArp()): TrackDef[] => [
  makeTrack('melody', 'Melody', 'melody', instr.melody ?? KIND_DEFAULT_INSTRUMENT.melody),
  makeTrack('ambient', 'Ambient', 'ambient', instr.ambient ?? KIND_DEFAULT_INSTRUMENT.ambient),
  makeTrack('arp', 'Arpeggio', 'arp', instr.arp ?? KIND_DEFAULT_INSTRUMENT.arp, arp),
  makeTrack('synth', 'Synth', 'synth')
];
/** A pattern from drums and the three classic tracks' notes. */
const pat = (name: string, o: { drums?: DrumPattern; melody?: MelodyNote[]; ambient?: MelodyNote[]; arp?: MelodyNote[] } = {}): PatternData =>
  ({ name, drums: o.drums ?? emptyDrumPattern(), notes: compactNotes({ melody: o.melody ?? [], ambient: o.ambient ?? [], arp: o.arp ?? [] }) });
/** [midi, step, length, velocity] list -> notes */
const notesOf = (list: [number, number, number, number][]): MelodyNote[] => list.reduce<MelodyNote[]>((acc, [m, st, len, v]) => toggleNote(acc, m, st, len, v), []);
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];

function single(name: string, p: PatternData, extra: Partial<BeatLabProject>): BeatLabProject {
  return { ...defaultProject(), name, patterns: [p], playlist: [0], ...extra };
}

export const SAMPLE_PROJECTS: Record<string, () => BeatLabProject> = {
  'Basic House Beat': () => single('Basic House Beat', pat('Pattern 1', { drums: drumsOf([0, 4, 8, 12], [], [2, 6, 10, 14], [4, 12]) }), { bpm: 124 }),
  'Simple Melody': () => {
    const preset = makePreset('chill', 9);
    return single('Simple Melody', pat('Pattern 1', { drums: drumsOf([0, 8], [12], EIGHTHS, []), melody: preset.notes }),
      { bpm: 100, tracks: trackSet({ melody: preset.instrument }), melodyView: { key: 9, scale: preset.scale } });
  },
  'Epic Night': () => {
    const preset = makePreset('epic', 9);
    return single('Epic Night', pat('Pattern 1', { drums: drumsOf([0, 4, 8, 12], [4, 12], EIGHTHS, [4, 12]), melody: preset.notes }),
      { bpm: 128, drumKit: 'tight', tracks: trackSet({ melody: preset.instrument }), melodyView: { key: 9, scale: preset.scale }, master: { ...defaultMaster(), reverbMix: 0.2 } });
  },
  'Dreamy 808': () => {
    const preset = makePreset('dreamy', 2);
    return single('Dreamy 808', pat('Pattern 1', { drums: drumsOf([0, 7, 10], [4, 12], EIGHTHS, [12]), melody: preset.notes }),
      { bpm: 84, drumKit: 'kit808', tracks: trackSet({ melody: preset.instrument }), melodyView: { key: 2, scale: preset.scale }, master: { ...defaultMaster(), reverbMix: 0.3, reverbSize: 'cathedral' } });
  },
  // Four tracks + three patterns placed on an 8-bar playlist.
  'Full Song': () => {
    const key = 9; // A minor
    const pad = makeTrackPreset('ambientAbyss', key);
    const shimmer = makeTrackPreset('ambientShimmer', key);
    const arpChord = makeTrackPreset('arpMinor', key);
    const arpTwo = makeTrackPreset('arpChanges', key);
    const tune = makePreset('sad', key);
    const intro = pat('Intro', { ambient: pad.notes, arp: arpChord.notes });
    const groove = pat('Groove', { drums: drumsOf([0, 4, 8, 12], [4, 12], EIGHTHS, [12]), melody: tune.notes, ambient: pad.notes, arp: arpTwo.notes });
    const breakdown = pat('Breakdown', { ambient: shimmer.notes, melody: tune.notes });
    return {
      ...defaultProject(), name: 'Full Song', bpm: 96, patterns: [intro, groove, breakdown], playlist: [0, 0, 1, 1, 1, 1, 2, 2],
      tracks: trackSet({ melody: 'electricPiano', ambient: pad.instrument, arp: arpChord.instrument }), melodyView: { key, scale: 'minor' },
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
  const intro = pat('Intro', {
    drums: drums32([0, 16], [], [0, 4, 8, 12, 16, 20, 24, 28], []),
    ambient: notesOf(chords(Am, F, 0.4)), arp: notesOf(chords(Am, F, 0.6))
  });
  const verse = pat('Verse', {
    drums: drums32([0, 6, 10, 16, 22, 26], [4, 12, 20, 28], [...hats8, 15, 31], [12, 28]),
    melody: notesOf([[57, 0, 2, 0.95], [57, 3, 1, 0.7], [57, 6, 2, 0.85], [60, 10, 2, 0.8], [53, 16, 2, 0.95], [53, 19, 1, 0.7], [53, 22, 2, 0.85], [55, 26, 2, 0.8], [57, 30, 1, 0.7]]),
    ambient: notesOf(chords(Am, F, 0.4)), arp: notesOf(chords(Am, F, 0.6))
  });
  const hook = pat('Hook', {
    drums: drums32([0, 3, 10, 16, 19, 26, 28], [4, 12, 20, 28], [...hats8, 13, 15, 29, 31], [4, 12, 20, 28]),
    melody: notesOf([[60, 0, 2, 0.95], [60, 3, 1, 0.7], [55, 6, 2, 0.85], [52, 10, 2, 0.8], [55, 16, 2, 0.95], [55, 19, 1, 0.7], [50, 22, 2, 0.85], [59, 26, 2, 0.8], [55, 30, 1, 0.7]]),
    ambient: notesOf(chords(C, G, 0.5)), arp: notesOf(chords(C, G, 0.7))
  });
  const brk = pat('Break', {
    drums: drums32([0, 16], [28], [], [28]),
    melody: notesOf([[57, 0, 6, 0.9], [53, 16, 6, 0.9]]), ambient: notesOf(chords(Am, F, 0.45))
  });
  const base = defaultProject();
  return {
    ...base, name: 'Hip Hop Demo', bpm: 90, drumKit: 'kit808',
    patterns: [intro, verse, hook, brk],
    playlist: [0, 0, 1, 1, 1, 1, 2, 2, 3, 1, 1, 2, 2, 2, 3, 0],
    tracks: trackSet({ melody: 'bass', ambient: 'strings', arp: 'electricPiano' }, { mode: 'up', rate: '8n', octaves: 2, gate: 0.8 }),
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

// ---------- demo songs in other styles (each one uses the newer instruments and kits) ----------
type N4 = [number, number, number, number];
/** Two whole-bar chords: `a` on steps 0–15 and `b` on steps 16–31. */
const twoChords = (a: number[], b: number[], vel: number): N4[] => [...a.map(m => [m, 0, 16, vel] as N4), ...b.map(m => [m, 16, 16, vel] as N4)];
const mk = (name: string, drums: DrumPattern, melody: N4[], ambient: N4[], arp: N4[]): PatternData => pat(name, { drums, melody: notesOf(melody), ambient: notesOf(ambient), arp: notesOf(arp) });
const noDrums = (): DrumPattern => drums32([], [], [], []);
const demo = (name: string, bpm: number, kit: DrumKitId, patterns: PatternData[], playlist: Playlist, instr: { melody: string; ambient: string; arp: string }, arp: ArpSettings, key: number, scale: ScaleName, ch: Record<string, Partial<ChannelSettings>>, master: Partial<MasterSettings>): BeatLabProject => {
  const base = defaultProject();
  const channels: Channels = { ...base.channels };
  Object.keys(ch).forEach(k => { channels[k] = { ...base.channels[k], ...ch[k] }; });
  return { ...base, name, bpm, drumKit: kit, patterns, playlist, tracks: trackSet(instr, arp), melodyView: { key, scale }, channels, master: { ...defaultMaster(), ...master } };
};
const every = (step: number, from = 0, to = STEPS): number[] => { const r: number[] = []; for (let i = from; i < to; i += step) r.push(i); return r; };

/** Lo-fi chill: 78 BPM, D minor, soft dusty drums, vibraphone tune over a nylon-guitar arpeggio and a dark pad. */
export function lofiDemo(): BeatLabProject {
  const Dm7 = [50, 53, 57, 60], Bbmaj7 = [53, 57, 58, 62], Gm7 = [55, 58, 62, 65], Am7 = [55, 57, 60, 64];
  const chordsA = twoChords(Dm7, Bbmaj7, 0.5), chordsB = twoChords(Gm7, Am7, 0.5);
  const tuneA: N4[] = [[69, 0, 3, 0.8], [65, 4, 2, 0.7], [62, 8, 3, 0.75], [64, 12, 2, 0.7], [65, 16, 4, 0.8], [62, 22, 2, 0.7], [60, 26, 3, 0.7]];
  const tuneB: N4[] = [[67, 0, 3, 0.8], [70, 4, 2, 0.7], [74, 8, 3, 0.8], [72, 12, 2, 0.7], [69, 16, 4, 0.85], [64, 22, 2, 0.7], [65, 26, 5, 0.75]];
  const beat = drums32([0, 10, 16, 26], [8, 24], every(2, 2).filter(i => i % 4 === 2), []);
  const patterns = [
    mk('Intro', drums32([], [], every(4, 2), []), [], chordsA, chordsA),
    mk('Groove A', beat, tuneA, chordsA, chordsA),
    mk('Groove B', beat, tuneB, chordsB, chordsB),
    mk('Outro', drums32([0], [], [], []), [[62, 0, 8, 0.7]], chordsA, [])
  ];
  return demo('Lo-Fi Chill', 78, 'lofi', patterns, [0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 3, 3], { melody: 'vibraphone', ambient: 'darkPad', arp: 'nylonGuitar' },
    { mode: 'up', rate: '8n', octaves: 1, gate: 0.9 }, 2, 'minor',
    { ambient: { volumeDb: -5, reverbSend: 0.3 }, arp: { volumeDb: -3, pan: -0.2, reverbSend: 0.2 }, melody: { pan: 0.15, reverbSend: 0.25 } },
    { reverbMix: 0.18, eqHigh: -3, compAmount: 0.3, delayFeedback: 0.25 });
}

/** House: 124 BPM, A minor, four-on-the-floor, plucked bass, trance stabs and a wide pad. */
export function houseDemo(): BeatLabProject {
  const Am = [57, 60, 64], F = [53, 57, 60], C = [60, 64, 67], G = [55, 59, 62];
  const bassA: N4[] = every(4, 2).map(s => [s < 16 ? 57 : 53, s, 1, 0.9] as N4);
  const bassB: N4[] = every(4, 2).map(s => [s < 16 ? 60 : 55, s, 1, 0.9] as N4);
  const full = (): DrumPattern => drums32(every(4), [], every(4, 2), [4, 12, 20, 28]);
  const patterns = [
    mk('Intro', drums32(every(4), [], [], []), [], twoChords(Am, F, 0.4), []),
    mk('Groove', full(), bassA, twoChords(Am, F, 0.4), twoChords(Am, F, 0.6)),
    mk('Drop', drums32(every(4), [], every(2, 1), [4, 12, 20, 28]), bassB, twoChords(C, G, 0.5), twoChords(C, G, 0.75)),
    mk('Break', noDrums(), [], twoChords(Am, F, 0.55), twoChords(Am, F, 0.55))
  ];
  return demo('House 124', 124, 'house909', patterns, [0, 0, 1, 1, 1, 1, 3, 3, 2, 2, 2, 2, 1, 1, 0, 0], { melody: 'pluckBass', ambient: 'ensemblePad', arp: 'tranceStab' },
    { mode: 'up', rate: '8n', octaves: 1, gate: 0.5 }, 9, 'minor',
    { ambient: { volumeDb: -6, reverbSend: 0.35 }, arp: { volumeDb: -4, pan: 0.15, reverbSend: 0.2, delaySend: 0.3 }, melody: { reverbSend: 0 } },
    { reverbMix: 0.1, compAmount: 0.45, delayFeedback: 0.3 });
}

/** Trap: 140 BPM, A minor, half-time snare, rolling hats, long 808 sub bass over a dark pad and music-box bells. */
export function trapDemo(): BeatLabProject {
  const Am = [57, 60, 64], F = [53, 57, 60];
  const rolls = [...every(2), 11, 27, 29, 30, 31].filter((v, i, a) => a.indexOf(v) === i);
  const sub: N4[] = [[57, 0, 6, 0.95], [57, 8, 2, 0.8], [60, 12, 3, 0.85], [53, 16, 6, 0.95], [53, 24, 2, 0.8], [55, 28, 3, 0.85]];
  const bells: N4[] = [[81, 0, 2, 0.7], [76, 2, 2, 0.6], [72, 4, 2, 0.7], [76, 6, 2, 0.6], [77, 16, 2, 0.7], [72, 18, 2, 0.6], [69, 20, 2, 0.7], [72, 22, 2, 0.6]];
  const patterns = [
    mk('Intro', noDrums(), [], twoChords(Am, F, 0.45), bells),
    mk('Verse', drums32([0, 10, 16, 24], [8, 24], rolls, [8, 24]), sub, twoChords(Am, F, 0.4), []),
    mk('Hook', drums32([0, 6, 10, 16, 22, 26], [8, 24], rolls, [8, 24]), sub, twoChords(Am, F, 0.5), bells),
    mk('Outro', drums32([0], [], every(4), []), [[57, 0, 8, 0.9]], twoChords(Am, F, 0.4), [])
  ];
  return demo('Trap 140', 140, 'trap', patterns, [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 3], { melody: 'subBass', ambient: 'darkPad', arp: 'musicBox' },
    { mode: 'up', rate: '8n', octaves: 1, gate: 0.7 }, 9, 'minor',
    { ambient: { volumeDb: -6, reverbSend: 0.4 }, arp: { volumeDb: -5, pan: 0.25, reverbSend: 0.3, delaySend: 0.35 }, melody: { volumeDb: 0 } },
    { reverbMix: 0.12, eqLow: 3, compAmount: 0.4, delayFeedback: 0.35 });
}

/** A Persian-inspired mood (synth imitations of santur, tar and ney): A with a flat second (Phrygian-dominant colour), 100 BPM. */
export function persianDemo(): BeatLabProject {
  const avaz: N4[] = [[69, 0, 2, 0.9], [70, 2, 2, 0.8], [73, 4, 2, 0.85], [70, 6, 1, 0.7], [69, 7, 1, 0.7], [70, 8, 4, 0.8], [69, 12, 2, 0.8], [67, 14, 2, 0.75],
    [65, 16, 3, 0.85], [67, 19, 1, 0.7], [69, 20, 4, 0.9], [70, 24, 2, 0.8], [69, 26, 2, 0.75], [64, 28, 4, 0.8]];
  const reply: N4[] = [[76, 0, 2, 0.9], [74, 2, 2, 0.8], [73, 4, 2, 0.8], [70, 6, 2, 0.75], [69, 8, 4, 0.85], [70, 12, 2, 0.75], [73, 14, 2, 0.8],
    [74, 16, 3, 0.9], [73, 19, 1, 0.7], [70, 20, 2, 0.75], [69, 22, 2, 0.7], [65, 24, 3, 0.8], [64, 28, 4, 0.85]];
  const drone: N4[] = [[57, 0, 32, 0.5], [64, 0, 32, 0.35]];
  const tarChords: N4[] = [[57, 0, 16, 0.6], [64, 0, 16, 0.6], [69, 0, 16, 0.6], [58, 16, 16, 0.6], [65, 16, 16, 0.6], [70, 16, 16, 0.6]];
  const daf = drums32([0, 10, 16, 26], [], [], [6, 14, 22, 30]);
  const patterns = [
    mk('Intro', noDrums(), [], drone, tarChords),
    mk('Avaz', daf, avaz, drone, tarChords),
    mk('Reply', drums32([0, 10, 16, 26], [], every(4, 2), [6, 14, 22, 30]), reply, drone, tarChords),
    mk('Ending', noDrums(), [[69, 0, 12, 0.8]], drone, [])
  ];
  return demo('Persian Mood', 100, 'tight', patterns, [0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 3], { melody: 'santur', ambient: 'ney', arp: 'tar' },
    { mode: 'updown', rate: '8n', octaves: 1, gate: 0.8 }, 9, 'minor',
    { ambient: { volumeDb: -5, reverbSend: 0.4 }, arp: { volumeDb: -3, pan: -0.25, reverbSend: 0.25 }, melody: { reverbSend: 0.3, delaySend: 0.2 } },
    { reverbMix: 0.2, reverbSize: 'hall', delayFeedback: 0.3 });
}

/** Synthwave: 108 BPM, A minor, gated pulse lead over an arcade arpeggio and a string-machine pad. */
export function synthwaveDemo(): BeatLabProject {
  const Am = [57, 60, 64], F = [53, 57, 60], C = [60, 64, 67], G = [55, 59, 62];
  const leadA: N4[] = [[76, 0, 3, 0.9], [74, 4, 2, 0.8], [72, 6, 2, 0.8], [69, 8, 6, 0.9], [72, 16, 3, 0.9], [74, 20, 2, 0.8], [76, 22, 2, 0.8], [77, 24, 6, 0.9]];
  const leadB: N4[] = [[79, 0, 3, 0.9], [77, 4, 2, 0.8], [76, 6, 2, 0.8], [72, 8, 6, 0.9], [74, 16, 3, 0.9], [76, 20, 2, 0.8], [74, 22, 2, 0.8], [71, 24, 6, 0.9]];
  const beat = drums32([0, 8, 16, 24], [8, 24], every(2), [8, 24]);
  const patterns = [
    mk('Intro', drums32([0, 8, 16, 24], [], every(4, 2), []), [], twoChords(Am, F, 0.5), twoChords(Am, F, 0.6)),
    mk('Verse', beat, leadA, twoChords(Am, F, 0.5), twoChords(Am, F, 0.65)),
    mk('Chorus', beat, leadB, twoChords(C, G, 0.55), twoChords(C, G, 0.7)),
    mk('Bridge', drums32([0, 16], [], [], []), [], twoChords(F, G, 0.55), twoChords(F, G, 0.55))
  ];
  return demo('Synthwave 108', 108, 'electro', patterns, [0, 0, 1, 1, 2, 2, 3, 3, 1, 1, 2, 2, 2, 2], { melody: 'pwmLead', ambient: 'vintageStrings', arp: 'arcadeArp' },
    { mode: 'up', rate: '16n', octaves: 2, gate: 0.5 }, 9, 'minor',
    { ambient: { volumeDb: -6, reverbSend: 0.4 }, arp: { volumeDb: -6, pan: -0.2, reverbSend: 0.2, delaySend: 0.3 }, melody: { volumeDb: -1, reverbSend: 0.25, delaySend: 0.25 } },
    { reverbMix: 0.2, delayFeedback: 0.35, compAmount: 0.35 });
}

/** Chiptune: 150 BPM, C major, square lead, triangle bass and a fast pulse arpeggio on the 8-bit kit. */
export function chiptuneDemo(): BeatLabProject {
  const C = [60, 64, 67], Am = [57, 60, 64], F = [53, 57, 60], G = [55, 59, 62];
  const lead: N4[] = [[72, 0, 2, 0.9], [76, 2, 2, 0.9], [79, 4, 2, 0.9], [76, 6, 2, 0.9], [74, 8, 2, 0.9], [77, 10, 2, 0.9], [81, 12, 4, 0.9],
    [79, 16, 2, 0.9], [77, 18, 2, 0.9], [76, 20, 2, 0.9], [74, 22, 2, 0.9], [72, 24, 4, 0.9], [67, 28, 4, 0.9]];
  const bass: N4[] = [[48, 0, 4, 0.9], [48, 4, 4, 0.9], [57, 8, 4, 0.9], [57, 12, 4, 0.9], [53, 16, 4, 0.9], [53, 20, 4, 0.9], [55, 24, 4, 0.9], [55, 28, 4, 0.9]];
  const beat = drums32([0, 8, 16, 24], [8, 24], every(2), []);
  const patterns = [
    mk('Intro', drums32([0, 16], [], every(4), []), [], bass, twoChords(C, Am, 0.6)),
    mk('Level', beat, lead, bass, twoChords(C, Am, 0.7)),
    mk('Boss', drums32([0, 4, 8, 12, 16, 20, 24, 28], [8, 24], every(2), []), lead, bass, twoChords(F, G, 0.75))
  ];
  return demo('Chiptune 150', 150, 'chip', patterns, [0, 0, 1, 1, 1, 1, 2, 2, 1, 1], { melody: 'chipSquare', ambient: 'chipTri', arp: 'arcadeArp' },
    { mode: 'up', rate: '16n', octaves: 2, gate: 0.4 }, 0, 'major',
    { ambient: { volumeDb: 0, reverbSend: 0 }, arp: { volumeDb: -7, pan: 0.2, reverbSend: 0.05 }, melody: { reverbSend: 0.05 } },
    { reverbMix: 0.05, compAmount: 0.3, delayFeedback: 0.2 });
}

/** The song that is loaded when the app starts (NEW still gives a simple project). */
export function startupProject(): BeatLabProject { return hipHopDemo(); }

export const SAMPLE_PROJECTS_EXTRA: Record<string, () => BeatLabProject> = {
  'Hip Hop Demo': hipHopDemo, 'Lo-Fi Chill': lofiDemo, 'House 124': houseDemo, 'Trap 140': trapDemo, 'Persian Mood': persianDemo, 'Synthwave 108': synthwaveDemo, 'Chiptune 150': chiptuneDemo
};

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
    Object.entries(p.notes).some(([id, notes]) => notes.length > 0 && project.tracks.some(t => t.id === id) && !effectiveMuted(ch, id));
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

/** Files before version 5 have three fixed tracks (melody, ambient, arp) with notes in pattern.melody/.ambient/.arp. */
function toV5(data: Record<string, unknown>): Record<string, unknown> {
  const t = isObj(data.tracks) ? data.tracks : {};
  const tracks = [
    { id: 'melody', name: 'Melody', kind: 'melody', instrument: t.melody ?? KIND_DEFAULT_INSTRUMENT.melody },
    { id: 'ambient', name: 'Ambient', kind: 'ambient', instrument: t.ambient ?? KIND_DEFAULT_INSTRUMENT.ambient },
    { id: 'arp', name: 'Arpeggio', kind: 'arp', instrument: t.arp ?? KIND_DEFAULT_INSTRUMENT.arp, arp: data.arp },
    { id: 'synth', name: 'Synth', kind: 'synth', instrument: KIND_DEFAULT_INSTRUMENT.synth }
  ];
  const patterns = Array.isArray(data.patterns)
    ? data.patterns.map((p: unknown) => (isObj(p) ? { name: p.name, drums: p.drums, notes: { melody: p.melody, ambient: p.ambient, arp: p.arp } } : p))
    : data.patterns;
  const { arp: _arp, ...rest } = data;
  return { ...rest, tracks, patterns, schemaVersion: SCHEMA_VERSION };
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
    data = toV5(widenV2(upgradeV1(input)));
  } else if (input.schemaVersion === 2) {
    data = toV5(widenV2(input));
  } else if (input.schemaVersion === 3 || input.schemaVersion === 4) {
    data = toV5(input);
  } else if (input.schemaVersion !== SCHEMA_VERSION) {
    return fail(`Unsupported schemaVersion (${String(input.schemaVersion)}); this app reads versions 1 to ${SCHEMA_VERSION}.`);
  }
  const legacy = data.legacy === true;
  if (typeof data.name !== 'string' || data.name.length > 80) return fail('"name" must be text of at most 80 characters.');
  if (!isNum(data.bpm) || data.bpm < 60 || data.bpm > 200) return fail('"bpm" must be a number between 60 and 200.');

  // the user's own synths (before the tracks, because a track may use one)
  const synthResult = validateSynths(data.synths);
  if (!synthResult.ok) return fail(synthResult.error);
  const synths = synthResult.synths;

  // tracks
  if (!Array.isArray(data.tracks)) return fail('"tracks" must be a list.');
  if (data.tracks.length > MAX_TRACKS) return fail(`Too many tracks (max ${MAX_TRACKS}).`);
  const tracks: TrackDef[] = [];
  for (let i = 0; i < data.tracks.length; i++) {
    const t: unknown = data.tracks[i];
    const where = `tracks[${i}]`;
    if (!isObj(t)) return fail(`${where} is not a track.`);
    if (!isValidTrackId(t.id)) return fail(`${where}.id must be 1–24 letters, digits, - or _ (and not a reserved word such as drums, lab, kick).`);
    if (tracks.some(x => x.id === t.id)) return fail(`${where}.id "${t.id}" is used twice.`);
    if (typeof t.name !== 'string' || t.name.trim().length < 1 || t.name.length > MAX_TRACK_NAME) return fail(`${where}.name must be text of 1–${MAX_TRACK_NAME} characters.`);
    if (!isTrackKind(t.kind)) return fail(`${where}.kind must be melody, ambient, arp or synth.`);
    const inst = t.instrument;
    if (typeof inst === 'string' && isCustomRef(inst)) {
      if (!synths.some(x => x.id === customId(inst))) return fail(`${where}.instrument uses the synth "${customId(inst)}", which is not in this file.`);
    } else if (!isMelodyInstrument(inst)) return fail(`${where}.instrument is not a known instrument.`);
    let arp = defaultArp();
    if (t.arp !== undefined) {
      const a = t.arp;
      if (!isObj(a) || !isArpMode(a.mode) || !isArpRate(a.rate) || !isArpOctaves(a.octaves) || !isNum(a.gate) || a.gate < 0.2 || a.gate > 1) return fail(`${where}.arp must have a valid mode, rate, octaves (1–3) and gate (0.2–1).`);
      arp = { mode: a.mode, rate: a.rate, octaves: a.octaves, gate: a.gate };
    }
    tracks.push({ id: t.id, name: t.name.trim(), kind: t.kind, instrument: inst as string, arp });
  }

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
    if (p.notes !== undefined && !isObj(p.notes)) return fail(`${where}.notes must be an object.`);
    const rawNotes = isObj(p.notes) ? p.notes : {};
    const lists: Record<string, MelodyNote[]> = {};
    for (const t of tracks) {
      const label = legacy ? t.id : `${where}.notes.${t.id}`;
      const notes = validateNotes(rawNotes[t.id] ?? [], label);
      if (typeof notes === 'string') return fail(notes);
      lists[t.id] = notes;
    }
    patterns.push({ name: p.name, drums, notes: compactNotes(lists) });
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
  const channelNames: { name: string; kind?: TrackDef['kind'] }[] = [...DRUM_CHANNELS.map(n => ({ name: n as string })), ...tracks.map(t => ({ name: t.id, kind: t.kind }))];
  for (const { name, kind } of channelNames) {
    const c = data.channels[name];
    if (c === undefined && kind) { channels[name] = defaultChannel(name, kind); continue; } // tracks added later / files from before these tracks existed
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

  return { ok: true, project: { schemaVersion: 5, name: data.name, bpm: Math.round(data.bpm), patterns, playlist, tracks, synths, drumKit, melodyView, channels, master } };
}

export function parseProject(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'The file is too large to be a BeatLab project.' };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'The file is not valid JSON.' }; }
  return validateProject(data);
}
