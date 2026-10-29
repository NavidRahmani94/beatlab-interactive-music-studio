import { describe, expect, it } from 'vitest';
import {
  SAMPLE_PROJECTS, defaultProject, hasAudibleContent, parseProject, safeFileName, serializeProject, validateProject, emptyDrums, MAX_NOTES
} from './project';
import { makePreset } from './melody';
import { defaultChannels, defaultMaster, patchChannel, patchMaster, clampVolumeDb, clampSend, clampPan, clampFeedback, effectiveMuted, delaySeconds } from './mixer';
import { toggleNote } from './melody';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const CHANNEL_KEYS = ['kick', 'snare', 'hat', 'clap', 'melody', 'ambient', 'arp'];
const bad = (mutate: (p: any) => void, expected: RegExp) => {
  const p = clone(defaultProject()) as any;
  mutate(p);
  const r = validateProject(p);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(expected);
};

describe('save / open round trip', () => {
  it('default project is valid and survives serialize -> parse unchanged', () => {
    const p = defaultProject();
    const r = parseProject(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });
  it('every sample project is valid and round-trips', () => {
    Object.entries(SAMPLE_PROJECTS).forEach(([name, make]) => {
      const p = make();
      expect(p.name).toBe(name);
      const r = parseProject(serializeProject(p));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.project).toEqual(p);
    });
  });
  it('keeps notes, channels, bpm and key exactly', () => {
    const p = defaultProject();
    p.bpm = 143; p.channels = patchChannel(p.channels, 'hat', { volumeDb: -9, muted: true, delaySend: 0.5 });
    p.patterns[0].melody = toggleNote(p.patterns[0].melody, 64, 15, 4); p.melodyView = { key: 7, scale: 'minor' };
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project).toEqual(p);
  });
});

describe('invalid projects are rejected with a clear message', () => {
  it('not JSON / not an object', () => {
    expect(parseProject('{oops')).toEqual({ ok: false, error: 'The file is not valid JSON.' });
    expect(parseProject('[1,2]').ok).toBe(false);
    expect(parseProject('null').ok).toBe(false);
  });
  it('huge file', () => { expect(parseProject(' '.repeat(1_000_001)).ok).toBe(false); });
  it('schemaVersion', () => bad(p => { p.schemaVersion = 9; }, /schemaVersion/));
  it('bpm', () => { bad(p => { p.bpm = 300; }, /bpm/); bad(p => { p.bpm = 'fast'; }, /bpm/); bad(p => { p.bpm = null; }, /bpm/); });
  it('name', () => bad(p => { p.name = 5; }, /name/));
  it('drum row length / type', () => {
    bad(p => { p.patterns[0].drums.kick = p.patterns[0].drums.kick.slice(1); }, /drums\.kick.*16/);
    bad(p => { p.patterns[0].drums.snare[0] = 1; }, /drums\.snare/);
    bad(p => { delete p.patterns[0].drums.clap; }, /drums\.clap/);
  });
  it('melody notes', () => {
    bad(p => { p.patterns[0].melody = [{ id: 'a', pitch: 'C4', step: 16, lengthSteps: 1, velocity: 0.5 }]; }, /step/);
    bad(p => { p.patterns[0].melody = [{ id: 'a', pitch: 'C4', step: 15, lengthSteps: 2, velocity: 0.5 }]; }, /lengthSteps/);
    bad(p => { p.patterns[0].melody = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 0, velocity: 0.5 }]; }, /lengthSteps/);
    bad(p => { p.patterns[0].melody = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 1, velocity: 2 }]; }, /velocity/);
    bad(p => { p.patterns[0].melody = [{ id: 'a', pitch: 'X9', step: 0, lengthSteps: 1, velocity: 0.5 }]; }, /pitch/);
    bad(p => { p.patterns[0].melody = [{ id: 'a', pitch: 'C1', step: 0, lengthSteps: 1, velocity: 0.5 }]; }, /pitch/);
    bad(p => { p.patterns[0].melody = 'nope'; }, /melody/);
    bad(p => { p.patterns[0].arp = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 20, velocity: 0.5 }]; }, /arp\[0\]\.lengthSteps/);
    bad(p => { p.patterns[0].melody = [42]; }, /melody\[0\]/);
    bad(p => { p.patterns[0].melody = Array.from({ length: MAX_NOTES + 1 }, () => ({})); }, /Too many/);
  });
  it('channels', () => {
    bad(p => { delete p.channels.melody; }, /channels\.melody/);
    bad(p => { p.channels.kick.volumeDb = -100; }, /volumeDb/);
    bad(p => { p.channels.kick.muted = 'yes'; }, /muted/);
    bad(p => { p.channels.hat.reverbSend = 1.5; }, /reverbSend/);
    bad(p => { p.channels.hat.delaySend = -1; }, /delaySend/);
  });
  it('melodyView', () => {
    bad(p => { p.melodyView = { key: 12, scale: 'major' }; }, /melodyView/);
    bad(p => { p.melodyView = { key: 0, scale: 'lydian' }; }, /melodyView/);
  });
  it('missing melodyView falls back to a default', () => {
    const p: any = clone(defaultProject()); delete p.melodyView;
    const r = validateProject(p);
    expect(r.ok && r.project.melodyView).toEqual({ key: 0, scale: 'majorPent' });
  });
  it('NaN / Infinity never slip through', () => {
    const p: any = clone(defaultProject()); p.channels.kick.volumeDb = NaN;
    expect(validateProject(p).ok).toBe(false);
  });
});

