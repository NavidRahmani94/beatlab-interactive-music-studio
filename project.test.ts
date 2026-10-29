import { describe, expect, it } from 'vitest';
import {
  SAMPLE_PROJECTS, defaultProject, hasAudibleContent, parseProject, safeFileName, serializeProject, validateProject, emptyDrums, MAX_NOTES
} from './project';
import { makePreset } from './melody';
import { startupProject } from './project';
import { defaultChannels, syncChannels, defaultMaster, patchChannel, patchMaster, clampVolumeDb, clampSend, clampPan, clampFeedback, effectiveMuted, delaySeconds } from './mixer';
import { toggleNote } from './melody';
import { defaultTrackDefs, removeTrack } from './tracks';
import { dropTrackNotes, notesFor } from './song';

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
    p.patterns[0].notes.melody = toggleNote(notesFor(p.patterns[0], 'melody'), 64, 15, 4); p.melodyView = { key: 7, scale: 'minor' };
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
    bad(p => { p.patterns[0].drums.kick = p.patterns[0].drums.kick.slice(1); }, /drums\.kick.*32/);
    bad(p => { p.patterns[0].drums.snare[0] = 1; }, /drums\.snare/);
    bad(p => { delete p.patterns[0].drums.clap; }, /drums\.clap/);
  });
  it('melody notes', () => {
    bad(p => { p.patterns[0].notes.melody = [{ id: 'a', pitch: 'C4', step: 32, lengthSteps: 1, velocity: 0.5 }]; }, /step/);
    bad(p => { p.patterns[0].notes.melody = [{ id: 'a', pitch: 'C4', step: 31, lengthSteps: 2, velocity: 0.5 }]; }, /lengthSteps/);
    bad(p => { p.patterns[0].notes.melody = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 0, velocity: 0.5 }]; }, /lengthSteps/);
    bad(p => { p.patterns[0].notes.melody = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 1, velocity: 2 }]; }, /velocity/);
    bad(p => { p.patterns[0].notes.melody = [{ id: 'a', pitch: 'X9', step: 0, lengthSteps: 1, velocity: 0.5 }]; }, /pitch/);
    bad(p => { p.patterns[0].notes.melody = [{ id: 'a', pitch: 'C1', step: 0, lengthSteps: 1, velocity: 0.5 }]; }, /pitch/);
    bad(p => { p.patterns[0].notes.melody = 'nope'; }, /melody/);
    bad(p => { p.patterns[0].notes.arp = [{ id: 'a', pitch: 'C4', step: 0, lengthSteps: 33, velocity: 0.5 }]; }, /arp\[0\]\.lengthSteps/);
    bad(p => { p.patterns[0].notes.melody = [42]; }, /melody\[0\]/);
    bad(p => { p.patterns[0].notes.melody = Array.from({ length: MAX_NOTES + 1 }, () => ({})); }, /Too many/);
  });
  it('channels', () => {
    bad(p => { delete p.channels.kick; }, /channels\.kick/);
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
    p.tracks = p.tracks.map(t => t.id === 'melody' ? { ...t, instrument: 'bell', name: 'Lead tune' } : t); p.drumKit = 'kit808';
    p.channels = patchChannel(patchChannel(p.channels, 'kick', { pan: -0.5, solo: true }), 'hat', { pan: 1 });
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project).toEqual(p);
  });
  it('old files without the new fields still open and get defaults', () => {
    const p: any = clone(defaultProject());
    delete p.master; delete p.drumKit;
    CHANNEL_KEYS.forEach(k => { delete p.channels[k].pan; delete p.channels[k].solo; });
    const r = validateProject(p);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.master).toEqual(defaultMaster());
      expect(r.project.drumKit).toBe('classic');
      expect(r.project.tracks[0].instrument).toBe('electricPiano');
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
    bad(p => { p.tracks[0].instrument = 'kazoo'; }, /tracks\[0\]\.instrument/);
    bad(p => { p.master.eqLow = 40; }, /eqLow/);
    bad(p => { p.master.compAmount = 3; }, /compAmount/);
    bad(p => { p.drumKit = 'jazz'; }, /drumKit/);
    // names that exist on every JS object must not count as valid ids
    bad(p => { p.drumKit = 'constructor'; }, /drumKit/);
    bad(p => { p.tracks[2].instrument = 'toString'; }, /tracks\[2\]\.instrument/);
    bad(p => { p.master.reverbSize = 'hasOwnProperty'; }, /reverbSize/);
    bad(p => { p.master.delayDivision = '__proto__'; }, /delayDivision/);
    bad(p => { p.melodyView = { key: 0, scale: 'toString' }; }, /melodyView/);
    bad(p => { p.channels.kick.pan = 2; }, /pan/);
    bad(p => { p.channels.kick.solo = 'yes'; }, /solo/);
  });
  it('solo silences the other channels', () => {
    let c = defaultChannels(defaultTrackDefs());
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
    expect(p.patterns.some(x => notesFor(x, 'ambient').length > 0)).toBe(true);
    expect(p.patterns.some(x => notesFor(x, 'arp').length > 0)).toBe(true);
    expect(p.patterns.some(x => x.drums.kick.some(Boolean))).toBe(true);
    expect(p.patterns.some(x => notesFor(x, 'melody').length > 0)).toBe(true);
  });
  it('rejects a bad playlist', () => {
    bad(p => { p.playlist = []; }, /playlist/);
    bad(p => { p.playlist = [5]; }, /playlist\[0\]/);
    bad(p => { p.playlist = [-1]; }, /playlist\[0\]/);
    bad(p => { p.playlist = [0.5]; }, /playlist\[0\]/);
    bad(p => { p.playlist = Array(65).fill(0); }, /playlist/);
    bad(p => { p.patterns = []; }, /patterns/);
    bad(p => { p.patterns = Array(17).fill(clone(p.patterns[0])); }, /Too many patterns/);
  });
  it('accepts empty bars (null) in the playlist', () => {
    const p = defaultProject(); p.playlist = [0, null, 0];
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project.playlist).toEqual([0, null, 0]);
  });
  it('rejects bad arp settings', () => {
    bad(p => { p.tracks[2].arp.mode = 'sideways'; }, /arp/);
    bad(p => { p.tracks[2].arp.octaves = 5; }, /arp/);
    bad(p => { p.tracks[2].arp.gate = 0; }, /arp/);
  });
  it('a track that is muted or not soloed does not count as sound', () => {
    const p = defaultProject();
    p.patterns[0].drums = emptyDrums(); p.patterns[0].notes = { ambient: toggleNote([], 60, 0, 8) };
    expect(hasAudibleContent(p)).toBe(true);
    p.channels = patchChannel(p.channels, 'ambient', { muted: true });
    expect(hasAudibleContent(p)).toBe(false);
  });
  it('old version-1 files are upgraded to one pattern', () => {
    const old: any = {
      schemaVersion: 1, name: 'Old', bpm: 110, stepsPerBar: 16, bars: 1,
      drums: Object.fromEntries(Object.entries(defaultProject().patterns[0].drums).map(([k, v]: any) => [k, v.slice(0, 16)])), melody: makePreset('sad', 9).notes.filter(n => n.step < 16),
      channels: Object.fromEntries(CHANNEL_KEYS.slice(0, 5).map(k => [k, { volumeDb: 0, muted: false, reverbSend: 0, delaySend: 0 }])),
      melodyInstrument: 'bell', melodyView: { key: 9, scale: 'minor' }
    };
    const r = validateProject(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.schemaVersion).toBe(5);
      expect(r.project.patterns).toHaveLength(1);
      expect(r.project.playlist).toEqual([0]);
      expect(r.project.patterns[0].notes.melody).toHaveLength(old.melody.length * 2);   // the 16-step phrase plays twice in 32 steps
      expect(r.project.patterns[0].notes.melody.slice(0, old.melody.length)).toEqual(old.melody);
      expect(r.project.patterns[0].drums.kick).toEqual([...old.drums.kick, ...old.drums.kick]);
      expect(r.project.tracks.find(t => t.id === 'melody')?.instrument).toBe('bell');
      expect(r.project.channels.ambient).toBeDefined();
      expect(r.project.channels.arp).toBeDefined();
    }
  });
  it('version-1 errors are still readable', () => {
    const r = validateProject({ schemaVersion: 1, name: 'x', bpm: 100, stepsPerBar: 16, bars: 2 });
    expect(r.ok).toBe(false);
  });
});

