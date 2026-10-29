// The sound-design model: a "patch" describes one synthesizer sound. Pure data + validation (no audio code),
// so it can be saved in a project file, unit-tested without a browser, and rendered identically live and in the export.

export const WAVES = { sine: 'Sine', triangle: 'Triangle', sawtooth: 'Saw', square: 'Square', pulse: 'Pulse', pwm: 'PWM' } as const;
export type Wave = keyof typeof WAVES;
export const FILTER_TYPES = { lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', notch: 'Notch' } as const;
export type FilterType = keyof typeof FILTER_TYPES;
export const LFO_TARGETS = { off: 'Off', pitch: 'Vibrato (pitch)', filter: 'Wobble (filter)', amp: 'Tremolo (volume)' } as const;
export type LfoTarget = keyof typeof LFO_TARGETS;
export const LFO_WAVES = { sine: 'Sine', triangle: 'Triangle', square: 'Square', sawtooth: 'Saw' } as const;
export type LfoWave = keyof typeof LFO_WAVES;
export const NOISE_COLORS = { white: 'White', pink: 'Pink', brown: 'Brown' } as const;
export type NoiseColor = keyof typeof NOISE_COLORS;

export type OscSettings = {
  wave: Wave;
  octave: number;   // -3..3
  cents: number;    // -100..100 fine tune
  level: number;    // 0..1 (0 = this oscillator is off)
  fmIndex: number;  // 0..12 (0 = plain wave; above 0 the wave is frequency-modulated: bell / electric-piano / metallic tones)
  fmRatio: number;  // 0.25..8 modulator pitch relative to the note
};
export type Envelope = { a: number; d: number; s: number; r: number }; // seconds, seconds, level 0..1, seconds
export type SynthPatch = {
  osc1: OscSettings;
  osc2: OscSettings;
  unison: number;       // 1..5 stacked copies of each (non-FM) oscillator
  spread: number;       // 0..60 cents between the unison copies
  pulseWidth: number;   // 0.05..0.95 (Pulse wave)
  pwmRate: number;      // 0.1..20 Hz (PWM wave)
  noise: number;        // 0..1
  noiseColor: NoiseColor;
  filter: { type: FilterType; cutoff: number; resonance: number; rolloff: 12 | 24; envAmount: number };
  filterEnv: Envelope;
  ampEnv: Envelope;
  lfo: { target: LfoTarget; wave: LfoWave; rate: number; depth: number };
  drive: number;        // 0..1 distortion
  chorus: number;       // 0..1 stereo chorus mix
  volumeDb: number;     // -24..6
  transpose: number;    // -36..36 semitones
};

export const LIMITS = {
  octave: [-3, 3], cents: [-100, 100], level: [0, 1], fmIndex: [0, 12], fmRatio: [0.25, 8],
  unison: [1, 5], spread: [0, 60], pulseWidth: [0.05, 0.95], pwmRate: [0.1, 20], noise: [0, 1],
  cutoff: [40, 16000], resonance: [0.1, 20], envAmount: [0, 8],
  a: [0.001, 5], d: [0.01, 5], s: [0, 1], r: [0.01, 8],
  lfoRate: [0.1, 20], lfoDepth: [0, 1], drive: [0, 1], chorus: [0, 1], volumeDb: [-24, 12], transpose: [-36, 36]
} as const;

const osc = (wave: Wave, level: number, extra: Partial<OscSettings> = {}): OscSettings => ({ wave, octave: 0, cents: 0, level, fmIndex: 0, fmRatio: 1, ...extra });
export const env = (a: number, d: number, s: number, r: number): Envelope => ({ a, d, s, r });

/** A plain, friendly starting point: one saw wave through a gentle filter. */
export function defaultPatch(): SynthPatch {
  return {
    osc1: osc('sawtooth', 0.8), osc2: osc('square', 0, { octave: -1 }), unison: 1, spread: 15, pulseWidth: 0.5, pwmRate: 2,
    noise: 0, noiseColor: 'white',
    filter: { type: 'lowpass', cutoff: 1800, resonance: 1, rolloff: 24, envAmount: 1.5 },
    filterEnv: env(0.005, 0.35, 0.3, 0.3), ampEnv: env(0.01, 0.3, 0.7, 0.4),
    lfo: { target: 'off', wave: 'sine', rate: 5, depth: 0.3 },
    drive: 0, chorus: 0, volumeDb: -6, transpose: 0
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export function makePatch(over: DeepPartial<SynthPatch>): SynthPatch {
  const d = defaultPatch();
  const merged = { ...d, ...over } as SynthPatch;
  merged.osc1 = { ...d.osc1, ...(over.osc1 ?? {}) };
  merged.osc2 = { ...d.osc2, ...(over.osc2 ?? {}) };
  merged.filter = { ...d.filter, ...(over.filter ?? {}) };
  merged.filterEnv = { ...d.filterEnv, ...(over.filterEnv ?? {}) };
  merged.ampEnv = { ...d.ampEnv, ...(over.ampEnv ?? {}) };
  merged.lfo = { ...d.lfo, ...(over.lfo ?? {}) };
  return merged;
}

// ---------- validation ----------
const own = (obj: object, key: unknown): boolean => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const inRange = (v: unknown, [lo, hi]: readonly [number, number]): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

function validateOsc(v: unknown, where: string): OscSettings | string {
  if (!isObj(v)) return `${where} must be an object.`;
  if (!own(WAVES, v.wave)) return `${where}.wave is not a known wave.`;
  if (!inRange(v.octave, LIMITS.octave) || !Number.isInteger(v.octave)) return `${where}.octave must be a whole number from -3 to 3.`;
  if (!inRange(v.cents, LIMITS.cents)) return `${where}.cents must be between -100 and 100.`;
  if (!inRange(v.level, LIMITS.level)) return `${where}.level must be between 0 and 1.`;
  if (!inRange(v.fmIndex, LIMITS.fmIndex)) return `${where}.fmIndex must be between 0 and 12.`;
  if (!inRange(v.fmRatio, LIMITS.fmRatio)) return `${where}.fmRatio must be between 0.25 and 8.`;
  return { wave: v.wave as Wave, octave: v.octave, cents: v.cents, level: v.level, fmIndex: v.fmIndex, fmRatio: v.fmRatio };
}
function validateEnv(v: unknown, where: string): Envelope | string {
  if (!isObj(v)) return `${where} must be an object.`;
  if (!inRange(v.a, LIMITS.a)) return `${where}.a (attack) must be between 0.001 and 5 seconds.`;
  if (!inRange(v.d, LIMITS.d)) return `${where}.d (decay) must be between 0.01 and 5 seconds.`;
  if (!inRange(v.s, LIMITS.s)) return `${where}.s (sustain) must be between 0 and 1.`;
  if (!inRange(v.r, LIMITS.r)) return `${where}.r (release) must be between 0.01 and 8 seconds.`;
  return { a: v.a, d: v.d, s: v.s, r: v.r };
}

/** Strict check of a patch read from a file. Never throws. */
export function validatePatch(v: unknown, where = 'patch'): { ok: true; patch: SynthPatch } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!isObj(v)) return fail(`${where} must be an object.`);
  const osc1 = validateOsc(v.osc1, `${where}.osc1`); if (typeof osc1 === 'string') return fail(osc1);
  const osc2 = validateOsc(v.osc2, `${where}.osc2`); if (typeof osc2 === 'string') return fail(osc2);
  if (!inRange(v.unison, LIMITS.unison) || !Number.isInteger(v.unison)) return fail(`${where}.unison must be a whole number from 1 to 5.`);
  if (!inRange(v.spread, LIMITS.spread)) return fail(`${where}.spread must be between 0 and 60.`);
  if (!inRange(v.pulseWidth, LIMITS.pulseWidth)) return fail(`${where}.pulseWidth must be between 0.05 and 0.95.`);
  if (!inRange(v.pwmRate, LIMITS.pwmRate)) return fail(`${where}.pwmRate must be between 0.1 and 20.`);
  if (!inRange(v.noise, LIMITS.noise)) return fail(`${where}.noise must be between 0 and 1.`);
  if (!own(NOISE_COLORS, v.noiseColor)) return fail(`${where}.noiseColor must be white, pink or brown.`);
  const f = v.filter;
  if (!isObj(f) || !own(FILTER_TYPES, f.type) || !inRange(f.cutoff, LIMITS.cutoff) || !inRange(f.resonance, LIMITS.resonance) || (f.rolloff !== 12 && f.rolloff !== 24) || !inRange(f.envAmount, LIMITS.envAmount)) {
    return fail(`${where}.filter needs a type, cutoff 40–16000, resonance 0.1–20, rolloff 12 or 24 and envAmount 0–8.`);
  }
  const filterEnv = validateEnv(v.filterEnv, `${where}.filterEnv`); if (typeof filterEnv === 'string') return fail(filterEnv);
  const ampEnv = validateEnv(v.ampEnv, `${where}.ampEnv`); if (typeof ampEnv === 'string') return fail(ampEnv);
  const l = v.lfo;
  if (!isObj(l) || !own(LFO_TARGETS, l.target) || !own(LFO_WAVES, l.wave) || !inRange(l.rate, LIMITS.lfoRate) || !inRange(l.depth, LIMITS.lfoDepth)) {
    return fail(`${where}.lfo needs a target, wave, rate 0.1–20 and depth 0–1.`);
  }
  if (!inRange(v.drive, LIMITS.drive)) return fail(`${where}.drive must be between 0 and 1.`);
  if (!inRange(v.chorus, LIMITS.chorus)) return fail(`${where}.chorus must be between 0 and 1.`);
  if (!inRange(v.volumeDb, LIMITS.volumeDb)) return fail(`${where}.volumeDb must be between -24 and 12.`);
  if (!inRange(v.transpose, LIMITS.transpose) || !Number.isInteger(v.transpose)) return fail(`${where}.transpose must be a whole number of semitones from -36 to 36.`);
  return {
    ok: true,
    patch: {
      osc1, osc2, unison: v.unison, spread: v.spread, pulseWidth: v.pulseWidth, pwmRate: v.pwmRate, noise: v.noise, noiseColor: v.noiseColor as NoiseColor,
      filter: { type: f.type as FilterType, cutoff: f.cutoff, resonance: f.resonance, rolloff: f.rolloff, envAmount: f.envAmount },
      filterEnv, ampEnv, lfo: { target: l.target as LfoTarget, wave: l.wave as LfoWave, rate: l.rate, depth: l.depth },
      drive: v.drive, chorus: v.chorus, volumeDb: v.volumeDb, transpose: v.transpose
    }
  };
}

const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, v));
/** Forces every number of a patch into its legal range (used by the editor and by randomize). */
export function clampPatch(p: SynthPatch): SynthPatch {
  const o = (x: OscSettings): OscSettings => ({ ...x, octave: Math.round(clamp(x.octave, LIMITS.octave)), cents: clamp(x.cents, LIMITS.cents), level: clamp(x.level, LIMITS.level), fmIndex: clamp(x.fmIndex, LIMITS.fmIndex), fmRatio: clamp(x.fmRatio, LIMITS.fmRatio) });
  const e = (x: Envelope): Envelope => ({ a: clamp(x.a, LIMITS.a), d: clamp(x.d, LIMITS.d), s: clamp(x.s, LIMITS.s), r: clamp(x.r, LIMITS.r) });
  return {
    ...p, osc1: o(p.osc1), osc2: o(p.osc2), unison: Math.round(clamp(p.unison, LIMITS.unison)), spread: clamp(p.spread, LIMITS.spread),
    pulseWidth: clamp(p.pulseWidth, LIMITS.pulseWidth), pwmRate: clamp(p.pwmRate, LIMITS.pwmRate), noise: clamp(p.noise, LIMITS.noise),
    filter: { ...p.filter, cutoff: clamp(p.filter.cutoff, LIMITS.cutoff), resonance: clamp(p.filter.resonance, LIMITS.resonance), envAmount: clamp(p.filter.envAmount, LIMITS.envAmount) },
    filterEnv: e(p.filterEnv), ampEnv: e(p.ampEnv),
    lfo: { ...p.lfo, rate: clamp(p.lfo.rate, LIMITS.lfoRate), depth: clamp(p.lfo.depth, LIMITS.lfoDepth) },
    drive: clamp(p.drive, LIMITS.drive), chorus: clamp(p.chorus, LIMITS.chorus), volumeDb: clamp(p.volumeDb, LIMITS.volumeDb), transpose: Math.round(clamp(p.transpose, LIMITS.transpose))
  };
}