describe('new fields: master, instrument, drum kit, pan, solo', () => {
  it('round trip keeps them', () => {
    const p = defaultProject();
    p.master = { volumeDb: -3, reverbMix: 0.5, reverbSize: 'cathedral', delayDivision: 'quarter', delayFeedback: 0.6, eqLow: 3, eqMid: -2, eqHigh: 6, compAmount: 0.4 };
    p.tracks = { ...p.tracks, melody: 'bell' }; p.drumKit = 'kit808';
    p.channels = patchChannel(patchChannel(p.channels, 'kick', { pan: -0.5, solo: true }), 'hat', { pan: 1 });
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project).toEqual(p);
  });
  it('old files without the new fields still open and get defaults', () => {
    const p: any = clone(defaultProject());
    delete p.master; delete p.tracks; delete p.drumKit;
    CHANNEL_KEYS.forEach(k => { delete p.channels[k].pan; delete p.channels[k].solo; });
    const r = validateProject(p);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.master).toEqual(defaultMaster());
      expect(r.project.drumKit).toBe('classic');
      expect(r.project.tracks.melody).toBe('electricPiano');
      expect(r.project.channels.kick).toMatchObject({ pan: 0, solo: false });
    }
  });
  it('rejects bad values', () => {
    bad(p => { p.master.reverbMix = 2; }, /reverbMix/);
    bad(p => { p.master.reverbSize = 'ocean'; }, /reverbSize/);
    bad(p => { p.master.delayDivision = 'weird'; }, /delayDivision/);
    bad(p => { p.master.delayFeedback = 0.99; }, /delayFeedback/);
    bad(p => { p.master.volumeDb = 50; }, /master\.volumeDb/);
    bad(p => { p.master = 3; }, /master/);
    bad(p => { p.tracks.melody = 'kazoo'; }, /tracks\.melody/);
    bad(p => { p.master.eqLow = 40; }, /eqLow/);
    bad(p => { p.master.compAmount = 3; }, /compAmount/);
    bad(p => { p.drumKit = 'jazz'; }, /drumKit/);
    // names that exist on every JS object must not count as valid ids
    bad(p => { p.drumKit = 'constructor'; }, /drumKit/);
    bad(p => { p.tracks.arp = 'toString'; }, /tracks\.arp/);
    bad(p => { p.master.reverbSize = 'hasOwnProperty'; }, /reverbSize/);
    bad(p => { p.master.delayDivision = '__proto__'; }, /delayDivision/);
    bad(p => { p.melodyView = { key: 0, scale: 'toString' }; }, /melodyView/);
    bad(p => { p.channels.kick.pan = 2; }, /pan/);
    bad(p => { p.channels.kick.solo = 'yes'; }, /solo/);
  });
  it('solo silences the other channels', () => {
    let c = defaultChannels();
    expect(effectiveMuted(c, 'kick')).toBe(false);
    c = patchChannel(c, 'melody', { solo: true });
    expect(effectiveMuted(c, 'melody')).toBe(false);
    expect(effectiveMuted(c, 'kick')).toBe(true);
    c = patchChannel(c, 'melody', { muted: true });
    expect(effectiveMuted(c, 'melody')).toBe(true);
  });
  it('hasAudibleContent respects solo', () => {
    const p = defaultProject();
    p.channels = patchChannel(p.channels, 'clap', { solo: true });   // clap has no steps in the default beat
    expect(hasAudibleContent(p)).toBe(false);
  });
  it('master EQ and compressor helpers clamp', () => {
    const m = patchMaster(defaultMaster(), { eqLow: 99, eqMid: -99, eqHigh: NaN, compAmount: 5 });
    expect(m).toMatchObject({ eqLow: 12, eqMid: -12, eqHigh: 0, compAmount: 1 });
  });
  it('master/pan/feedback helpers clamp', () => {
    expect(clampPan(5)).toBe(1); expect(clampPan(-5)).toBe(-1); expect(clampPan(NaN)).toBe(0);
    expect(clampFeedback(5)).toBe(0.9); expect(clampFeedback(-1)).toBe(0);
    const m = patchMaster(defaultMaster(), { reverbMix: 9, volumeDb: -99, delayFeedback: 2 });
    expect(m).toMatchObject({ reverbMix: 1, volumeDb: -40, delayFeedback: 0.9 });
  });
  it('delay time follows tempo', () => {
    expect(delaySeconds(120, 'quarter')).toBeCloseTo(0.5);
    expect(delaySeconds(120, 'dottedEighth')).toBeCloseTo(0.375);
    expect(delaySeconds(60, 'eighth')).toBeCloseTo(0.5);
  });
});