describe('dynamic tracks (version 5)', () => {
  const v4 = () => {
    const p: any = clone(defaultProject());
    const arp = p.tracks[2].arp;
    const notes = p.patterns[0].notes;
    return {
      ...p, schemaVersion: 4, arp,
      tracks: { melody: 'bell', ambient: 'warmPad', arp: 'pluck' },
      patterns: p.patterns.map((x: any) => ({ name: x.name, drums: x.drums, melody: notes.melody ?? [], ambient: x.notes.ambient ?? [], arp: x.notes.arp ?? [] })),
      channels: Object.fromEntries(Object.entries(p.channels).filter(([k]) => k !== 'synth'))
    };
  };
  it('a version-4 file opens: tracks, notes and arp settings are converted', () => {
    const old = v4(); old.arp = { mode: 'down', rate: '8n', octaves: 2, gate: 0.5 }; old.patterns[0].arp = toggleNote([], 60, 0, 8);
    const r = validateProject(old);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.project.schemaVersion).toBe(5);
    expect(r.project.tracks.map(t => t.id)).toEqual(['melody', 'ambient', 'arp', 'synth']);
    expect(r.project.tracks[0].instrument).toBe('bell');
    expect(r.project.tracks[2].arp).toMatchObject({ mode: 'down', octaves: 2 });
    expect(notesFor(r.project.patterns[0], 'arp')).toHaveLength(1);
    expect(notesFor(r.project.patterns[0], 'melody').length).toBeGreaterThan(0);
    expect(r.project.channels.synth).toBeDefined();
  });
  it('tracks can be renamed, added and removed in a saved file', () => {
    const p = defaultProject();
    p.tracks = [...p.tracks.map(t => t.id === 'ambient' ? { ...t, name: 'Pads' } : t), { ...p.tracks[0], id: 't5', name: 'Bass line' }];
    p.channels = syncChannels(p.channels, p.tracks);
    p.patterns[0].notes.t5 = toggleNote([], 52, 0, 2);
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project).toEqual(p);
  });
  it('rejects bad track lists', () => {
    bad(p => { p.tracks = Array.from({ length: 9 }, (_, i) => ({ ...p.tracks[0], id: `x${i}` })); }, /tracks/);
    bad(p => { p.tracks[1].id = p.tracks[0].id; }, /tracks\[1\]/);
    bad(p => { p.tracks[0].id = 'kick'; }, /tracks\[0\]\.id/);
    bad(p => { p.tracks[0].id = 'lab'; }, /tracks\[0\]\.id/);
    bad(p => { p.tracks[0].id = '__proto__'; }, /tracks\[0\]\.id/);
    bad(p => { p.tracks[0].kind = 'drums'; }, /tracks\[0\]\.kind/);
    bad(p => { p.tracks[0].name = 'x'.repeat(40); }, /tracks\[0\]\.name/);
  });
  it('notes of a track that does not exist are ignored, not an error', () => {
    const p: any = clone(defaultProject()); p.patterns[0].notes.ghost = toggleNote([], 60, 0, 1);
    const r = validateProject(p);
    expect(r.ok && Object.keys(r.project.patterns[0].notes)).not.toContain('ghost');
  });
  it('deleting a track removes its notes and channel', () => {
    const p = defaultProject();
    const tracks = removeTrack(p.tracks, 'melody');
    expect(dropTrackNotes(p.patterns, 'melody')[0].notes.melody).toBeUndefined();
    expect(Object.keys(syncChannels(p.channels, tracks))).not.toContain('melody');
  });
});

