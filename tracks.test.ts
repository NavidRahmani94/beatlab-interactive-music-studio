import { describe, expect, it } from 'vitest';
import { MAX_TRACKS, MAX_TRACK_NAME, addTrack, cleanTrackName, defaultTrackDefs, isValidTrackId, nextTrackId, nextTrackName, removeTrack, renameTrackLive, updateTrack } from './tracks';
import { channelGroups, channelLabel, defaultChannels, syncChannels } from './mixer';

describe('track list', () => {
  it('a new project has Melody, Ambient, Arpeggio and Synth', () => {
    expect(defaultTrackDefs().map(t => [t.id, t.kind, t.name])).toEqual([['melody', 'melody', 'Melody'], ['ambient', 'ambient', 'Ambient'], ['arp', 'arp', 'Arpeggio'], ['synth', 'synth', 'Synth']]);
  });
  it('addTrack gives unique ids and names, and stops at the limit', () => {
    let t = defaultTrackDefs();
    t = addTrack(t, 'melody');
    expect(t[4]).toMatchObject({ kind: 'melody', name: 'Melody 2' });
    t = addTrack(t, 'synth');
    expect(new Set(t.map(x => x.id)).size).toBe(t.length);
    while (t.length < MAX_TRACKS) t = addTrack(t, 'arp');
    expect(addTrack(t, 'melody')).toBe(t);
    expect(new Set(t.map(x => x.name)).size).toBe(t.length);
  });
  it('ids are never reused after a delete', () => {
    let t = addTrack(defaultTrackDefs(), 'melody');           // t5
    t = removeTrack(t, 'melody');
    expect(nextTrackId(t)).not.toBe('melody');
    expect(t.some(x => x.id === nextTrackId(t))).toBe(false);
  });
  it('any track can be removed, even all of them', () => {
    let t = defaultTrackDefs();
    ['melody', 'ambient', 'arp', 'synth'].forEach(id => { t = removeTrack(t, id); });
    expect(t).toEqual([]);
  });
  it('rename trims, limits the length and never leaves a track nameless', () => {
    const t = defaultTrackDefs();
    expect(updateTrack(t, 'melody', { name: '  Lead   guitar ' })[0].name).toBe('Lead guitar');
    expect(updateTrack(t, 'melody', { name: '   ' })[0].name).toBe('Melody');
    expect(cleanTrackName('x'.repeat(50), 'a')).toHaveLength(MAX_TRACK_NAME);
    expect(renameTrackLive(t, 'ambient', '')[1].name).toBe('');   // while typing
    expect(nextTrackName(t, 'ambient')).toBe('Ambient 2');
  });
  it('reserved words are not valid ids', () => {
    ['drums', 'lab', 'kick', 'hat', '__proto__', 'constructor', 'Bad Id', '', 'x'.repeat(25)].forEach(id => expect(isValidTrackId(id), id).toBe(false));
    ['melody', 't9', 'bass-2'].forEach(id => expect(isValidTrackId(id), id).toBe(true));
  });
});

describe('mixer follows the track list', () => {
  it('channels: drums + one per track, labels use the track name', () => {
    const t = updateTrack(defaultTrackDefs(), 'ambient', { name: 'Pads' });
    expect(Object.keys(defaultChannels(t))).toEqual(['kick', 'snare', 'hat', 'clap', 'melody', 'ambient', 'arp', 'synth']);
    expect(channelLabel('ambient', t)).toBe('PADS');
    expect(channelGroups(t)).toHaveLength(5);
  });
  it('syncChannels adds new tracks, drops deleted ones, keeps settings', () => {
    const t = defaultTrackDefs();
    const c = defaultChannels(t); c.melody = { ...c.melody, volumeDb: -7 };
    const t2 = addTrack(removeTrack(t, 'arp'), 'melody');
    const c2 = syncChannels(c, t2);
    expect(c2.arp).toBeUndefined();
    expect(c2.melody.volumeDb).toBe(-7);
    expect(c2[t2[t2.length - 1].id]).toBeDefined();
    expect(syncChannels(c2, t2)).toBe(c2);
  });
});
