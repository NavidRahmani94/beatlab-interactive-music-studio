import { describe, expect, it } from 'vitest';
import { FX_IDS, MAX_FX, addFx, fxSignature, moveFx, patchFx, removeFx, validateFx } from './fx';
import { toggleNote, transposeNotes, MelodyNote, isSlideTarget, slideCents, slidePath, slideTarget, toggleSlide } from './melody';
import { defaultProject, parseProject, serializeProject } from './project';

describe('insert effects', () => {
  it('has 10 effects', () => { expect(FX_IDS.length).toBe(10); });
  it('adds up to the limit, removes, reorders and patches', () => {
    let l = addFx(undefined, 'chorus'); l = addFx(l, 'distortion'); l = addFx(l, 'phaser'); l = addFx(l, 'widener'); l = addFx(l, 'tremolo');
    expect(l.length).toBe(MAX_FX);
    expect(new Set(l.map(f => f.id)).size).toBe(MAX_FX);
    const id = l[2].id; expect(moveFx(l, id, -1)[1].id).toBe(id); expect(moveFx(l, l[0].id, -1)).toEqual(l);
    expect(patchFx(l, id, { amount: 5 }).find(f => f.id === id)!.amount).toBe(1);
    expect(patchFx(l, id, { type: 'nope' as never }).find(f => f.id === id)!.type).toBe('phaser');
    expect(removeFx(l, id).length).toBe(MAX_FX - 1);
  });
  it('bypassed effects are not part of the chain signature', () => {
    let l = addFx(addFx(undefined, 'chorus'), 'flanger'); const a = fxSignature(l);
    l = patchFx(l, l[1].id, { on: false }); expect(fxSignature(l)).not.toBe(a); expect(fxSignature(l)).toBe(fxSignature([l[0]]));
    expect(fxSignature(patchFx(l, l[0].id, { amount: 0.9 }))).toBe(fxSignature(l));   // moving a knob never rebuilds the chain
  });
  it('validates saved effects', () => {
    expect(validateFx([{ id: 'fx1', type: 'chorus', amount: 0.5, on: true }]).ok).toBe(true);
    expect(validateFx([{ id: 'fx1', type: 'reverbX', amount: 0.5, on: true }]).ok).toBe(false);
    expect(validateFx([{ id: 'fx1', type: 'chorus', amount: 2, on: true }]).ok).toBe(false);
    expect(validateFx([{ id: 'a', type: 'chorus', amount: 0, on: true }, { id: 'a', type: 'chorus', amount: 0, on: true }]).ok).toBe(false);
    expect(validateFx(Array(5).fill({ id: 'x', type: 'chorus', amount: 0, on: true })).ok).toBe(false);
  });
  it('effects are saved in the project and old files have none', () => {
    const p = defaultProject(); p.channels = { ...p.channels, melody: { ...p.channels.melody, fx: addFx(undefined, 'bitcrusher') } };
    const back = parseProject(serializeProject(p)); expect(back.ok && back.project.channels.melody.fx?.[0].type).toBe('bitcrusher');
    const plain = parseProject(serializeProject(defaultProject())); expect(plain.ok && plain.project.channels.melody.fx).toBeUndefined();
  });
});

