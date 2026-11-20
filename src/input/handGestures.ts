// Hand gestures from the 21 landmarks of one hand (the MediaPipe hand model). Pure maths, no camera and no browser, so it can be unit-tested.
// Landmark numbers: 0 wrist · thumb 1-4 (4 = tip) · index 5-8 · middle 9-12 · ring 13-16 · pinky 17-20 (the last of each finger is its tip).
// x and y are 0..1 over the picture, y grows DOWNWARD.

export type LM = { x: number; y: number; z?: number };

/** open = flat hand · fist · thumbUp / thumbDown · point = index finger up · victory = ✌ · ell = thumb + index spread (👆👍) · pinch = OK sign 👌 (thumb tip touches index tip) */
export type GestureId = 'open' | 'fist' | 'thumbUp' | 'thumbDown' | 'point' | 'victory' | 'ell' | 'pinch' | 'none';

export const GESTURE_LABEL: Record<GestureId, string> = {
  open: '✋ OPEN PALM', fist: '✊ FIST', thumbUp: '👍 THUMB UP', thumbDown: '👎 THUMB DOWN', point: '☝️ INDEX UP', victory: '✌️ VICTORY', ell: '👆👍 L-SHAPE', pinch: '👌 OK / PINCH', none: '—'
};

const dist = (a: LM, b: LM) => Math.hypot(a.x - b.x, a.y - b.y);

/** Size of the hand in the picture (wrist → base of the middle finger). Everything is measured relative to it, so distance from the camera does not matter. */
export const handSize = (lm: LM[]): number => Math.max(1e-6, dist(lm[0], lm[9]));

/** A finger is straight when its tip is clearly farther from the wrist than its middle joint (works for any hand rotation). */
const straight = (lm: LM[], tip: number, pip: number) => dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.08;

export type Fingers = { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean };
export function fingers(lm: LM[]): Fingers {
  const size = handSize(lm);
  return {
    thumb: dist(lm[4], lm[5]) > size * 0.55,          // the thumb tip is away from the base of the index finger
    index: straight(lm, 8, 6), middle: straight(lm, 12, 10), ring: straight(lm, 16, 14), pinky: straight(lm, 20, 18)
  };
}

/** Thumb tip ↔ index tip distance in hand sizes (0 = touching). Used for the pinch and for the L-shape "spread". */
export const spread = (lm: LM[]): number => dist(lm[4], lm[8]) / handSize(lm);

export function classify(lm: LM[]): GestureId {
  if (!lm || lm.length < 21) return 'none';
  const f = fingers(lm); const size = handSize(lm); const sp = spread(lm);
  const others = [f.middle, f.ring, f.pinky].filter(Boolean).length;
  const four = [f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;
  if (sp < 0.3 && others >= 1) return 'pinch';
  if (four === 4) return 'open';
  if (four === 0) {
    if (!f.thumb) return 'fist';
    if (lm[4].y > lm[0].y + size * 0.4 && lm[4].y > lm[3].y) return 'thumbDown';
    if (lm[4].y < lm[0].y && lm[4].y < lm[3].y) return 'thumbUp';
    return 'none';
  }
  if (f.index && others === 0) return f.thumb && sp > 0.8 ? 'ell' : 'point';
  if (f.index && f.middle && !f.ring && !f.pinky) return 'victory';
  return 'none';
}

/** Centre of the palm (wrist and the four finger bases). */
export const palmCenter = (lm: LM[]): { x: number; y: number } => {
  const ids = [0, 5, 9, 13, 17];
  return { x: ids.reduce((s, i) => s + lm[i].x, 0) / ids.length, y: ids.reduce((s, i) => s + lm[i].y, 0) / ids.length };
};