/** A random but usable sound (never silent, never harsh). `rand` is injectable so tests are deterministic. */
export function randomPatch(rand: () => number = Math.random): SynthPatch {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length) % xs.length];
  const between = (lo: number, hi: number): number => lo + rand() * (hi - lo);
  const waves = Object.keys(WAVES) as Wave[];
  const fm = rand() < 0.3;
  const pad = rand() < 0.4;
  return clampPatch(makePatch({
    osc1: osc(pick(waves), between(0.6, 1), { fmIndex: fm ? between(1, 8) : 0, fmRatio: pick([0.5, 1, 2, 3, 3.5, 4]) }),
    osc2: osc(pick(waves), rand() < 0.5 ? between(0.2, 0.7) : 0, { octave: pick([-1, 0, 0, 1]), cents: between(-15, 15) }),
    unison: pick([1, 1, 2, 3, 5]), spread: between(5, 35), noise: rand() < 0.2 ? between(0.02, 0.15) : 0,
    filter: { type: pick(['lowpass', 'lowpass', 'lowpass', 'bandpass', 'highpass'] as FilterType[]), cutoff: between(300, 3500), resonance: between(0.5, 8), rolloff: pick([12, 24] as const), envAmount: between(0, 4) },
    filterEnv: env(pad ? between(0.2, 1.5) : 0.003, between(0.1, 1), between(0, 0.7), between(0.1, 1.2)),
    ampEnv: env(pad ? between(0.2, 1.2) : between(0.002, 0.05), between(0.1, 1.2), pad ? between(0.6, 1) : between(0, 0.8), between(0.1, pad ? 2.5 : 0.8)),
    lfo: { target: pick(['off', 'off', 'pitch', 'filter', 'amp'] as LfoTarget[]), wave: pick(['sine', 'triangle'] as LfoWave[]), rate: between(0.3, 8), depth: between(0.1, 0.6) },
    drive: rand() < 0.25 ? between(0.1, 0.5) : 0, chorus: rand() < 0.5 ? between(0.2, 0.6) : 0, volumeDb: -6
  }));
}

