// AIR CONTROL: turns hand frames (landmarks of the hands the camera sees) into music actions. Pure logic with an injected clock (the `t` of every frame),
// so the whole thing is unit-tested without a camera. The camera + model part is in handTracker.ts, the panel in HandPanel.tsx.
import { GESTURE_LABEL, GestureId, LM, classify, palmCenter, spread } from './handGestures';

export type HandFeature = 'playStop' | 'tempo' | 'volume' | 'tone' | 'reverb' | 'pattern' | 'mute' | 'air';

export type HandAction =
  | { type: 'play' } | { type: 'stop' }
  | { type: 'tempo'; delta: number }
  | { type: 'volume'; db: number }
  | { type: 'tone'; db: number }
  | { type: 'reverb'; mix: number }
  | { type: 'pattern'; delta: 1 | -1 }
  | { type: 'mute' }
  | { type: 'airOn'; midi: number; velocity: number }
  | { type: 'airOff'; midi: number };

export type HandInfo = { id: HandFeature; icon: string; title: string; how: string; effect: string };
/** What the panel shows as the instructions (one row per function, each can be switched on / off). */
/** Every function the controller knows. Only the ones in HAND_FEATURES (below) are offered to the person: the others did not work well in a first real test, so they are switched off for now. */
export const ALL_HAND_FEATURES: HandInfo[] = [
  { id: 'playStop', icon: '✋ / ✊', title: 'PLAY and STOP', how: 'Show an OPEN PALM and hold it still for half a second = PLAY. Close it into a FIST and hold = STOP.', effect: 'Starts / stops the music' },
  { id: 'tempo', icon: '👍 / 👎', title: 'TEMPO', how: 'THUMB UP = faster, THUMB DOWN = slower (keep it up: about 5 BPM per second).', effect: 'Changes the BPM' },
  { id: 'volume', icon: '☝️', title: 'MASTER VOLUME', how: 'Point with ONE finger up and move your hand up and down: high = loud, low = quiet.', effect: 'Master volume (−40 … 0 dB)' },
  { id: 'tone', icon: '👆👍', title: 'BRIGHTNESS', how: 'Make an L with thumb and index finger (other fingers closed). Open the L wider = brighter sound.', effect: 'Master treble (EQ HIGH)' },
  { id: 'reverb', icon: '🙌', title: 'REVERB (second hand)', how: 'Show BOTH hands. Keep an open palm with the hand on the LEFT of the picture and move it up / down: high = more reverb.', effect: 'Master reverb' },
  { id: 'pattern', icon: '👋', title: 'NEXT / PREVIOUS PATTERN', how: 'Swipe a flat hand quickly to the right = next pattern, to the left = previous pattern.', effect: 'Switches pattern (PATTERN mode)' },
  { id: 'mute', icon: '✌️', title: 'MUTE the open track', how: 'Show VICTORY ✌ and hold for a second: the track you are looking at is muted / unmuted (on the DRUMS tab: all four drums).', effect: 'Mute on / off' },
  { id: 'air', icon: '👌', title: 'AIR PIANO', how: 'Make the OK sign 👌 (thumb touches index finger): a note plays, chosen by where your hand is left ↔ right (notes of your key and scale). Higher hand = louder. Open the fingers to release.', effect: 'Plays the open track’s sound' }
];

/** Shown in the panel and switched on by default: PLAY / STOP only (for now). */
export const HAND_FEATURES: HandInfo[] = ALL_HAND_FEATURES.filter(f => f.id === 'playStop');
export const ALL_FEATURES: HandFeature[] = HAND_FEATURES.map(f => f.id);
/** All functions, for tests and for bringing the others back later. */
export const EXPERIMENTAL_FEATURES: HandFeature[] = ALL_HAND_FEATURES.map(f => f.id);

export type HandStatus = { gesture: GestureId; label: string; hint: string; progress: number; hands: number };

