import { describe, expect, it } from 'vitest';
import { classify, LM, spread } from './handGestures';
import { EXPERIMENTAL_FEATURES, HAND_FEATURES, HandAction, HandController } from './handControl';

// A synthetic hand in "hand sizes" (wrist → middle finger base = 1), fingers pointing up (y goes down the picture).
type Pose = { thumb: 'folded' | 'out' | 'up' | 'down'; fingers: [boolean, boolean, boolean, boolean]; pinch?: boolean };
function hand(pose: Pose, cx = 0.5, cy = 0.6, size = 0.2): LM[] {
  const P = (x: number, y: number): LM => ({ x: cx + x * size, y: cy + y * size });
  const lm: LM[] = new Array(21);
  lm[0] = P(0, 0);
  const mcp: [number, number][] = [[-0.35, -0.95], [0, -1], [0.3, -0.95], [0.6, -0.85]];   // index, middle, ring, pinky
  mcp.forEach(([x, y], i) => {
    const b = 5 + i * 4; const ext = pose.fingers[i];
    lm[b] = P(x, y);
    lm[b + 1] = ext ? P(x, y - 0.4) : P(x, y - 0.3);
    lm[b + 2] = ext ? P(x, y - 0.65) : P(x, y - 0.05);
    lm[b + 3] = ext ? P(x, y - 0.9) : P(x, y + 0.2);
  });
  lm[1] = P(-0.3, -0.2); lm[2] = P(-0.55, -0.45);
  if (pose.thumb === 'folded') { lm[3] = P(-0.2, -0.55); lm[4] = P(-0.05, -0.6); }
  else if (pose.thumb === 'out') { lm[3] = P(-0.8, -0.6); lm[4] = P(-1.1, -0.75); }
  else if (pose.thumb === 'up') { lm[3] = P(-0.7, -1.1); lm[4] = P(-0.9, -1.5); }
  else { lm[3] = P(-0.65, 0.5); lm[4] = P(-0.7, 0.9); }
  if (pose.pinch) lm[4] = P(lm[8].x === undefined ? 0 : (lm[8].x - cx) / size + 0.02, (lm[8].y - cy) / size + 0.02);
  return lm;
}
const OPEN = hand({ thumb: 'out', fingers: [true, true, true, true] });
const FIST = hand({ thumb: 'folded', fingers: [false, false, false, false] });
// x of the controller is mirrored (1 - x): put hands where the test wants them *after* mirroring
const at = (pose: Pose, x: number, y: number) => hand(pose, 1 - x, y);

describe('gesture classification', () => {
  it('recognises the basic hand shapes', () => {
    expect(classify(OPEN)).toBe('open');
    expect(classify(FIST)).toBe('fist');
    expect(classify(hand({ thumb: 'up', fingers: [false, false, false, false] }))).toBe('thumbUp');
    expect(classify(hand({ thumb: 'down', fingers: [false, false, false, false] }))).toBe('thumbDown');
    expect(classify(hand({ thumb: 'folded', fingers: [true, false, false, false] }))).toBe('point');
    expect(classify(hand({ thumb: 'folded', fingers: [true, true, false, false] }))).toBe('victory');
    expect(classify(hand({ thumb: 'out', fingers: [true, false, false, false] }))).toBe('ell');
    expect(classify(hand({ thumb: 'out', fingers: [true, true, true, true], pinch: true }))).toBe('pinch');
  });
  it('does not depend on how big the hand is or where it is', () => {
    expect(classify(hand({ thumb: 'out', fingers: [true, true, true, true] }, 0.2, 0.3, 0.08))).toBe('open');
    expect(classify(hand({ thumb: 'folded', fingers: [false, false, false, false] }, 0.8, 0.8, 0.3))).toBe('fist');
  });
  it('is rotation proof (a hand turned sideways is still an open palm)', () => {
    const rot = OPEN.map(p => ({ x: 0.5 + (p.y - 0.6), y: 0.6 - (p.x - 0.5) }));
    expect(classify(rot)).toBe('open');
  });
  it('wrong input gives "none"', () => { expect(classify([])).toBe('none'); expect(spread(OPEN)).toBeGreaterThan(0.3); });
});

