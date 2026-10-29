import { describe, expect, it } from 'vitest';
import {
  FACTORY_IDS, FACTORY_SOUNDS, LIMITS, MAX_SYNTHS, SOUND_GROUPS, addSynth, clampPatch, customId, customRef, defaultPatch, isCustomRef, makePatch,
  nextSynthId, randomPatch, removeSynth, updateSynth, validatePatch, validateSynths
} from './synth';
import { MELODY_INSTRUMENT_IDS, MELODY_INSTRUMENTS, CLASSIC_IDS, DRUM_KIT_IDS, instrumentGroups, isMelodyInstrument } from './instruments';
import { defaultProject, parseProject, serializeProject, validateProject } from './project';

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('synth patches', () => {
  it('the default patch is valid', () => {
    expect(validatePatch(defaultPatch()).ok).toBe(true);
  });
  it('every library sound is a valid patch with a known group', () => {
    expect(FACTORY_IDS.length).toBeGreaterThanOrEqual(60);
    FACTORY_IDS.forEach(id => {
      const f = FACTORY_SOUNDS[id];
      const r = validatePatch(f.patch);
      expect(r.ok, `${id}: ${r.ok ? '' : r.error}`).toBe(true);
      expect(SOUND_GROUPS).toContain(f.group);
      expect(f.label.length).toBeGreaterThan(0);
    });
  });
  it('library ids do not clash with the older built-in sounds, and all are selectable instruments', () => {
    FACTORY_IDS.forEach(id => expect(CLASSIC_IDS).not.toContain(id));
    expect(new Set(MELODY_INSTRUMENT_IDS).size).toBe(MELODY_INSTRUMENT_IDS.length);
    expect(MELODY_INSTRUMENT_IDS.length).toBe(CLASSIC_IDS.length + FACTORY_IDS.length);
    MELODY_INSTRUMENT_IDS.forEach(id => expect(MELODY_INSTRUMENTS[id].group).toBeTruthy());
    expect(instrumentGroups().flatMap(g => g.ids).sort()).toEqual([...MELODY_INSTRUMENT_IDS].sort());
    expect(isMelodyInstrument('santur') && isMelodyInstrument('supersaw') && isMelodyInstrument('bell')).toBe(true);
    expect(isMelodyInstrument('synth:s1')).toBe(false);
  });
  it('covers many styles, including Persian instruments', () => {
    ['santur', 'tar', 'ney', 'kamancheh', 'oud', 'rhodes', 'organ', 'acidBass', 'subBass', 'violin', 'trumpet', 'chipSquare'].forEach(id => expect(FACTORY_IDS).toContain(id));
    expect(DRUM_KIT_IDS.length).toBeGreaterThanOrEqual(10);
  });
  it('rejects broken patches with a readable message', () => {
    const bad = (fn: (p: any) => void, re: RegExp) => { const p: any = JSON.parse(JSON.stringify(defaultPatch())); fn(p); const r = validatePatch(p); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toMatch(re); };
    bad(p => { p.osc1.wave = 'toString'; }, /osc1\.wave/);
    bad(p => { p.osc2.octave = 9; }, /osc2\.octave/);
    bad(p => { p.osc1.level = 2; }, /level/);
    bad(p => { p.unison = 6; }, /unison/);
    bad(p => { p.unison = 2.5; }, /unison/);
    bad(p => { p.filter.cutoff = 5; }, /filter/);
    bad(p => { p.filter.rolloff = 48; }, /filter/);
    bad(p => { p.ampEnv.a = 0; }, /attack/);
    bad(p => { p.filterEnv.s = 2; }, /sustain/);
    bad(p => { p.lfo.target = 'nope'; }, /lfo/);
    bad(p => { p.noiseColor = 'blue'; }, /noiseColor/);
    bad(p => { p.volumeDb = 99; }, /volumeDb/);
    bad(p => { p.transpose = 1.5; }, /transpose/);
    bad(p => { p.drive = NaN; }, /drive/);
    bad(p => { p.osc1 = 5; }, /osc1/);
    expect(validatePatch(null).ok).toBe(false);
    expect(validatePatch([]).ok).toBe(false);
  });
  it('clampPatch forces everything into range', () => {
    const wild: any = makePatch({});
    wild.filter.cutoff = 1e9; wild.filter.resonance = -4; wild.ampEnv.a = -1; wild.ampEnv.r = 99; wild.unison = 17.4; wild.volumeDb = 99; wild.transpose = 200.6; wild.osc1.octave = 7.2;
    const c = clampPatch(wild);
    expect(validatePatch(c).ok).toBe(true);
    expect(c.filter.cutoff).toBe(LIMITS.cutoff[1]);
    expect(c.unison).toBe(5);
    expect(c.osc1.octave).toBe(3);
  });
  it('random patches are always valid and audible, and repeatable for a given seed', () => {
    for (let i = 0; i < 200; i++) {
      const p = randomPatch(seeded(i + 1));
      expect(validatePatch(p).ok).toBe(true);
      expect(p.osc1.level + p.osc2.level + p.noise).toBeGreaterThan(0.5);
    }
    expect(randomPatch(seeded(7))).toEqual(randomPatch(seeded(7)));
  });
});