describe('groove in project files', () => {
  it('is saved and opened unchanged', () => {
    const p = defaultProject(); p.groove = { swing: 0.5, humanize: 0.25, ghost: 0.1, fill: 1 };
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project.groove).toEqual(p.groove);
  });
  it('older files without a groove open as straight', () => {
    const p: any = clone(defaultProject()); delete p.groove;
    const r = validateProject(p);
    expect(r.ok && r.project.groove).toEqual({ swing: 0, humanize: 0, ghost: 0, fill: 0 });
  });
  it('rejects a broken groove', () => {
    bad(p => { p.groove = { swing: 3, humanize: 0, ghost: 0, fill: 0 }; }, /groove\.swing/);
    bad(p => { p.groove = 'swing'; }, /groove/);
    bad(p => { p.groove = { swing: 0 }; }, /groove/);
  });
  it('the genre demos have their own groove, the basic samples stay straight', () => {
    expect(SAMPLE_PROJECTS['Lo-Fi Chill']().groove.swing).toBeGreaterThan(0);
    expect(SAMPLE_PROJECTS['Hip Hop Demo']().groove.ghost).toBeGreaterThan(0);
    expect(SAMPLE_PROJECTS['Basic House Beat']().groove).toEqual({ swing: 0, humanize: 0, ghost: 0, fill: 0 });
  });
});

