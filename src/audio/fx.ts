// Per-channel insert effects: each mixer channel can have up to MAX_FX effects in a row (before pan and the reverb/delay sends).
export const FX_TYPES = {
  chorus: { label: 'Chorus', hint: 'wide, shimmering, several voices at once' },
  phaser: { label: 'Phaser', hint: 'sweeping, swirling movement' },
  flanger: { label: 'Flanger', hint: 'jet-plane metallic sweep' },
  tremolo: { label: 'Tremolo', hint: 'volume wobbles up and down' },
  vibrato: { label: 'Vibrato', hint: 'pitch wobbles, like a singing voice' },
  distortion: { label: 'Distortion', hint: 'warm to heavy overdrive' },
  bitcrusher: { label: 'Bitcrusher', hint: 'lo-fi, old video-game grit' },
  autofilter: { label: 'Auto-Filter', hint: 'a filter that sweeps up and down by itself' },
  autowah: { label: 'Auto-Wah', hint: '"wah" that follows how hard the notes are played' },
  widener: { label: 'Stereo Widener', hint: 'spreads the sound wider left and right' }
} as const;
export type FxType = keyof typeof FX_TYPES;
export const FX_IDS = Object.keys(FX_TYPES) as FxType[];
export const isFxType = (v: unknown): v is FxType => typeof v === 'string' && Object.prototype.hasOwnProperty.call(FX_TYPES, v);
export const MAX_FX = 4;

export type FxSlot = { id: string; type: FxType; amount: number; on: boolean };

export const clampAmount = (v: number): number => Number.isFinite(v) ? Math.max(0, Math.min(1, Math.round(v * 100) / 100)) : 0;
const DEFAULT_AMOUNT: Record<FxType, number> = { chorus: 0.5, phaser: 0.5, flanger: 0.5, tremolo: 0.5, vibrato: 0.4, distortion: 0.4, bitcrusher: 0.4, autofilter: 0.6, autowah: 0.6, widener: 0.6 };
export function makeFx(type: FxType, existing: FxSlot[] = []): FxSlot {
  let n = existing.length + 1;
  while (existing.some(f => f.id === `fx${n}`)) n++;
  return { id: `fx${n}`, type, amount: DEFAULT_AMOUNT[type], on: true };
}
/** Adds an effect (ignored when the channel already has MAX_FX). */
export function addFx(list: FxSlot[] | undefined, type: FxType): FxSlot[] {
  const cur = list ?? [];
  return cur.length >= MAX_FX ? cur : [...cur, makeFx(type, cur)];
}
export const removeFx = (list: FxSlot[] | undefined, id: string): FxSlot[] => (list ?? []).filter(f => f.id !== id);
export const patchFx = (list: FxSlot[] | undefined, id: string, patch: Partial<Pick<FxSlot, 'type' | 'amount' | 'on'>>): FxSlot[] =>
  (list ?? []).map(f => f.id !== id ? f : { ...f, type: patch.type !== undefined && isFxType(patch.type) ? patch.type : f.type, amount: patch.amount === undefined ? f.amount : clampAmount(patch.amount), on: patch.on === undefined ? f.on : patch.on });
/** Moves one effect up (−1) or down (+1) in the row. */
export function moveFx(list: FxSlot[] | undefined, id: string, dir: -1 | 1): FxSlot[] {
  const cur = [...(list ?? [])]; const i = cur.findIndex(f => f.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= cur.length) return cur;
  [cur[i], cur[j]] = [cur[j], cur[i]];
  return cur;
}
/** Which effects are really in the audio chain (bypassed ones are left out). Used to know when the chain must be rebuilt. */
export const fxSignature = (list: FxSlot[] | undefined): string => (list ?? []).filter(f => f.on).map(f => `${f.id}:${f.type}`).join('|');

export function validateFx(v: unknown): { ok: true; fx: FxSlot[] } | { ok: false; error: string } {
  if (!Array.isArray(v)) return { ok: false, error: '"fx" must be a list.' };
  if (v.length > MAX_FX) return { ok: false, error: `A channel can have at most ${MAX_FX} effects.` };
  const out: FxSlot[] = []; const ids = new Set<string>();
  for (const x of v) {
    if (typeof x !== 'object' || x === null) return { ok: false, error: 'Each effect must be an object.' };
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[a-z0-9_-]{1,16}$/.test(o.id) || ids.has(o.id)) return { ok: false, error: 'Each effect needs its own short id.' };
    if (!isFxType(o.type)) return { ok: false, error: `Unknown effect "${String(o.type)}".` };
    if (typeof o.amount !== 'number' || !Number.isFinite(o.amount) || o.amount < 0 || o.amount > 1) return { ok: false, error: 'An effect amount must be between 0 and 1.' };
    if (typeof o.on !== 'boolean') return { ok: false, error: 'An effect "on" must be true or false.' };
    ids.add(o.id); out.push({ id: o.id, type: o.type, amount: o.amount, on: o.on });
  }
  return { ok: true, fx: out };
}