describe('slide notes', () => {
  const n = (id: string, pitch: string, step: number, slide = false): MelodyNote => ({ id, pitch, step, lengthSteps: 2, velocity: 0.8, ...(slide ? { slide: true } : {}) });
  it('toggles on and off', () => {
    const a = [n('a', 'C4', 0)]; const on = toggleSlide(a, 'a'); expect(on[0].slide).toBe(true); expect('slide' in toggleSlide(on, 'a')[0]).toBe(false); expect(toggleSlide(a, 'zz')).toBe(a);
  });
  it('glides toward the next note (closest pitch at the same step)', () => {
    const notes = [n('a', 'C4', 0, true), n('b', 'G4', 4), n('c', 'E4', 4), n('d', 'C5', 8)];
    expect(slideTarget(notes, notes[0])?.id).toBe('c'); expect(slideCents(notes, notes[0])).toBe(400);
    expect(slideCents([n('a', 'E4', 0, true), n('b', 'C4', 4)], n('a', 'E4', 0, true))).toBe(-400);
  });
  it('has no glide without the flag or without a next note', () => {
    expect(slideCents([n('a', 'C4', 0), n('b', 'G4', 4)], n('a', 'C4', 0))).toBe(0);
    expect(slideCents([n('a', 'C4', 0, true)], n('a', 'C4', 0, true))).toBe(0);
  });
  it('is limited to two octaves', () => { expect(slideCents([n('a', 'C3', 0, true), n('b', 'C6', 4)], n('a', 'C3', 0, true))).toBe(2400); });
  it('is saved in the project file', () => {
    const p = defaultProject(); p.patterns[0].notes = { melody: [n('a', 'C4', 0, true), n('b', 'D4', 4)] };
    const back = parseProject(serializeProject(p)); expect(back.ok && back.project.patterns[0].notes.melody?.[0].slide).toBe(true);
    expect(back.ok && back.project.patterns[0].notes.melody?.[1].slide).toBeUndefined();
  });

  it('a slide note is silent and bends the sounding note to its pitch', () => {
    const notes = [n('a', 'C4', 0), n('b', 'E4', 2, true)];          // a: steps 0-1, slide note starts where a ends
    const sp = slidePath(notes, notes[0])!;
    expect(sp.skip).toEqual(['b']); expect(isSlideTarget(notes, notes[1])).toBe(true); expect(isSlideTarget(notes, notes[0])).toBe(false);
    expect(sp.endStep).toBe(4);                                      // the sound is held until the slide note ends
    expect(sp.path).toEqual([{ at: 2, cents: 0 }, { at: 4, cents: 400 }]);
  });
  it('a slide note inside a long note bends it', () => {
    const notes = [{ ...n('a', 'C4', 0), lengthSteps: 8 }, n('b', 'G4', 3, true)];
    const sp = slidePath(notes, notes[0])!; expect(sp.endStep).toBe(8); expect(sp.path).toEqual([{ at: 3, cents: 0 }, { at: 5, cents: 700 }]);
  });
  it('slide notes one after another continue the glide', () => {
    const notes = [n('a', 'C4', 0), n('b', 'E4', 2, true), n('c', 'C4', 4, true)];
    const sp = slidePath(notes, notes[0])!;
    expect(sp.skip).toEqual(['b', 'c']); expect(sp.endStep).toBe(6);
    expect(sp.path.map(k => k.cents)).toEqual([0, 400, 400, 0]);
  });
  it('adding, removing, transposing notes keeps the slide flag of the other notes', () => {
    let notes = toggleNote([], 60, 0, 2); notes = toggleNote(notes, 64, 2, 2); notes = toggleSlide(notes, notes[1].id);
    notes = toggleNote(notes, 67, 6, 2); expect(notes.find(x => x.pitch === 'E4')?.slide).toBe(true);
    notes = toggleNote(notes, 67, 6, 2); expect(notes.find(x => x.pitch === 'E4')?.slide).toBe(true);
    expect(transposeNotes(notes, 2).find(x => x.pitch === 'F#4')?.slide).toBe(true);
  });
  it('a slide note with nothing to bend is played as a normal note; slide notes have no path of their own', () => {
    const lone = [n('a', 'C4', 0, true)]; expect(isSlideTarget(lone, lone[0])).toBe(false); expect(slidePath(lone, lone[0])).toBeNull();
    expect(slidePath([n('a', 'C4', 0)], n('a', 'C4', 0))).toBeNull();
    const far = [n('a', 'C4', 0), n('b', 'E4', 5, true)]; expect(isSlideTarget(far, far[1])).toBe(false);   // gap: nothing sounding
  });
});