describe('patterns, playlist and the new tracks', () => {
  it('the Full Song sample uses all four tracks and several patterns', () => {
    const p = SAMPLE_PROJECTS['Full Song']();
    expect(p.patterns.length).toBeGreaterThanOrEqual(3);
    expect(p.playlist.length).toBeGreaterThan(4);
    expect(p.patterns.some(x => x.ambient.length > 0)).toBe(true);
    expect(p.patterns.some(x => x.arp.length > 0)).toBe(true);
    expect(p.patterns.some(x => x.drums.kick.some(Boolean))).toBe(true);
    expect(p.patterns.some(x => x.melody.length > 0)).toBe(true);
  });
  it('rejects a bad playlist', () => {
    bad(p => { p.playlist = []; }, /playlist/);
    bad(p => { p.playlist = [5]; }, /playlist\[0\]/);
    bad(p => { p.playlist = [-1]; }, /playlist\[0\]/);
    bad(p => { p.playlist = [0.5]; }, /playlist\[0\]/);
    bad(p => { p.playlist = Array(33).fill(0); }, /playlist/);
    bad(p => { p.patterns = []; }, /patterns/);
    bad(p => { p.patterns = Array(17).fill(clone(p.patterns[0])); }, /Too many patterns/);
  });
  it('accepts empty bars (null) in the playlist', () => {
    const p = defaultProject(); p.playlist = [0, null, 0];
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project.playlist).toEqual([0, null, 0]);
  });
  it('rejects bad arp settings', () => {
    bad(p => { p.arp.mode = 'sideways'; }, /arp/);
    bad(p => { p.arp.octaves = 5; }, /arp/);
    bad(p => { p.arp.gate = 0; }, /arp/);
  });
  it('a track that is muted or not soloed does not count as sound', () => {
    const p = defaultProject();
    p.patterns[0].drums = emptyDrums(); p.patterns[0].melody = [];
    p.patterns[0].ambient = toggleNote([], 60, 0, 8);
    expect(hasAudibleContent(p)).toBe(true);
    p.channels = patchChannel(p.channels, 'ambient', { muted: true });
    expect(hasAudibleContent(p)).toBe(false);
  });
  it('old version-1 files are upgraded to one pattern', () => {
    const old: any = {
      schemaVersion: 1, name: 'Old', bpm: 110, stepsPerBar: 16, bars: 1,
      drums: defaultProject().patterns[0].drums, melody: makePreset('sad', 9).notes,
      channels: Object.fromEntries(CHANNEL_KEYS.slice(0, 5).map(k => [k, { volumeDb: 0, muted: false, reverbSend: 0, delaySend: 0 }])),
      melodyInstrument: 'bell', melodyView: { key: 9, scale: 'minor' }
    };
    const r = validateProject(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.schemaVersion).toBe(2);
      expect(r.project.patterns).toHaveLength(1);
      expect(r.project.playlist).toEqual([0]);
      expect(r.project.patterns[0].melody).toEqual(old.melody);
      expect(r.project.tracks.melody).toBe('bell');
      expect(r.project.channels.ambient).toBeDefined();
      expect(r.project.channels.arp).toBeDefined();
    }
  });
  it('version-1 errors are still readable', () => {
    const r = validateProject({ schemaVersion: 1, name: 'x', bpm: 100, stepsPerBar: 16, bars: 2 });
    expect(r.ok).toBe(false);
  });
});

describe('helpers', () => {
  it('safeFileName', () => {
    expect(safeFileName('My Beat #1!')).toBe('My_Beat_1');
    expect(safeFileName('???')).toBe('beatlab_project');
    expect(safeFileName('../../etc/passwd')).toBe('etcpasswd');
  });
  it('hasAudibleContent', () => {
    const p = defaultProject();
    expect(hasAudibleContent(p)).toBe(true);
    p.patterns[0].drums = emptyDrums(); p.patterns[0].melody = [];
    expect(hasAudibleContent(p)).toBe(false);
    p.patterns[0].melody = toggleNote([], 60, 0, 1);
    expect(hasAudibleContent(p)).toBe(true);
    p.channels = patchChannel(p.channels, 'melody', { muted: true });
    expect(hasAudibleContent(p)).toBe(false);
  });
});

describe('mixer helpers', () => {
  it('clamps values', () => {
    expect(clampVolumeDb(-99)).toBe(-40);
    expect(clampVolumeDb(99)).toBe(6);
    expect(clampVolumeDb(NaN)).toBe(0);
    expect(clampSend(2)).toBe(1);
    expect(clampSend(-1)).toBe(0);
    expect(clampSend(0.456)).toBe(0.46);
  });
  it('patchChannel is immutable and touches one channel', () => {
    const c = defaultChannels();
    const d = patchChannel(c, 'snare', { muted: true, volumeDb: -200 });
    expect(c.snare.muted).toBe(false);
    expect(d.snare).toMatchObject({ muted: true, volumeDb: -40 });
    expect(d.kick).toEqual(c.kick);
  });
});
