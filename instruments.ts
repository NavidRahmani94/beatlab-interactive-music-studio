// Pure metadata (no audio code) so it can be validated and unit-tested without a browser.
export const MELODY_INSTRUMENTS = {
  softSynth: { label: 'Soft Synth', hint: 'warm saw lead' },
  electricPiano: { label: 'Electric Piano', hint: 'FM keys' },
  pluck: { label: 'Pluck', hint: 'short, bright' },
  warmPad: { label: 'Warm Pad', hint: 'slow, airy' },
  bell: { label: 'Bell', hint: 'glassy, ringing' },
  lead: { label: 'Lead', hint: 'bright, cutting' },
  bass: { label: 'Bass', hint: 'one octave down' },
  strings: { label: 'Strings', hint: 'slow swell' },
  airPad: { label: 'Air Pad', hint: 'breathy, wide' },
  glassPad: { label: 'Glass Pad', hint: 'shimmering' },
  drone: { label: 'Drone', hint: 'deep, constant' }
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

// ---------- the four "modes" (tabs) ----------
export const MELODIC_TRACKS = ['melody', 'ambient', 'arp'] as const;
export type MelodicTrack = typeof MELODIC_TRACKS[number];
export const TAB_ORDER = ['ambient', 'drums', 'melody', 'arp'] as const;
export type TabId = typeof TAB_ORDER[number];
export const TAB_LABELS: Record<TabId, string> = { ambient: 'AMBIENT', drums: 'DRUMS', melody: 'MELODY', arp: 'ARPEGGIO' };
export const TAB_HINTS: Record<TabId, string> = {
  ambient: 'long, slow atmosphere (pads, drones)',
  drums: 'kick · snare · hi-hat · clap',
  melody: 'the tune',
  arp: 'a held chord is played note by note'
};
export const isMelodicTrack = (v: unknown): v is MelodicTrack => typeof v === 'string' && (MELODIC_TRACKS as readonly string[]).includes(v);
export const TRACK_DEFAULT_INSTRUMENT: Record<MelodicTrack, MelodyInstrumentId> = { melody: 'electricPiano', ambient: 'warmPad', arp: 'pluck' };
/** Default length (in steps) of a note added with a single click on each track. */
export const TRACK_DEFAULT_LENGTH: Record<MelodicTrack, number> = { melody: 1, ambient: 8, arp: 8 };
