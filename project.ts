import { DrumPattern, INSTRUMENTS, STEPS, makePattern } from './pattern';
import { MAX_MIDI, MIN_MIDI, MelodyNote, SCALES, ScaleName, makePreset, noteToMidi } from './melody';
import { CHANNEL_NAMES, Channels, MAX_FEEDBACK, MasterSettings, VOLUME_MAX_DB, VOLUME_MIN_DB, defaultChannels, defaultMaster, effectiveMuted, isDelayDivision, isReverbSize } from './mixer';
import { DrumKitId, MelodyInstrumentId, isDrumKit, isMelodyInstrument } from './instruments';

export const SCHEMA_VERSION = 1;
export const MAX_FILE_BYTES = 1_000_000;
export const MAX_NOTES = 256;

export type BeatLabProject = {
  schemaVersion: 1;
  name: string;
  bpm: number;
  stepsPerBar: 16;
  bars: 1;
  drums: DrumPattern;
  melody: MelodyNote[];
  channels: Channels;
  master: MasterSettings;
  melodyInstrument: MelodyInstrumentId;
  drumKit: DrumKitId;
  melodyView: { key: number; scale: ScaleName };
};

export type ParseResult = { ok: true; project: BeatLabProject } | { ok: false; error: string };

export function emptyDrums(): DrumPattern {
  return { kick: Array(STEPS).fill(false), snare: Array(STEPS).fill(false), hat: Array(STEPS).fill(false), clap: Array(STEPS).fill(false) };
}

export function defaultProject(): BeatLabProject {
  return {
    schemaVersion: 1, name: 'Untitled', bpm: 120, stepsPerBar: 16, bars: 1,
    drums: makePattern(), melody: makePreset('happy', 0).notes, channels: defaultChannels(),
    master: defaultMaster(), melodyInstrument: 'electricPiano', drumKit: 'classic',
    melodyView: { key: 0, scale: 'majorPent' }
  };
}

const on = (steps: number[]): boolean[] => Array.from({ length: STEPS }, (_, i) => steps.includes(i));

export const SAMPLE_PROJECTS: Record<string, () => BeatLabProject> = {
  'Basic House Beat': () => ({
    ...defaultProject(), name: 'Basic House Beat', bpm: 124,
    drums: { kick: on([0, 4, 8, 12]), snare: on([]), hat: on([2, 6, 10, 14]), clap: on([4, 12]) },
    melody: [], melodyView: { key: 0, scale: 'majorPent' }
  }),
  'Simple Melody': () => {
    const preset = makePreset('chill', 9);
    return {
      ...defaultProject(), name: 'Simple Melody', bpm: 100,
      drums: { kick: on([0, 8]), snare: on([12]), hat: on([0, 2, 4, 6, 8, 10, 12, 14]), clap: on([]) },
      melody: preset.notes, melodyInstrument: preset.instrument, melodyView: { key: 9, scale: preset.scale }
    };
  },
  'Epic Night': () => {
    const preset = makePreset('epic', 9);
    return {
      ...defaultProject(), name: 'Epic Night', bpm: 128, drumKit: 'tight',
      drums: { kick: on([0, 4, 8, 12]), snare: on([4, 12]), hat: on([0, 2, 4, 6, 8, 10, 12, 14]), clap: on([4, 12]) },
      melody: preset.notes, melodyInstrument: preset.instrument, melodyView: { key: 9, scale: preset.scale },
      master: { ...defaultMaster(), reverbMix: 0.2, reverbSize: 'hall' as const }
    };
  },
  'Dreamy 808': () => {
    const preset = makePreset('dreamy', 2);
    return {
      ...defaultProject(), name: 'Dreamy 808', bpm: 84, drumKit: 'kit808',
      drums: { kick: on([0, 7, 10]), snare: on([4, 12]), hat: on([0, 2, 4, 6, 8, 10, 12, 14]), clap: on([12]) },
      melody: preset.notes, melodyInstrument: preset.instrument, melodyView: { key: 2, scale: preset.scale },
      master: { ...defaultMaster(), reverbMix: 0.3, reverbSize: 'cathedral' as const }
    };
  }
};

export function serializeProject(project: BeatLabProject): string {
  return JSON.stringify(project, null, 2);
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
  return cleaned || 'beatlab_project';
}