describe('the list of user synths', () => {
  it('adds, renames, removes and gives unique ids', () => {
    let list = addSynth([], 'Lead', defaultPatch());
    list = addSynth(list, 'Bass', defaultPatch());
    expect(list.map(s => s.id)).toEqual(['s1', 's2']);
    list = removeSynth(list, 's1');
    expect(nextSynthId(list)).toBe('s2' === list[0].id ? 's3' : 's2');
    list = updateSynth(list, 's2', s => ({ ...s, name: 'Renamed' }));
    expect(list[0].name).toBe('Renamed');
    expect(isCustomRef(customRef('s2'))).toBe(true);
    expect(customId(customRef('s2'))).toBe('s2');
    expect(isCustomRef('bell')).toBe(false);
  });
  it('stops at the maximum', () => {
    let list = [] as ReturnType<typeof addSynth>;
    for (let i = 0; i < MAX_SYNTHS + 3; i++) list = addSynth(list, `S${i}`, defaultPatch());
    expect(list).toHaveLength(MAX_SYNTHS);
  });
  it('validates a list from a file', () => {
    expect(validateSynths(undefined)).toEqual({ ok: true, synths: [] });
    expect(validateSynths('x').ok).toBe(false);
    expect(validateSynths([{ id: 'A B', name: 'x', patch: defaultPatch() }]).ok).toBe(false);
    expect(validateSynths([{ id: 'a', name: 'x', patch: defaultPatch() }, { id: 'a', name: 'y', patch: defaultPatch() }]).ok).toBe(false);
    expect(validateSynths([{ id: 'a', name: 'x', patch: { ...defaultPatch(), unison: 99 } }]).ok).toBe(false);
    expect(validateSynths(Array.from({ length: MAX_SYNTHS + 1 }, (_, i) => ({ id: `s${i}`, name: 'x', patch: defaultPatch() }))).ok).toBe(false);
    expect(validateSynths([{ id: 'a', name: 'x', patch: defaultPatch() }]).ok).toBe(true);
  });
});

describe('synths inside a project file', () => {
  const withSynth = () => {
    const p = defaultProject();
    p.synths = addSynth([], 'My lead', makePatch({ osc1: { wave: 'square' }, chorus: 0.4 }));
    p.tracks = { ...p.tracks, melody: customRef(p.synths[0].id) };
    return p;
  };
  it('survive save and open unchanged', () => {
    const p = withSynth();
    const r = parseProject(serializeProject(p));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.project.synths).toEqual(p.synths); expect(r.project.tracks.melody).toBe('synth:s1'); expect(r.project.schemaVersion).toBe(4); }
  });
  it('a track may not use a synth that is not in the file', () => {
    const p: any = JSON.parse(serializeProject(withSynth()));
    p.synths = [];
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/synth "s1"/);
  });
  it('version-3 files (without synths) still open', () => {
    const p: any = JSON.parse(serializeProject(defaultProject()));
    p.schemaVersion = 3; delete p.synths;
    const r = validateProject(p);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.project.synths).toEqual([]); expect(r.project.schemaVersion).toBe(4); }
  });
  it('a broken synth in the file is reported', () => {
    const p: any = JSON.parse(serializeProject(withSynth()));
    p.synths[0].patch.filter.cutoff = 1;
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/synths\[0\]\.patch\.filter/);
  });
  it('library sounds and every drum kit are accepted by the project check', () => {
    const p: any = JSON.parse(serializeProject(defaultProject()));
    FACTORY_IDS.forEach(id => { p.tracks.melody = id; expect(validateProject(p).ok, id).toBe(true); });
    DRUM_KIT_IDS.forEach(k => { p.drumKit = k; expect(validateProject(p).ok, k).toBe(true); });
  });
});