const HOLD_MS = 500;            // a gesture must be held this long before play / stop / …
const MUTE_HOLD_MS = 1000;
const TEMPO_START_MS = 350; const TEMPO_EVERY_MS = 200;
const SWIPE_WINDOW_MS = 400; const SWIPE_DIST = 0.28; const SWIPE_COOLDOWN_MS = 900;
const STILL = 0.08;             // the palm may move this far (picture widths) while a hold is counted
const LOST_MS = 400;            // the gesture is forgotten after the hand was lost / changed for this long
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class HandController {
  private on: Set<HandFeature>;
  private air: number[] = [];
  private cur: GestureId = 'none'; private since = 0; private anchor = { x: 0, y: 0 }; private fired = false; private lastSeen = 0;
  private tempoAt = 0;
  private trail: { t: number; x: number }[] = []; private swipeAt = -1e9;
  private sm = { vol: null as number | null, tone: null as number | null, rev: null as number | null };
  private sent = { vol: NaN, tone: NaN, rev: NaN };
  private airNote: number | null = null; private pinchSince = 0;

  constructor(enabled: HandFeature[] = ALL_FEATURES) { this.on = new Set(enabled); }
  setEnabled(list: HandFeature[]): void { this.on = new Set(list); }
  /** The notes the AIR PIANO can play, low → high (spread over the picture width). */
  setAirNotes(midis: number[]): void { this.air = midis.slice(); }
  has(f: HandFeature): boolean { return this.on.has(f); }

  /** Forget everything (camera switched off): releases a held air note. */
  reset(): HandAction[] {
    const out: HandAction[] = this.airNote !== null ? [{ type: 'airOff', midi: this.airNote }] : [];
    this.airNote = null; this.cur = 'none'; this.fired = false; this.trail = []; this.sm = { vol: null, tone: null, rev: null }; this.sent = { vol: NaN, tone: NaN, rev: NaN };
    return out;
  }

  /** One camera frame: `hands` are raw landmarks (x straight from the camera, so the picture is mirrored here: your right hand = right side). */
  update(t: number, rawHands: LM[][]): { actions: HandAction[]; status: HandStatus } {
    const actions: HandAction[] = [];
    const hands = rawHands.filter(h => h && h.length >= 21).map(h => h.map(p => ({ x: 1 - p.x, y: p.y, z: p.z })));
    // the hand on the RIGHT of the (mirrored) picture does the gestures; a second hand on the left controls the reverb
    const sorted = hands.map(h => ({ h, c: palmCenter(h) })).sort((a, b) => b.c.x - a.c.x);
    const main = sorted[0]; const second = sorted.length > 1 ? sorted[1] : null;

    if (second && this.on.has('reverb') && classify(second.h) === 'open') {
      const v = clamp((0.75 - second.c.y) / 0.5, 0, 1);
      this.sm.rev = this.sm.rev === null ? v : this.sm.rev + (v - this.sm.rev) * 0.35;
      const mix = Math.round(this.sm.rev * 0.8 * 50) / 50;
      if (!(Math.abs(mix - this.sent.rev) < 0.02)) { this.sent.rev = mix; actions.push({ type: 'reverb', mix }); }
    }

    if (!main) {
      if (t - this.lastSeen > LOST_MS) { this.cur = 'none'; this.fired = false; this.trail = []; this.sm.vol = this.sm.tone = null; }
      if (this.airNote !== null) { actions.push({ type: 'airOff', midi: this.airNote }); this.airNote = null; }
      return { actions, status: { gesture: 'none', label: GESTURE_LABEL.none, hint: hands.length ? 'Show your hand to the camera.' : 'No hand seen. Hold your hand 40–80 cm from the camera, palm facing it.', progress: 0, hands: 0 } };
    }
    this.lastSeen = t;
    const lm = main.h; const g = classify(lm); const c = main.c;
    if (g !== this.cur) { this.cur = g; this.since = t; this.anchor = c; this.fired = false; this.tempoAt = 0; this.sm.vol = this.sm.tone = null; }
    if (Math.hypot(c.x - this.anchor.x, c.y - this.anchor.y) > STILL && (g === 'open' || g === 'fist' || g === 'victory')) { this.since = t; this.anchor = c; }   // moving: restart the hold
    const held = t - this.since;
    let hint = ''; let progress = 0;

    // --- swipe (flat hand moving sideways) ---
    this.trail.push({ t, x: c.x }); this.trail = this.trail.filter(p => t - p.t <= SWIPE_WINDOW_MS);
    if (g === 'open' && this.on.has('pattern') && t - this.swipeAt > SWIPE_COOLDOWN_MS && this.trail.length >= 3) {
      const dx = this.trail[this.trail.length - 1].x - this.trail[0].x;
      if (Math.abs(dx) > SWIPE_DIST) { actions.push({ type: 'pattern', delta: dx > 0 ? 1 : -1 }); this.swipeAt = t; this.trail = []; this.fired = true; hint = dx > 0 ? 'Swipe → next pattern' : 'Swipe ← previous pattern'; }
    }

    switch (g) {
      case 'open':
        if (this.on.has('playStop')) {
          hint = hint || 'Hold still → PLAY'; progress = this.fired ? 1 : clamp(held / HOLD_MS, 0, 1);
          if (!this.fired && held >= HOLD_MS) { actions.push({ type: 'play' }); this.fired = true; }
        } else hint = hint || 'Flat hand: swipe sideways to change pattern';
        break;
      case 'fist':
        if (this.on.has('playStop')) {
          hint = 'Hold → STOP'; progress = this.fired ? 1 : clamp(held / HOLD_MS, 0, 1);
          if (!this.fired && held >= HOLD_MS) { actions.push({ type: 'stop' }); this.fired = true; }
        }
        break;
      case 'thumbUp': case 'thumbDown':
        if (this.on.has('tempo')) {
          hint = g === 'thumbUp' ? 'Faster…' : 'Slower…';
          if (held >= TEMPO_START_MS && t - this.tempoAt >= TEMPO_EVERY_MS) { this.tempoAt = t; actions.push({ type: 'tempo', delta: g === 'thumbUp' ? 1 : -1 }); }
          progress = clamp(held / TEMPO_START_MS, 0, 1);
        }
        break;
      case 'point':
        if (this.on.has('volume')) {
          hint = 'Move your hand up / down = volume'; progress = clamp(held / 250, 0, 1);
          if (held >= 250) {
            const v = clamp((0.75 - c.y) / 0.5, 0, 1);
            this.sm.vol = this.sm.vol === null ? v : this.sm.vol + (v - this.sm.vol) * 0.35;
            const db = Math.round(-40 + this.sm.vol * 40);
            if (db !== this.sent.vol) { this.sent.vol = db; actions.push({ type: 'volume', db }); }
          }
        }
        break;
      case 'ell':
        if (this.on.has('tone')) {
          hint = 'Open the L wider = brighter'; progress = clamp(held / 250, 0, 1);
          if (held >= 250) {
            const v = clamp((spread(lm) - 0.8) / 1.0, 0, 1);
            this.sm.tone = this.sm.tone === null ? v : this.sm.tone + (v - this.sm.tone) * 0.35;
            const db = Math.round(-12 + this.sm.tone * 18);
            if (db !== this.sent.tone) { this.sent.tone = db; actions.push({ type: 'tone', db }); }
          }
        }
        break;
      case 'victory':
        if (this.on.has('mute')) {
          hint = 'Hold → mute / unmute'; progress = this.fired ? 1 : clamp(held / MUTE_HOLD_MS, 0, 1);
          if (!this.fired && held >= MUTE_HOLD_MS) { actions.push({ type: 'mute' }); this.fired = true; }
        }
        break;
      case 'pinch':
        if (this.on.has('air') && this.air.length > 0) {
          hint = 'Move left ↔ right to choose the note';
          if (this.airNote === null) {
            if (!this.pinchSince) this.pinchSince = t;
            if (t - this.pinchSince >= 60) {
              const tip = lm[8]; const idx = clamp(Math.floor(clamp(tip.x, 0, 0.999) * this.air.length), 0, this.air.length - 1);
              this.airNote = this.air[idx]; actions.push({ type: 'airOn', midi: this.airNote, velocity: Math.round(clamp(0.45 + (0.9 - tip.y) * 0.6, 0.45, 1) * 100) / 100 });
            }
          }
        }
        break;
      default: hint = 'Gesture not recognised';
    }
    if (g !== 'pinch') { this.pinchSince = 0; if (this.airNote !== null) { actions.push({ type: 'airOff', midi: this.airNote }); this.airNote = null; } }
    return { actions, status: { gesture: g, label: GESTURE_LABEL[g], hint, progress, hands: hands.length } };
  }
}