// ---------- user synths stored in a project ----------
export type SynthSlot = { id: string; name: string; patch: SynthPatch };
export const MAX_SYNTHS = 16;
export const CUSTOM_PREFIX = 'synth:';
export const customRef = (id: string): string => CUSTOM_PREFIX + id;
export const isCustomRef = (ref: string): boolean => ref.startsWith(CUSTOM_PREFIX);
export const customId = (ref: string): string => ref.slice(CUSTOM_PREFIX.length);
export const SYNTH_ID_PATTERN = /^[a-z0-9_-]{1,24}$/;

export function nextSynthId(synths: SynthSlot[]): string {
  let n = synths.length + 1;
  while (synths.some(s => s.id === `s${n}`)) n++;
  return `s${n}`;
}
export function addSynth(synths: SynthSlot[], name: string, patch: SynthPatch): SynthSlot[] {
  if (synths.length >= MAX_SYNTHS) return synths;
  return [...synths, { id: nextSynthId(synths), name: name.slice(0, 40) || 'My synth', patch: clampPatch(patch) }];
}
export const updateSynth = (synths: SynthSlot[], id: string, fn: (s: SynthSlot) => SynthSlot): SynthSlot[] => synths.map(s => s.id === id ? fn(s) : s);
export const removeSynth = (synths: SynthSlot[], id: string): SynthSlot[] => synths.filter(s => s.id !== id);
export function validateSynths(v: unknown): { ok: true; synths: SynthSlot[] } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, synths: [] };
  if (!Array.isArray(v)) return { ok: false, error: '"synths" must be a list.' };
  if (v.length > MAX_SYNTHS) return { ok: false, error: `Too many synths (max ${MAX_SYNTHS}).` };
  const out: SynthSlot[] = [];
  for (let i = 0; i < v.length; i++) {
    const s: unknown = v[i];
    if (!isObj(s)) return { ok: false, error: `synths[${i}] is not a synth.` };
    if (typeof s.id !== 'string' || !SYNTH_ID_PATTERN.test(s.id)) return { ok: false, error: `synths[${i}].id must be 1–24 letters, digits, - or _.` };
    if (out.some(o => o.id === s.id)) return { ok: false, error: `synths[${i}].id "${s.id}" is used twice.` };
    if (typeof s.name !== 'string' || s.name.length > 40) return { ok: false, error: `synths[${i}].name must be text of at most 40 characters.` };
    const p = validatePatch(s.patch, `synths[${i}].patch`);
    if (!p.ok) return p;
    out.push({ id: s.id, name: s.name, patch: p.patch });
  }
  return { ok: true, synths: out };
}

// ---------- the factory sound library ----------
// Built from the same patches as the user's own synths, so every sound can be opened in the Synth Lab and tweaked.
export type FactorySound = { label: string; hint: string; group: string; patch: SynthPatch };
type Spec = [id: string, label: string, hint: string, group: string, patch: DeepPartial<SynthPatch>];

export const SOUND_GROUPS = ['Keys', 'Organs', 'Mallets & bells', 'Plucked strings', 'Synth leads', 'Bass', 'Pads & atmosphere', 'Strings & winds', 'Brass', 'World & Persian', 'Chip & retro', 'Textures & FX'] as const;

