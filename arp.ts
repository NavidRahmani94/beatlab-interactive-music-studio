import { MelodyNote, clampVelocity, midiToNote, noteToMidi } from './melody';

// An arpeggiator turns the notes that are HELD (stretched) on the arpeggio track into a run of single notes.
export const ARP_MODES = { up: 'Up', down: 'Down', updown: 'Up-Down', random: 'Random' } as const;
export type ArpMode = keyof typeof ARP_MODES;
export const ARP_RATES = { '16n': { label: '1/16', steps: 1 }, '8n': { label: '1/8', steps: 2 } } as const;
export type ArpRate = keyof typeof ARP_RATES;
export type ArpSettings = { mode: ArpMode; rate: ArpRate; octaves: 1 | 2 | 3; gate: number };

const own = (obj: object, key: unknown): boolean => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
export const isArpMode = (v: unknown): v is ArpMode => own(ARP_MODES, v);
export const isArpRate = (v: unknown): v is ArpRate => own(ARP_RATES, v);
export const isArpOctaves = (v: unknown): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3;
export const clampGate = (v: number): number => Number.isFinite(v) ? Math.round(Math.max(0.2, Math.min(1, v)) * 100) / 100 : 0.6;

export function defaultArp(): ArpSettings { return { mode: 'up', rate: '16n', octaves: 1, gate: 0.6 }; }

export type ArpEvent = { pitch: string; velocity: number; durationSteps: number };

function hash(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * What the arpeggiator plays on this 16th-note step (0..15). Pure and deterministic: the same notes, step and tick
 * always give the same result, so live playback and the WAV export are identical.
 */
export function arpAt(notes: MelodyNote[], step: number, settings: ArpSettings, tick: number): ArpEvent[] {
  const rateSteps = ARP_RATES[settings.rate].steps;
  if (step % rateSteps !== 0) return [];
  const velByMidi = new Map<number, number>();
  for (const n of notes) {
    if (step < n.step || step >= n.step + n.lengthSteps) continue;
    const midi = noteToMidi(n.pitch);
    if (midi !== null) velByMidi.set(midi, Math.max(velByMidi.get(midi) ?? 0, n.velocity));
  }
  if (velByMidi.size === 0) return [];
  const base = [...velByMidi.keys()].sort((a, b) => a - b);
  const pool: { midi: number; vel: number }[] = [];
  for (let o = 0; o < settings.octaves; o++) base.forEach(m => pool.push({ midi: m + 12 * o, vel: velByMidi.get(m) ?? 0.8 }));
  const n = pool.length;
  const k = Math.floor(step / rateSteps);
  let index: number;
  switch (settings.mode) {
    case 'down': index = n - 1 - (k % n); break;
    case 'updown': { if (n === 1) { index = 0; break; } const cycle = 2 * n - 2; const p = k % cycle; index = p < n ? p : cycle - p; break; }
    case 'random': index = Math.floor(hash(tick * 31 + step) * n) % n; break;
    default: index = k % n;
  }
  const pick = pool[index];
  return [{ pitch: midiToNote(pick.midi), velocity: clampVelocity(pick.vel), durationSteps: Math.max(0.2, rateSteps * clampGate(settings.gate)) }];
}