describe('sections in project files', () => {
  it('are saved and opened unchanged', () => {
    const p = defaultProject(); p.playlist = [0, 0, 0, null]; p.sections = [{ name: 'Intro', start: 0, length: 2 }, { name: 'Verse', start: 2, length: 2 }];
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project.sections).toEqual(p.sections);
  });
  it('older files open with no sections', () => {
    const p: any = clone(defaultProject()); delete p.sections;
    const r = validateProject(p);
    expect(r.ok && r.project.sections).toEqual([]);
  });
  it('rejects broken sections', () => {
    bad(p => { p.sections = 'x'; }, /sections/);
    bad(p => { p.sections = [{ name: '', start: 0, length: 1 }]; }, /sections/);
  });
  it('the demos come with named sections', () => {
    expect(SAMPLE_PROJECTS['Hip Hop Demo']().sections.length).toBeGreaterThan(0);
  });
});

describe('startup song', () => {
  it('is valid, has drums in every pattern group, several patterns and a multi-bar playlist', () => {
    const p = startupProject();
    expect(parseProject(serializeProject(p)).ok).toBe(true);
    expect(p.patterns.length).toBeGreaterThanOrEqual(3);
    expect(p.playlist.length).toBeGreaterThanOrEqual(8);
    expect(p.patterns[0].drums.kick.some(Boolean)).toBe(true);
    expect(p.patterns[1].drums.kick.some(Boolean)).toBe(true);
    expect(hasAudibleContent(p)).toBe(true);
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
    p.patterns[0].drums = emptyDrums(); p.patterns[0].notes = {};
    expect(hasAudibleContent(p)).toBe(false);
    p.patterns[0].notes = { melody: toggleNote([], 60, 0, 1) };
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
    const c = defaultChannels(defaultTrackDefs());
    const d = patchChannel(c, 'snare', { muted: true, volumeDb: -200 });
    expect(c.snare.muted).toBe(false);
    expect(d.snare).toMatchObject({ muted: true, volumeDb: -40 });
    expect(d.kick).toEqual(c.kick);
  });
});
