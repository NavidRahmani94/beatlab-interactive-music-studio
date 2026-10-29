// Pure metadata (no audio code) so it can be validated and unit-tested without a browser.
import { FACTORY_SOUNDS, SOUND_GROUPS, CUSTOM_PREFIX } from './synth';

// The older built-in sounds (kept so old project files sound the same) ...
const CLASSIC_SOUNDS: Record<string, { label: string; hint: string; group: string }> = {
  softSynth: { label: 'Soft Synth', hint: 'warm saw lead', group: 'Synth leads' },
  electricPiano: { label: 'Electric Piano', hint: 'FM keys', group: 'Keys' },
  pluck: { label: 'Pluck', hint: 'short, bright', group: 'Plucked strings' },
  warmPad: { label: 'Warm Pad', hint: 'slow, airy', group: 'Pads & atmosphere' },
  bell: { label: 'Bell', hint: 'glassy, ringing', group: 'Mallets & bells' },
  lead: { label: 'Lead', hint: 'bright, cutting', group: 'Synth leads' },
  bass: { label: 'Bass', hint: 'one octave down', group: 'Bass' },
  strings: { label: 'Strings', hint: 'slow swell', group: 'Strings & winds' },
  airPad: { label: 'Air Pad', hint: 'breathy, wide', group: 'Pads & atmosphere' },
  glassPad: { label: 'Glass Pad', hint: 'shimmering', group: 'Pads & atmosphere' },
  drone: { label: 'Drone', hint: 'deep, constant', group: 'Pads & atmosphere' }
};
export const CLASSIC_IDS = Object.keys(CLASSIC_SOUNDS);
// ... plus the big synthesized library from synth.ts. Every id here is a built-in sound; user synths use "synth:<id>".
export const MELODY_INSTRUMENTS: Record<string, { label: string; hint: string; group: string }> = {
  ...CLASSIC_SOUNDS,
  ...Object.fromEntries(Object.entries(FACTORY_SOUNDS).map(([id, f]) => [id, { label: f.label, hint: f.hint, group: f.group }]))
};
/** A built-in sound id (e.g. "bell") or a user synth reference ("synth:s1"). */
export type MelodyInstrumentId = string;
export const MELODY_INSTRUMENT_IDS = Object.keys(MELODY_INSTRUMENTS);
const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
export const isMelodyInstrument = (v: unknown): v is MelodyInstrumentId => typeof v === 'string' && own(MELODY_INSTRUMENTS, v);
/** Built-in sounds grouped by family, in display order. */
export function instrumentGroups(): { group: string; ids: string[] }[] {
  return SOUND_GROUPS.map(group => ({ group, ids: MELODY_INSTRUMENT_IDS.filter(id => MELODY_INSTRUMENTS[id].group === group) })).filter(g => g.ids.length > 0);
}
export const isCustomInstrument = (v: string): boolean => v.startsWith(CUSTOM_PREFIX);

export const DRUM_KITS = {
  classic: { label: 'Classic' },
  kit808: { label: '808' },
  tight: { label: 'Tight' },
  house909: { label: '909 House / Techno' },
  trap: { label: 'Trap (long 808)' },
  lofi: { label: 'Lo-fi (soft, dusty)' },
  rock: { label: 'Rock' },
  electro: { label: 'Electro / Synthwave' },
  dnb: { label: 'Drum & Bass (fast)' },
  industrial: { label: 'Industrial (hard)' },
  chip: { label: 'Chip (8-bit)' }
} as const;
export type DrumKitId = keyof typeof DRUM_KITS;
export const DRUM_KIT_IDS = Object.keys(DRUM_KITS) as DrumKitId[];
export const isDrumKit = (v: unknown): v is DrumKitId => typeof v === 'string' && own(DRUM_KITS, v);