const SPECS: Spec[] = [
  // ---- Keys
  ['piano', 'Piano', 'soft hammered keys · pop, ballad', 'Keys', { osc1: osc('triangle', 0.9), osc2: osc('sine', 0.35, { octave: 1 }), filter: { cutoff: 700, envAmount: 2.6, resonance: 0.7 }, filterEnv: env(0.001, 0.5, 0, 0.3), ampEnv: env(0.002, 1.6, 0.04, 0.5), volumeDb: -4 }],
  ['rhodes', 'Rhodes', 'warm tine keys · lo-fi, soul, jazz', 'Keys', { osc1: osc('sine', 0.9, { fmIndex: 3.5, fmRatio: 1 }), osc2: osc('sine', 0.25, { octave: 1, cents: 4 }), filter: { cutoff: 4000, envAmount: 0 }, ampEnv: env(0.003, 2.2, 0.08, 0.6), lfo: { target: 'amp', wave: 'sine', rate: 4.5, depth: 0.12 }, chorus: 0.35, volumeDb: -3 }],
  ['wurli', 'Wurlitzer', 'buzzy electric piano · funk, indie', 'Keys', { osc1: osc('triangle', 0.8), osc2: osc('square', 0.18, { octave: 1 }), filter: { cutoff: 1500, envAmount: 1.2 }, filterEnv: env(0.001, 0.3, 0.1, 0.2), ampEnv: env(0.003, 0.9, 0.2, 0.3), lfo: { target: 'amp', wave: 'sine', rate: 5.5, depth: 0.2 }, drive: 0.15, volumeDb: -2 }],
  ['clav', 'Clavinet', 'funky percussive keys · funk', 'Keys', { osc1: osc('pulse', 0.9), pulseWidth: 0.22, filter: { cutoff: 700, envAmount: 3, resonance: 2 }, filterEnv: env(0.001, 0.12, 0.1, 0.08), ampEnv: env(0.001, 0.28, 0.15, 0.08), volumeDb: -7 }],
  ['harpsichord', 'Harpsichord', 'bright plucked keys · baroque', 'Keys', { osc1: osc('pulse', 0.7), pulseWidth: 0.3, osc2: osc('sawtooth', 0.4, { octave: 1 }), filter: { cutoff: 1400, envAmount: 2 }, filterEnv: env(0.001, 0.15, 0, 0.1), ampEnv: env(0.001, 0.6, 0, 0.12), volumeDb: -7 }],
  ['toyPiano', 'Toy piano', 'cute, glassy · indie, soundtrack', 'Keys', { osc1: osc('sine', 0.8, { fmIndex: 2.5, fmRatio: 4 }), osc2: osc('triangle', 0.3, { octave: 1 }), filter: { cutoff: 9000, envAmount: 0 }, ampEnv: env(0.001, 0.7, 0, 0.3), volumeDb: -3 }],
  // ---- Organs
  ['organ', 'Drawbar organ', 'Hammond-style · gospel, rock, reggae', 'Organs', { osc1: osc('square', 0.5), osc2: osc('sine', 0.5, { octave: 1 }), filter: { cutoff: 5500, envAmount: 0 }, ampEnv: env(0.004, 0.05, 1, 0.07), lfo: { target: 'amp', wave: 'sine', rate: 6.2, depth: 0.18 }, volumeDb: -13 }],
  ['churchOrgan', 'Church organ', 'big, airy pipes · classical, epic', 'Organs', { osc1: osc('sawtooth', 0.5), osc2: osc('square', 0.5, { octave: -1 }), filter: { cutoff: 1900, envAmount: 0 }, ampEnv: env(0.04, 0.1, 0.9, 0.3), chorus: 0.4, volumeDb: -10 }],
  ['accordion', 'Accordion', 'reedy and wheezy · folk, tango', 'Organs', { osc1: osc('sawtooth', 0.6), osc2: osc('sawtooth', 0.5, { cents: 14 }), filter: { cutoff: 2600, envAmount: 0 }, ampEnv: env(0.05, 0.1, 0.9, 0.1), lfo: { target: 'amp', wave: 'sine', rate: 6, depth: 0.2 }, volumeDb: -9 }],
  // ---- Mallets & bells
  ['marimba', 'Marimba', 'woody mallet · world, minimal', 'Mallets & bells', { osc1: osc('sine', 1), osc2: osc('sine', 0.25, { octave: 2 }), filter: { cutoff: 3000, envAmount: 0 }, ampEnv: env(0.001, 0.5, 0, 0.15), volumeDb: -4 }],
  ['vibraphone', 'Vibraphone', 'shimmering metal bars · jazz, lo-fi', 'Mallets & bells', { osc1: osc('sine', 1), osc2: osc('sine', 0.12, { octave: 2 }), ampEnv: env(0.002, 2.4, 0, 1.2), lfo: { target: 'amp', wave: 'sine', rate: 5.2, depth: 0.35 }, filter: { cutoff: 6000, envAmount: 0 }, volumeDb: -3 }],
  ['musicBox', 'Music box', 'tiny and tender · lullaby', 'Mallets & bells', { osc1: osc('triangle', 0.8, { octave: 1 }), osc2: osc('sine', 0.4, { octave: 2 }), ampEnv: env(0.001, 1.2, 0, 0.9), filter: { cutoff: 9000, envAmount: 0 }, volumeDb: -4 }],
  ['kalimba', 'Kalimba', 'thumb piano · chill, world', 'Mallets & bells', { osc1: osc('sine', 1, { fmIndex: 1.6, fmRatio: 3 }), ampEnv: env(0.001, 0.9, 0, 0.4), filter: { cutoff: 7000, envAmount: 0 }, volumeDb: -2 }],
  ['glockenspiel', 'Glockenspiel', 'high, ringing · bright, festive', 'Mallets & bells', { osc1: osc('sine', 1, { fmIndex: 6, fmRatio: 3.5, octave: 1 }), ampEnv: env(0.001, 1.1, 0, 0.8), filter: { cutoff: 12000, envAmount: 0 }, volumeDb: -3 }],
  ['steelDrum', 'Steel drum', 'tropical pan · reggae, calypso', 'Mallets & bells', { osc1: osc('sine', 1, { fmIndex: 3, fmRatio: 2.4 }), osc2: osc('sine', 0.3, { octave: 1 }), ampEnv: env(0.001, 0.9, 0, 0.4), filter: { cutoff: 6000, envAmount: 0 }, volumeDb: -4 }],
  ['handpan', 'Handpan', 'soft meditative drum · ambient, world', 'Mallets & bells', { osc1: osc('sine', 1, { fmIndex: 1.2, fmRatio: 2 }), osc2: osc('sine', 0.3, { octave: 1 }), ampEnv: env(0.002, 1.8, 0, 0.9), filter: { cutoff: 4000, envAmount: 0 }, chorus: 0.2, volumeDb: -4 }],
  // ---- Plucked strings
  ['nylonGuitar', 'Nylon guitar', 'soft classical guitar · bossa, folk', 'Plucked strings', { osc1: osc('triangle', 0.8), osc2: osc('sawtooth', 0.2), filter: { cutoff: 600, envAmount: 2.6, resonance: 1 }, filterEnv: env(0.001, 0.3, 0, 0.2), ampEnv: env(0.002, 1, 0, 0.4), volumeDb: -1 }],
  ['steelGuitar', 'Steel guitar', 'bright strummed strings · country, pop', 'Plucked strings', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.35, { cents: 7 }), filter: { cutoff: 1100, envAmount: 2.4, resonance: 1.5 }, filterEnv: env(0.001, 0.35, 0, 0.2), ampEnv: env(0.001, 1.2, 0, 0.5), chorus: 0.3, volumeDb: -6 }],
  ['harp', 'Harp', 'gliding, airy plucks · fantasy, ambient', 'Plucked strings', { osc1: osc('triangle', 0.9), osc2: osc('sine', 0.3, { octave: 1 }), filter: { cutoff: 2500, envAmount: 1.2 }, filterEnv: env(0.001, 0.4, 0, 0.3), ampEnv: env(0.002, 1.8, 0, 0.9), volumeDb: -4 }],
  ['pizzicato', 'Pizzicato', 'short plucked strings · orchestral, comedy', 'Plucked strings', { osc1: osc('sawtooth', 0.9), filter: { cutoff: 500, envAmount: 2.4 }, filterEnv: env(0.001, 0.12, 0, 0.1), ampEnv: env(0.001, 0.25, 0, 0.1), volumeDb: -4 }],
  ['koto', 'Koto', 'Japanese zither-like pluck', 'Plucked strings', { osc1: osc('triangle', 0.8), osc2: osc('sawtooth', 0.4, { cents: 5 }), filter: { cutoff: 900, envAmount: 2.8, resonance: 2 }, filterEnv: env(0.001, 0.25, 0, 0.2), ampEnv: env(0.001, 1.1, 0, 0.5), volumeDb: -2 }],
  // ---- Synth leads
  ['supersaw', 'Supersaw', 'huge detuned lead · EDM, trance', 'Synth leads', { osc1: osc('sawtooth', 0.7), osc2: osc('sawtooth', 0.5, { cents: 9 }), unison: 5, spread: 32, filter: { cutoff: 5000, envAmount: 0 }, ampEnv: env(0.01, 0.2, 0.8, 0.3), chorus: 0.3, volumeDb: -4 }],
  ['squareLead', 'Square lead', 'hollow classic lead · synthwave', 'Synth leads', { osc1: osc('square', 0.8), osc2: osc('square', 0.3, { cents: 8 }), filter: { cutoff: 3500, envAmount: 0.5 }, ampEnv: env(0.005, 0.1, 0.7, 0.15), lfo: { target: 'pitch', wave: 'sine', rate: 5.5, depth: 0.08 }, volumeDb: -16 }],
  ['pwmLead', 'PWM lead', 'moving pulse lead · 80s, synthwave', 'Synth leads', { osc1: osc('pwm', 0.9), pwmRate: 1.6, filter: { cutoff: 3000, envAmount: 1 }, ampEnv: env(0.01, 0.2, 0.75, 0.25), chorus: 0.45, volumeDb: -14 }],
  ['acidLead', 'Acid lead', 'squelchy resonant lead · acid, techno', 'Synth leads', { osc1: osc('sawtooth', 0.9), filter: { cutoff: 500, resonance: 12, envAmount: 4 }, filterEnv: env(0.001, 0.22, 0.15, 0.15), ampEnv: env(0.002, 0.2, 0.6, 0.1), drive: 0.3, volumeDb: -10 }],
  ['fmLead', 'FM lead', 'glassy digital lead · 80s pop', 'Synth leads', { osc1: osc('sine', 1, { fmIndex: 5, fmRatio: 2 }), filter: { cutoff: 9000, envAmount: 0 }, ampEnv: env(0.005, 0.3, 0.6, 0.2), lfo: { target: 'pitch', wave: 'sine', rate: 5, depth: 0.06 }, volumeDb: -11 }],
  ['tranceStab', 'Trance stab', 'short bright chord hit · trance, house', 'Synth leads', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.6, { cents: 12 }), unison: 3, spread: 25, filter: { cutoff: 700, envAmount: 4, resonance: 2 }, filterEnv: env(0.001, 0.22, 0, 0.2), ampEnv: env(0.002, 0.32, 0, 0.2), volumeDb: 2 }],
  ['whistle', 'Whistle lead', 'pure sine with vibrato · g-funk, hip-hop', 'Synth leads', { osc1: osc('sine', 1), filter: { cutoff: 9000, envAmount: 0 }, ampEnv: env(0.03, 0.1, 0.9, 0.2), lfo: { target: 'pitch', wave: 'sine', rate: 5.5, depth: 0.14 }, volumeDb: -15 }],
  ['sawLead', 'Saw lead', 'cutting classic lead · pop, rock', 'Synth leads', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.4, { cents: -10 }), filter: { cutoff: 2500, envAmount: 1.5 }, ampEnv: env(0.008, 0.2, 0.65, 0.2), volumeDb: -8 }],
  // ---- Bass
  ['subBass', 'Sub bass', 'deep pure sine · trap, hip-hop, dubstep', 'Bass', { osc1: osc('sine', 1), osc2: osc('triangle', 0.25), transpose: -12, filter: { cutoff: 350, envAmount: 0 }, ampEnv: env(0.006, 0.2, 0.9, 0.12), volumeDb: -17 }],
  ['acidBass', 'Acid bass', 'squelchy 303 style · acid house', 'Bass', { osc1: osc('sawtooth', 1), transpose: -12, filter: { cutoff: 220, resonance: 14, envAmount: 3.6 }, filterEnv: env(0.001, 0.28, 0.1, 0.12), ampEnv: env(0.002, 0.3, 0.6, 0.08), drive: 0.35, volumeDb: -11 }],
  ['fmBass', 'FM bass', 'clean digital punch · funk, pop', 'Bass', { osc1: osc('sine', 1, { fmIndex: 3, fmRatio: 1 }), transpose: -12, filter: { cutoff: 4000, envAmount: 0 }, ampEnv: env(0.002, 0.35, 0.5, 0.1), volumeDb: -10 }],
  ['pluckBass', 'Pluck bass', 'short synth pluck · house, disco', 'Bass', { osc1: osc('sawtooth', 0.9), osc2: osc('square', 0.3, { octave: -1 }), transpose: -12, filter: { cutoff: 250, envAmount: 3, resonance: 3 }, filterEnv: env(0.001, 0.2, 0.05, 0.1), ampEnv: env(0.002, 0.35, 0.1, 0.15), volumeDb: -5 }],
  ['wobbleBass', 'Wobble bass', 'LFO growl · dubstep, DnB', 'Bass', { osc1: osc('sawtooth', 0.8), osc2: osc('square', 0.5, { octave: -1 }), transpose: -12, filter: { cutoff: 380, resonance: 7, envAmount: 0 }, lfo: { target: 'filter', wave: 'sine', rate: 3, depth: 0.85 }, ampEnv: env(0.005, 0.2, 0.9, 0.12), drive: 0.3, volumeDb: -10 }],
  ['reeseBass', 'Reese bass', 'thick detuned drone-bass · DnB, jungle', 'Bass', { osc1: osc('sawtooth', 0.7), osc2: osc('sawtooth', 0.7, { cents: 14 }), unison: 3, spread: 20, transpose: -12, filter: { cutoff: 450, resonance: 2, envAmount: 0.4 }, ampEnv: env(0.01, 0.3, 0.9, 0.2), volumeDb: -8 }],
  ['moogBass', 'Moog bass', 'fat analogue bass · funk, R&B', 'Bass', { osc1: osc('sawtooth', 0.8), osc2: osc('square', 0.6, { octave: -1 }), transpose: -12, filter: { cutoff: 260, resonance: 4, envAmount: 2.8 }, filterEnv: env(0.002, 0.25, 0.3, 0.2), ampEnv: env(0.003, 0.25, 0.7, 0.12), volumeDb: -13 }],
  ['uprightBass', 'Upright bass', 'woody walking bass · jazz, bossa', 'Bass', { osc1: osc('triangle', 1), osc2: osc('sawtooth', 0.18), transpose: -12, filter: { cutoff: 260, envAmount: 2, resonance: 1.5 }, filterEnv: env(0.002, 0.2, 0, 0.1), ampEnv: env(0.004, 0.6, 0.15, 0.2), volumeDb: -2 }],
  // ---- Pads & atmosphere
  ['ensemblePad', 'Ensemble pad', 'wide, lush saw pad · pop, ambient', 'Pads & atmosphere', { osc1: osc('sawtooth', 0.7), osc2: osc('sawtooth', 0.5, { cents: 8 }), unison: 4, spread: 26, filter: { cutoff: 1500, envAmount: 0.5 }, filterEnv: env(0.8, 0.8, 0.8, 1), ampEnv: env(0.6, 0.5, 0.8, 1.6), chorus: 0.5, volumeDb: -5 }],
  ['choirPad', 'Choir pad', 'airy synthetic voices · cinematic', 'Pads & atmosphere', { osc1: osc('sawtooth', 0.7), osc2: osc('triangle', 0.5, { octave: 1 }), noise: 0.04, filter: { type: 'bandpass', cutoff: 900, resonance: 2.5, envAmount: 0.4 }, ampEnv: env(0.5, 0.4, 0.8, 1.4), lfo: { target: 'pitch', wave: 'sine', rate: 5, depth: 0.1 }, chorus: 0.4, volumeDb: 5 }],
  ['darkPad', 'Dark pad', 'low and brooding · horror, trap, drone', 'Pads & atmosphere', { osc1: osc('triangle', 0.8), osc2: osc('sawtooth', 0.35, { octave: -1 }), unison: 2, spread: 14, filter: { cutoff: 420, envAmount: 0.8, resonance: 1.5 }, filterEnv: env(1.2, 1, 0.7, 1.5), ampEnv: env(0.9, 0.6, 0.85, 2), volumeDb: -8 }],
  ['brightPad', 'Bright pad', 'open, sunny pad · pop, chillout', 'Pads & atmosphere', { osc1: osc('sawtooth', 0.6), osc2: osc('square', 0.35, { cents: 6 }), unison: 3, spread: 18, filter: { cutoff: 3200, envAmount: 0.4 }, ampEnv: env(0.4, 0.4, 0.85, 1.3), chorus: 0.4, volumeDb: -6 }],
  ['sweepPad', 'Sweep pad', 'slowly breathing filter · ambient, techno', 'Pads & atmosphere', { osc1: osc('sawtooth', 0.7), osc2: osc('sawtooth', 0.5, { cents: 10 }), unison: 3, spread: 22, filter: { cutoff: 600, resonance: 3, envAmount: 0 }, lfo: { target: 'filter', wave: 'sine', rate: 0.35, depth: 0.75 }, ampEnv: env(0.8, 0.6, 0.9, 2), chorus: 0.3, volumeDb: -7 }],
  ['cinematic', 'Cinematic swell', 'rising epic wash · film, trailer', 'Pads & atmosphere', { osc1: osc('sawtooth', 0.7), osc2: osc('sawtooth', 0.6, { octave: -1, cents: 6 }), unison: 5, spread: 40, filter: { cutoff: 500, envAmount: 2.5 }, filterEnv: env(2.2, 1.5, 0.7, 2), ampEnv: env(1.8, 0.8, 0.9, 2.8), chorus: 0.4, volumeDb: -7 }],
  ['vintageStrings', 'Vintage string machine', '70s ensemble · disco, dream-pop', 'Pads & atmosphere', { osc1: osc('sawtooth', 0.7), osc2: osc('sawtooth', 0.5, { cents: 12 }), unison: 2, spread: 12, filter: { cutoff: 2000, envAmount: 0 }, ampEnv: env(0.25, 0.3, 0.9, 0.8), chorus: 0.7, volumeDb: -2 }],
  ['glassHarmonics', 'Glass harmonics', 'airy bell-pad · ambient, new age', 'Pads & atmosphere', { osc1: osc('sine', 0.8, { fmIndex: 2, fmRatio: 4 }), osc2: osc('sine', 0.4, { octave: 1 }), filter: { cutoff: 9000, envAmount: 0 }, ampEnv: env(0.9, 0.7, 0.8, 2.5), chorus: 0.4, volumeDb: -11 }],
  // ---- Strings & winds
  ['violin', 'Violin', 'singing bowed string · classical, folk', 'Strings & winds', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.3, { cents: 6 }), filter: { cutoff: 3200, envAmount: 0.4, resonance: 1.5 }, ampEnv: env(0.09, 0.2, 0.85, 0.3), lfo: { target: 'pitch', wave: 'sine', rate: 5.6, depth: 0.14 }, chorus: 0.2, volumeDb: -12 }],
  ['cello', 'Cello', 'warm low bowed string · film, classical', 'Strings & winds', { osc1: osc('sawtooth', 0.8), osc2: osc('triangle', 0.4, { octave: -1 }), transpose: -12, filter: { cutoff: 1400, envAmount: 0.5, resonance: 1.2 }, ampEnv: env(0.14, 0.2, 0.85, 0.4), lfo: { target: 'pitch', wave: 'sine', rate: 5.2, depth: 0.12 }, volumeDb: -11 }],
  ['flute', 'Flute', 'breathy pure tone · classical, folk', 'Strings & winds', { osc1: osc('sine', 0.9), osc2: osc('triangle', 0.25, { octave: 1 }), noise: 0.05, filter: { cutoff: 5000, envAmount: 0 }, ampEnv: env(0.07, 0.1, 0.85, 0.2), lfo: { target: 'pitch', wave: 'sine', rate: 5, depth: 0.1 }, volumeDb: -14 }],
  ['clarinet', 'Clarinet', 'hollow woody reed · jazz, classical', 'Strings & winds', { osc1: osc('square', 0.8), osc2: osc('sine', 0.3, { octave: 1 }), filter: { cutoff: 1500, envAmount: 0.3 }, ampEnv: env(0.04, 0.1, 0.85, 0.15), lfo: { target: 'pitch', wave: 'sine', rate: 5, depth: 0.05 }, volumeDb: -15 }],
  ['oboe', 'Oboe', 'nasal double reed · classical, film', 'Strings & winds', { osc1: osc('sawtooth', 0.8), filter: { type: 'bandpass', cutoff: 1800, resonance: 2.2, envAmount: 0.3 }, ampEnv: env(0.05, 0.1, 0.85, 0.15), lfo: { target: 'pitch', wave: 'sine', rate: 5.3, depth: 0.07 }, volumeDb: 6 }],
  ['sax', 'Saxophone', 'smoky reed · jazz, soul, pop', 'Strings & winds', { osc1: osc('sawtooth', 0.7), osc2: osc('square', 0.4, { cents: 4 }), noise: 0.03, filter: { cutoff: 1500, resonance: 2.5, envAmount: 1 }, filterEnv: env(0.04, 0.2, 0.6, 0.2), ampEnv: env(0.04, 0.15, 0.85, 0.2), lfo: { target: 'pitch', wave: 'sine', rate: 5.2, depth: 0.1 }, volumeDb: -15 }],
  // ---- Brass
  ['trumpet', 'Trumpet', 'bright brass · jazz, mariachi, funk', 'Brass', { osc1: osc('sawtooth', 0.9), filter: { cutoff: 600, envAmount: 3, resonance: 1.5 }, filterEnv: env(0.04, 0.15, 0.6, 0.1), ampEnv: env(0.03, 0.1, 0.85, 0.12), volumeDb: -11 }],
  ['brassSection', 'Brass section', 'big stabbing horns · funk, ska, pop', 'Brass', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.6, { cents: 9 }), unison: 3, spread: 16, filter: { cutoff: 800, envAmount: 3, resonance: 1.5 }, filterEnv: env(0.05, 0.3, 0.6, 0.25), ampEnv: env(0.05, 0.2, 0.85, 0.25), volumeDb: -7 }],
  ['frenchHorn', 'French horn', 'round, noble brass · film, fanfare', 'Brass', { osc1: osc('triangle', 0.8), osc2: osc('sawtooth', 0.5), filter: { cutoff: 600, envAmount: 2, resonance: 1 }, filterEnv: env(0.1, 0.3, 0.7, 0.3), ampEnv: env(0.1, 0.2, 0.85, 0.3), volumeDb: -14 }],
  ['synthBrass', 'Synth brass', '80s brass hit · synth-pop, funk', 'Brass', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.7, { cents: 11 }), unison: 2, spread: 14, filter: { cutoff: 700, envAmount: 3.2, resonance: 2 }, filterEnv: env(0.03, 0.3, 0.5, 0.25), ampEnv: env(0.02, 0.2, 0.85, 0.25), chorus: 0.25, volumeDb: -7 }],
  // ---- World & Persian (synthesised imitations — not recorded instruments)
  ['santur', 'Santur', 'Persian hammered dulcimer', 'World & Persian', { osc1: osc('triangle', 0.8), osc2: osc('sawtooth', 0.45, { cents: 8 }), unison: 2, spread: 10, filter: { cutoff: 1500, envAmount: 3, resonance: 1.5 }, filterEnv: env(0.001, 0.35, 0, 0.3), ampEnv: env(0.001, 1.5, 0, 0.8), chorus: 0.3, volumeDb: 9 }],
  ['tar', 'Tar / Setar', 'Persian long-necked lute (plucked)', 'World & Persian', { osc1: osc('sawtooth', 0.8), osc2: osc('sine', 0.25, { octave: 1 }), filter: { cutoff: 950, envAmount: 2.4, resonance: 2 }, filterEnv: env(0.001, 0.3, 0, 0.2), ampEnv: env(0.001, 0.8, 0, 0.3), volumeDb: -5 }],
  ['kamancheh', 'Kamancheh', 'Persian spike fiddle (bowed)', 'World & Persian', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.3, { cents: 5 }), noise: 0.03, filter: { cutoff: 2500, resonance: 3, envAmount: 0.3 }, ampEnv: env(0.1, 0.2, 0.85, 0.3), lfo: { target: 'pitch', wave: 'sine', rate: 5.6, depth: 0.16 }, volumeDb: -13 }],
  ['ney', 'Ney', 'Persian reed flute, breathy', 'World & Persian', { osc1: osc('sine', 0.85), osc2: osc('triangle', 0.3, { octave: 1 }), noise: 0.12, noiseColor: 'pink', filter: { cutoff: 4500, envAmount: 0 }, ampEnv: env(0.1, 0.1, 0.85, 0.35), lfo: { target: 'pitch', wave: 'sine', rate: 5.2, depth: 0.18 }, volumeDb: -14 }],
  ['oud', 'Oud', 'fretless lute · Arabic, Turkish, Persian', 'World & Persian', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.5, { cents: 10 }), filter: { cutoff: 800, envAmount: 2.4, resonance: 1.5 }, filterEnv: env(0.001, 0.25, 0, 0.15), ampEnv: env(0.001, 0.9, 0, 0.3), volumeDb: -8 }],
  ['sitar', 'Sitar', 'buzzing Indian lute', 'World & Persian', { osc1: osc('sawtooth', 0.8), osc2: osc('sawtooth', 0.4, { cents: 22 }), filter: { type: 'lowpass', cutoff: 1600, resonance: 5, envAmount: 1.5 }, filterEnv: env(0.001, 0.4, 0.2, 0.3), ampEnv: env(0.001, 1.4, 0, 0.5), drive: 0.2, volumeDb: 2 }],
  ['zurna', 'Zurna', 'loud nasal shawm · Middle-East folk', 'World & Persian', { osc1: osc('square', 0.7), osc2: osc('sawtooth', 0.5, { cents: 9 }), filter: { type: 'bandpass', cutoff: 2200, resonance: 4, envAmount: 0.4 }, ampEnv: env(0.03, 0.1, 0.9, 0.12), lfo: { target: 'pitch', wave: 'sine', rate: 6, depth: 0.1 }, volumeDb: 4 }],
  // ---- Chip & retro
  ['chipSquare', 'Chip square', '8-bit pulse · game music, chiptune', 'Chip & retro', { osc1: osc('square', 0.9), filter: { cutoff: 16000, envAmount: 0 }, ampEnv: env(0.001, 0.08, 0.7, 0.05), volumeDb: -14 }],
  ['chipPulse', 'Chip pulse 25%', 'thin NES pulse · game music', 'Chip & retro', { osc1: osc('pulse', 0.9), pulseWidth: 0.25, filter: { cutoff: 16000, envAmount: 0 }, ampEnv: env(0.001, 0.08, 0.7, 0.05), volumeDb: -15 }],
  ['chipTri', 'Chip triangle', 'NES-style bass / soft lead', 'Chip & retro', { osc1: osc('triangle', 1), filter: { cutoff: 16000, envAmount: 0 }, ampEnv: env(0.001, 0.05, 1, 0.03), volumeDb: -14 }],
  ['arcadeArp', 'Arcade arp', 'very thin pulse for fast arps', 'Chip & retro', { osc1: osc('pulse', 0.9), pulseWidth: 0.12, filter: { cutoff: 16000, envAmount: 0 }, ampEnv: env(0.001, 0.07, 0.3, 0.04), volumeDb: -8 }],
  // ---- Textures & FX
  ['noiseWash', 'Noise wash', 'airy rushing noise · risers, ambient', 'Textures & FX', { osc1: osc('sine', 0), osc2: osc('sine', 0), noise: 0.9, noiseColor: 'pink', filter: { type: 'lowpass', cutoff: 1500, resonance: 1.2, envAmount: 0 }, lfo: { target: 'filter', wave: 'sine', rate: 0.2, depth: 0.7 }, ampEnv: env(1.5, 1, 0.9, 2.5), volumeDb: 0 }],
  ['oceanSwell', 'Ocean swell', 'slow waves of low noise', 'Textures & FX', { osc1: osc('sine', 0), osc2: osc('sine', 0), noise: 1, noiseColor: 'brown', filter: { cutoff: 500, resonance: 0.7, envAmount: 0 }, lfo: { target: 'amp', wave: 'sine', rate: 0.25, depth: 0.7 }, ampEnv: env(1.2, 1, 0.9, 2.2), volumeDb: 1 }],
  ['sciFi', 'Sci-fi tone', 'alien FM wobble · soundtrack', 'Textures & FX', { osc1: osc('sine', 1, { fmIndex: 8, fmRatio: 1.41 }), osc2: osc('triangle', 0.3, { octave: 1, cents: 15 }), filter: { cutoff: 7000, envAmount: 0 }, lfo: { target: 'pitch', wave: 'sine', rate: 6.5, depth: 0.5 }, ampEnv: env(0.2, 0.4, 0.8, 1), chorus: 0.4, volumeDb: -14 }],
  ['ghostVoice', 'Ghost voice', 'hollow whispering tone · horror, ambient', 'Textures & FX', { osc1: osc('triangle', 0.7), osc2: osc('sine', 0.5, { octave: 1, cents: 18 }), noise: 0.1, noiseColor: 'pink', filter: { type: 'bandpass', cutoff: 1100, resonance: 5, envAmount: 0 }, lfo: { target: 'filter', wave: 'sine', rate: 0.5, depth: 0.5 }, ampEnv: env(1, 0.6, 0.85, 2.2), chorus: 0.5, volumeDb: 8 }]
];

export const FACTORY_SOUNDS: Record<string, FactorySound> = Object.fromEntries(SPECS.map(([id, label, hint, group, patch]) => [id, { label, hint, group, patch: makePatch(patch) }]));
export const FACTORY_IDS = Object.keys(FACTORY_SOUNDS);
export const isFactorySound = (v: unknown): v is string => typeof v === 'string' && Object.prototype.hasOwnProperty.call(FACTORY_SOUNDS, v);