export function hasAudibleContent(project: BeatLabProject): boolean {
  const drums = INSTRUMENTS.some(i => !effectiveMuted(project.channels, i) && project.drums[i].some(Boolean));
  return drums || (!effectiveMuted(project.channels, 'melody') && project.melody.length > 0);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates unknown data. Never throws; returns a readable error instead. */
export function validateProject(data: unknown): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, error });
  if (!isObj(data)) return fail('The file is not a BeatLab project (expected a JSON object).');
  if (data.schemaVersion !== SCHEMA_VERSION) return fail(`Unsupported schemaVersion (${String(data.schemaVersion)}); this app reads version ${SCHEMA_VERSION}.`);
  if (typeof data.name !== 'string' || data.name.length > 80) return fail('"name" must be text of at most 80 characters.');
  if (!isNum(data.bpm) || data.bpm < 60 || data.bpm > 200) return fail('"bpm" must be a number between 60 and 200.');
  if (data.stepsPerBar !== 16) return fail('"stepsPerBar" must be 16.');
  if (data.bars !== 1) return fail('"bars" must be 1 in this version.');

  if (!isObj(data.drums)) return fail('"drums" is missing.');
  const drums = {} as DrumPattern;
  for (const name of INSTRUMENTS) {
    const row = data.drums[name];
    if (!Array.isArray(row) || row.length !== STEPS) return fail(`drums.${name} must have exactly ${STEPS} steps.`);
    if (!row.every(v => typeof v === 'boolean')) return fail(`drums.${name} may only contain true/false.`);
    drums[name] = [...row] as boolean[];
  }

  if (!Array.isArray(data.melody)) return fail('"melody" must be a list of notes.');
  if (data.melody.length > MAX_NOTES) return fail(`Too many melody notes (max ${MAX_NOTES}).`);
  const melody: MelodyNote[] = [];
  for (let i = 0; i < data.melody.length; i++) {
    const n: unknown = data.melody[i];
    const where = `melody[${i}]`;
    if (!isObj(n)) return fail(`${where} is not a note.`);
    if (typeof n.id !== 'string') return fail(`${where}.id must be text.`);
    const midi = typeof n.pitch === 'string' ? noteToMidi(n.pitch) : null;
    if (midi === null || midi < MIN_MIDI || midi > MAX_MIDI) return fail(`${where}.pitch must be a note between C3 and C6.`);
    if (!isNum(n.step) || !Number.isInteger(n.step) || n.step < 0 || n.step >= STEPS) return fail(`${where}.step must be a whole number 0–${STEPS - 1}.`);
    if (!isNum(n.lengthSteps) || !Number.isInteger(n.lengthSteps) || n.lengthSteps < 1 || n.step + n.lengthSteps > STEPS) return fail(`${where}.lengthSteps must be a whole number ≥ 1 that fits inside the bar.`);
    if (!isNum(n.velocity) || n.velocity < 0 || n.velocity > 1) return fail(`${where}.velocity must be between 0 and 1.`);
    melody.push({ id: n.id, pitch: n.pitch as string, step: n.step, lengthSteps: n.lengthSteps, velocity: n.velocity });
  }

  if (!isObj(data.channels)) return fail('"channels" is missing.');
  const channels = {} as Channels;
  for (const name of CHANNEL_NAMES) {
    const c = data.channels[name];
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
    master = { volumeDb: m.volumeDb, reverbMix: m.reverbMix, reverbSize: m.reverbSize, delayDivision: m.delayDivision, delayFeedback: m.delayFeedback };
  }

  let melodyInstrument: MelodyInstrumentId = 'softSynth';
  if (data.melodyInstrument !== undefined) {
    if (!isMelodyInstrument(data.melodyInstrument)) return fail('"melodyInstrument" is not a known instrument.');
    melodyInstrument = data.melodyInstrument;
  }
  let drumKit: DrumKitId = 'classic';
  if (data.drumKit !== undefined) {
    if (!isDrumKit(data.drumKit)) return fail('"drumKit" is not a known drum kit.');
    drumKit = data.drumKit;
  }

  let melodyView = { key: 0, scale: 'majorPent' as ScaleName };
  if (data.melodyView !== undefined) {
    const v = data.melodyView;
    if (!isObj(v) || !isNum(v.key) || !Number.isInteger(v.key) || v.key < 0 || v.key > 11 || typeof v.scale !== 'string' || !Object.prototype.hasOwnProperty.call(SCALES, v.scale)) {
      return fail('"melodyView" must contain a key (0–11) and a valid scale.');
    }
    melodyView = { key: v.key, scale: v.scale as ScaleName };
  }

  return { ok: true, project: { schemaVersion: 1, name: data.name, bpm: Math.round(data.bpm), stepsPerBar: 16, bars: 1, drums, melody, channels, master, melodyInstrument, drumKit, melodyView } };
}

export function parseProject(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'The file is too large to be a BeatLab project.' };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'The file is not valid JSON.' }; }
  return validateProject(data);
}
