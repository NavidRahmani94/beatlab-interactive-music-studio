// Pure metadata (no audio code) so it can be validated and unit-tested without a browser.
export const MELODY_INSTRUMENTS = {
  softSynth: { label: 'Soft Synth', hint: 'warm saw lead' },
  electricPiano: { label: 'Electric Piano', hint: 'FM keys' },
  pluck: { label: 'Pluck', hint: 'short, bright' },
  warmPad: { label: 'Warm Pad', hint: 'slow, airy' },
  bell: { label: 'Bell', hint: 'glassy, ringing' },
  lead: { label: 'Lead', hint: 'bright, cutting' },
  bass: { label: 'Bass', hint: 'one octave down' }
} as const;
export type MelodyInstrumentId = keyof typeof MELODY_INSTRUMENTS;
export const MELODY_INSTRUMENT_IDS = Object.keys(MELODY_INSTRUMENTS) as MelodyInstrumentId[];
const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
export const isMelodyInstrument = (v: unknown): v is MelodyInstrumentId => typeof v === 'string' && own(MELODY_INSTRUMENTS, v);

export const DRUM_KITS = {
  classic: { label: 'Classic' },
  kit808: { label: '808' },
  tight: { label: 'Tight' }
} as const;
export type DrumKitId = keyof typeof DRUM_KITS;
export const DRUM_KIT_IDS = Object.keys(DRUM_KITS) as DrumKitId[];
export const isDrumKit = (v: unknown): v is DrumKitId => typeof v === 'string' && own(DRUM_KITS, v);
