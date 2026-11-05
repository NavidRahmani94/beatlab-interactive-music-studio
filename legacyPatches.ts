// FILE: The 11 basic instruments (electric piano, warm pad, ...) as synth patches, so sound engine 2 can play them too.
// They approximate the Tone.js versions in rig.ts (buildMelody). Used only for live SHAPE LAB playing; the song and the export keep the originals.
import { SynthPatch, makePatch, env } from './synth';

const f = (cutoff: number) => ({ type: 'lowpass' as const, cutoff, resonance: 1, rolloff: 12 as const, envAmount: 0 });
const saw = (level = 1) => ({ wave: 'sawtooth' as const, level });
export const LEGACY_PATCHES: Record<string, SynthPatch> = {
  electricPiano: makePatch({ osc1: { wave: 'sine', level: 1, fmIndex: 5, fmRatio: 3.01 }, osc2: { level: 0 }, filter: f(16000), ampEnv: env(0.005, 1.2, 0.15, 0.8), volumeDb: -1 }),
  pluck: makePatch({ osc1: { wave: 'square', level: 1 }, osc2: { level: 0 }, filter: f(3200), ampEnv: env(0.002, 0.2, 0, 0.12), volumeDb: -12 }),
  warmPad: makePatch({ osc1: saw(), osc2: { level: 0 }, unison: 3, spread: 30, filter: f(1400), ampEnv: env(0.35, 0.4, 0.7, 1.2), volumeDb: -6 }),
  bell: makePatch({ osc1: { wave: 'sine', level: 1, fmIndex: 7, fmRatio: 3.5 }, osc2: { level: 0 }, filter: f(16000), ampEnv: env(0.001, 1.8, 0, 1.2), volumeDb: -1 }),
  lead: makePatch({ osc1: saw(), osc2: { level: 0 }, unison: 2, spread: 14, filter: f(4200), ampEnv: env(0.008, 0.18, 0.55, 0.25), volumeDb: -4 }),
  bass: makePatch({ osc1: saw(), osc2: { level: 0 }, transpose: -12, filter: f(900), ampEnv: env(0.005, 0.25, 0.6, 0.2), volumeDb: -11 }),
  strings: makePatch({ osc1: saw(), osc2: { level: 0 }, unison: 3, spread: 22, filter: f(2200), ampEnv: env(0.5, 0.3, 0.85, 1.4), volumeDb: -9 }),
  airPad: makePatch({ osc1: { wave: 'triangle', level: 1 }, osc2: { level: 0 }, unison: 3, spread: 40, filter: f(1800), ampEnv: env(0.9, 0.5, 0.8, 2), volumeDb: -7 }),
  glassPad: makePatch({ osc1: { wave: 'sine', level: 1, fmIndex: 3, fmRatio: 4 }, osc2: { level: 0 }, filter: f(16000), ampEnv: env(0.7, 0.6, 0.8, 2), volumeDb: -3 }),
  drone: makePatch({ osc1: saw(), osc2: { level: 0 }, unison: 2, spread: 12, transpose: -12, filter: f(500), ampEnv: env(1.2, 0.5, 1, 2), volumeDb: -5 }),
  softSynth: makePatch({ osc1: saw(), osc2: { level: 0 }, unison: 3, spread: 18, filter: f(2600), ampEnv: env(0.02, 0.25, 0.5, 0.5), volumeDb: -4 })
};