// run a controller over a list of (ms, hands) frames and collect the actions
function run(c: HandController, frames: { t: number; hands: LM[][] }[]): HandAction[] { return frames.flatMap(f => c.update(f.t, f.hands).actions); }
const hold = (hands: LM[][], from: number, to: number, step = 40) => { const out: { t: number; hands: LM[][] }[] = []; for (let t = from; t <= to; t += step) out.push({ t, hands }); return out; };

describe('hand controller', () => {
  it('for now only PLAY / STOP is offered and switched on by default; the other gestures do nothing', () => {
    expect(HAND_FEATURES.map(f => f.id)).toEqual(['playStop']);
    const c = new HandController(); const up = [at({ thumb: 'up', fingers: [false, false, false, false] }, 0.5, 0.5)];
    expect(run(c, hold(up, 0, 2000))).toEqual([]);
    const o = run(c, hold([at({ thumb: 'out', fingers: [true, true, true, true] }, 0.5, 0.5)], 2100, 3500)); expect(o.map(x => x.type)).toEqual(['play']);
  });
  it('open palm held still = PLAY once; fist held = STOP once', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); const h = [at({ thumb: 'out', fingers: [true, true, true, true] }, 0.5, 0.5)];
    const a = run(c, hold(h, 0, 1500)); expect(a.filter(x => x.type === 'play')).toHaveLength(1);
    const f = [at({ thumb: 'folded', fingers: [false, false, false, false] }, 0.5, 0.5)];
    const b = run(c, hold(f, 1600, 3000)); expect(b.filter(x => x.type === 'stop')).toHaveLength(1);
  });
  it('a short flash of a gesture does nothing', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); expect(run(c, hold([at({ thumb: 'out', fingers: [true, true, true, true] }, 0.5, 0.5)], 0, 300))).toEqual([]);
  });
  it('thumb up / down changes the tempo repeatedly', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES);
    const up = run(c, hold([at({ thumb: 'up', fingers: [false, false, false, false] }, 0.5, 0.5)], 0, 2000)); expect(up.length).toBeGreaterThan(5); expect(up.every(x => x.type === 'tempo' && x.delta === 1)).toBe(true);
    const dn = run(c, hold([at({ thumb: 'down', fingers: [false, false, false, false] }, 0.5, 0.5)], 2100, 4000)); expect(dn.every(x => x.type === 'tempo' && x.delta === -1)).toBe(true); expect(dn.length).toBeGreaterThan(5);
  });
  it('index finger up: hand height = master volume (high = loud)', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); const pose: Pose = { thumb: 'folded', fingers: [true, false, false, false] };
    const hi = run(c, hold([at(pose, 0.5, 0.2)], 0, 1500)).filter((x): x is Extract<HandAction, { type: 'volume' }> => x.type === 'volume');
    const c2 = new HandController(EXPERIMENTAL_FEATURES); const lo = run(c2, hold([at(pose, 0.5, 0.8)], 0, 1500)).filter((x): x is Extract<HandAction, { type: 'volume' }> => x.type === 'volume');
    expect(hi[hi.length - 1].db).toBeGreaterThan(-8); expect(lo[lo.length - 1].db).toBeLessThan(-30);
  });
  it('L-shape: wider = brighter (treble up)', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES);
    const wide = hand({ thumb: 'out', fingers: [true, false, false, false] }, 1 - 0.5, 0.5);
    const a = run(c, hold([wide], 0, 1500)).filter((x): x is Extract<HandAction, { type: 'tone' }> => x.type === 'tone'); expect(a.length).toBeGreaterThan(0);
  });
  it('victory held one second = mute', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); const a = run(c, hold([at({ thumb: 'folded', fingers: [true, true, false, false] }, 0.5, 0.5)], 0, 1600)); expect(a.filter(x => x.type === 'mute')).toHaveLength(1);
  });
  it('a quick sideways swipe of a flat hand changes the pattern (and does not start the music)', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); const frames: { t: number; hands: LM[][] }[] = [];
    for (let i = 0; i <= 8; i++) frames.push({ t: i * 40, hands: [at({ thumb: 'out', fingers: [true, true, true, true] }, 0.2 + i * 0.075, 0.5)] });
    const a = run(c, frames); expect(a.find(x => x.type === 'pattern')).toEqual({ type: 'pattern', delta: 1 }); expect(a.some(x => x.type === 'play')).toBe(false);
    const c2 = new HandController(EXPERIMENTAL_FEATURES); const left: { t: number; hands: LM[][] }[] = [];
    for (let i = 0; i <= 8; i++) left.push({ t: i * 40, hands: [at({ thumb: 'out', fingers: [true, true, true, true] }, 0.8 - i * 0.075, 0.5)] });
    expect(run(c2, left).find(x => x.type === 'pattern')).toEqual({ type: 'pattern', delta: -1 });
  });
  it('slow movement is not a swipe, and a moving palm does not trigger PLAY', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); const frames: { t: number; hands: LM[][] }[] = [];
    for (let i = 0; i <= 40; i++) frames.push({ t: i * 40, hands: [at({ thumb: 'out', fingers: [true, true, true, true] }, 0.3 + i * 0.01, 0.5)] });
    expect(run(c, frames).filter(x => x.type === 'pattern')).toEqual([]);
  });
  it('second hand on the left: open palm height = reverb', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); const left = at({ thumb: 'out', fingers: [true, true, true, true] }, 0.2, 0.2); const right = at({ thumb: 'folded', fingers: [false, false, false, false] }, 0.75, 0.5);
    const a = run(c, hold([left, right], 0, 800)).filter((x): x is Extract<HandAction, { type: 'reverb' }> => x.type === 'reverb'); expect(a.length).toBeGreaterThan(0); expect(a[a.length - 1].mix).toBeGreaterThan(0.5);
  });
  it('AIR PIANO: OK sign plays the note under the hand, opening the hand releases it', () => {
    const c = new HandController(EXPERIMENTAL_FEATURES); c.setAirNotes([60, 62, 64, 65, 67, 69, 71, 72]);
    const pinch = (x: number) => [at({ thumb: 'out', fingers: [true, true, true, true], pinch: true }, x, 0.4)];
    const a = run(c, hold(pinch(0.0), 0, 300)); const on = a.find(x => x.type === 'airOn'); expect(on).toMatchObject({ type: 'airOn', midi: 60 });
    const b = run(c, hold([at({ thumb: "out", fingers: [true, true, true, true] }, 0.0, 0.4)], 340, 500)); expect(b).toContainEqual({ type: 'airOff', midi: 60 });
    const c2 = new HandController(EXPERIMENTAL_FEATURES); c2.setAirNotes([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(run(c2, hold(pinch(0.95), 0, 300)).find(x => x.type === 'airOn')).toMatchObject({ midi: 72 });
  });
  it('switched-off functions do nothing; reset releases a held air note', () => {
    const c = new HandController([]); expect(run(c, hold([at({ thumb: 'out', fingers: [true, true, true, true] }, 0.5, 0.5)], 0, 1500))).toEqual([]);
    const d = new HandController(['air']); d.setAirNotes([60, 62]); run(d, hold([at({ thumb: 'out', fingers: [true, true, true, true], pinch: true }, 0.2, 0.4)], 0, 300)); expect(d.reset()).toEqual([{ type: 'airOff', midi: 60 }]);
  });
  it('no hand: status says so', () => { const c = new HandController(EXPERIMENTAL_FEATURES); const s = c.update(0, []).status; expect(s.gesture).toBe('none'); expect(s.hands).toBe(0); });
});
