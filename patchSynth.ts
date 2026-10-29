import * as Tone from 'tone';
import { OscSettings, SynthPatch } from './synth';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** What the Rig needs from any melodic sound source (the built-in PolySynths and the patch synth both fit). */
export interface NoteSynth {
  triggerAttackRelease(note: string, duration: number, time: number, velocity: number): unknown;
  releaseAll(): unknown;
  dispose(): unknown;
  connect(destination: any): unknown;
  /** Key down / key up (used by live playing from a MIDI keyboard). */
  triggerAttack?(note: string, time?: number, velocity?: number): unknown;
  triggerRelease?(note: string, time?: number): unknown;
  volume: { value: number };
}

type Voice = {
  osc1: Tone.OmniOscillator<any>; osc2: Tone.OmniOscillator<any>; noise: Tone.Noise;
  g1: Tone.Gain; g2: Tone.Gain; gn: Tone.Gain;
  filter: Tone.Filter; fenv: Tone.FrequencyEnvelope; aenv: Tone.AmplitudeEnvelope; vel: Tone.Gain;
  trem: Tone.Gain | null; lfo: Tone.LFO | null;
  busyUntil: number;
};

export const MAX_VOICES = 16;
const oscType = (o: OscSettings, p: SynthPatch): string => {
  if (o.wave === 'pulse' || o.wave === 'pwm') return o.wave;
  if (o.fmIndex > 0) return `fm${o.wave}`;
  if (p.unison > 1) return `fat${o.wave}`;
  return o.wave;
};

function makeOsc(o: OscSettings, p: SynthPatch): Tone.OmniOscillator<any> {
  const type = oscType(o, p);
  const opts: any = { type, detune: o.cents };
  if (type.startsWith('fm')) { opts.harmonicity = o.fmRatio; opts.modulationIndex = o.fmIndex; }
  else if (type.startsWith('fat')) { opts.count = p.unison; opts.spread = p.spread; }
  else if (type === 'pulse') opts.width = (p.pulseWidth - 0.5) * 2;
  else if (type === 'pwm') opts.modulationFrequency = p.pwmRate;
  return new Tone.OmniOscillator(opts);
}

/**
 * A polyphonic synthesizer built from a SynthPatch:
 *   osc1 + osc2 + noise -> filter (with its own envelope) -> amp envelope -> velocity -> [tremolo] -> [drive] -> [chorus] -> volume
 * Voices are created on demand (up to 16) and sources are only running while a note sounds, so it is cheap when idle.
 * All timing uses explicit audio times, so live playback and the offline export behave identically.
 */
export class PatchSynth implements NoteSynth {
  readonly volume: { value: number };
  private patch: SynthPatch;
  private voices: Voice[] = [];
  private held = new Map<string, Voice>();
  private bus: Tone.Gain;
  private fx: Tone.ToneAudioNode[] = [];
  private out: Tone.Volume;
  private ctx: ReturnType<typeof Tone.getContext>;

  constructor(patch: SynthPatch) {
    this.patch = patch;
    this.ctx = Tone.getContext(); // voices are created later, while notes are scheduled (in the offline export the global context has already moved on)
    this.bus = new Tone.Gain(1);
    this.out = new Tone.Volume(patch.volumeDb);
    this.volume = { get value() { return 0; }, set value(_v: number) { /* the patch's own volume is used */ } };
    let node: Tone.ToneAudioNode = this.bus;
    if (patch.drive > 0) { const d = new Tone.Distortion({ distortion: Math.min(0.95, patch.drive * 0.9), oversample: '2x' }); node.connect(d); node = d; this.fx.push(d); }
    if (patch.chorus > 0) { const c = new Tone.Chorus({ frequency: 1.4, delayTime: 3.5, depth: 0.7, spread: 180, wet: patch.chorus }).start(); node.connect(c); node = c; this.fx.push(c); }
    node.connect(this.out);
  }

  connect(destination: any): this { this.out.connect(destination); return this; }

  private createVoice(): Voice {
    const previous = Tone.getContext();
    if (previous === this.ctx) return this.buildVoice();
    Tone.setContext(this.ctx);
    try { return this.buildVoice(); } finally { Tone.setContext(previous); }
  }

  private buildVoice(): Voice {
    const p = this.patch;
    const osc1 = makeOsc(p.osc1, p), osc2 = makeOsc(p.osc2, p);
    const noise = new Tone.Noise(p.noiseColor);
    const g1 = new Tone.Gain(p.osc1.level), g2 = new Tone.Gain(p.osc2.level), gn = new Tone.Gain(p.noise);
    const filter = new Tone.Filter({ type: p.filter.type, frequency: 0, Q: p.filter.resonance, rolloff: (-p.filter.rolloff) as -12 | -24 });
    const fenv = new Tone.FrequencyEnvelope({ attack: p.filterEnv.a, decay: p.filterEnv.d, sustain: p.filterEnv.s, release: p.filterEnv.r, baseFrequency: p.filter.cutoff, octaves: p.filter.envAmount, exponent: 2 });
    fenv.connect(filter.frequency as any);
    const aenv = new Tone.AmplitudeEnvelope({ attack: p.ampEnv.a, decay: p.ampEnv.d, sustain: p.ampEnv.s, release: p.ampEnv.r });
    const vel = new Tone.Gain(1);
    osc1.connect(g1); osc2.connect(g2); noise.connect(gn);
    g1.connect(filter); g2.connect(filter); gn.connect(filter);
    filter.connect(aenv); aenv.connect(vel);
    let trem: Tone.Gain | null = null;
    let lfo: Tone.LFO | null = null;
    if (p.lfo.target === 'amp') {
      trem = new Tone.Gain(0);
      vel.connect(trem); trem.connect(this.bus);
      lfo = new Tone.LFO({ frequency: p.lfo.rate, type: p.lfo.wave }).start();
      lfo.connect(trem.gain as any);
      lfo.min = 1 - p.lfo.depth; lfo.max = 1;
    } else {
      vel.connect(this.bus);
      if (p.lfo.target === 'pitch') {
        lfo = new Tone.LFO({ frequency: p.lfo.rate, type: p.lfo.wave }).start();
        lfo.connect(osc1.detune as any); lfo.connect(osc2.detune as any);
        lfo.min = -p.lfo.depth * 100; lfo.max = p.lfo.depth * 100;
      } else if (p.lfo.target === 'filter') {
        lfo = new Tone.LFO({ frequency: p.lfo.rate, type: p.lfo.wave }).start();
        lfo.connect(filter.frequency as any);
        const span = p.filter.cutoff * 0.9 * p.lfo.depth;
        lfo.min = -span; lfo.max = span * 1.6;
      }
    }
    return { osc1, osc2, noise, g1, g2, gn, filter, fenv, aenv, vel, trem, lfo, busyUntil: 0 };
  }

  private allocate(time: number): Voice {
    let free: Voice | undefined;
    for (const v of this.voices) if (v.busyUntil <= time && (!free || v.busyUntil < free.busyUntil)) free = v;
    if (free) return free;
    if (this.voices.length < MAX_VOICES) { const v = this.createVoice(); this.voices.push(v); return v; }
    // everybody is busy: take over the voice that would finish first (it is cut a few ms before the new note)
    const steal = this.voices.reduce((a, b) => (b.busyUntil < a.busyUntil ? b : a));
    for (const key of [...this.held.keys()]) if (this.held.get(key) === steal) this.held.delete(key);
    const cut = Math.max(0, time - 0.004);
    this.stopSources(steal, cut);
    return steal;
  }

  private stopSources(v: Voice, at: number): void {
    const p = this.patch;
    try { v.osc1.stop(at); } catch { /* not running */ }
    try { v.osc2.stop(at); } catch { /* not running */ }
    if (p.noise > 0) { try { v.noise.stop(at); } catch { /* not running */ } }
  }

  private startVoice(v: Voice, note: string, time: number, velocity: number): void {
    const p = this.patch;
    const f = Tone.Frequency(note).transpose(p.transpose).toFrequency();
    v.osc1.frequency.setValueAtTime(f * Math.pow(2, p.osc1.octave), time);
    v.osc2.frequency.setValueAtTime(f * Math.pow(2, p.osc2.octave), time);
    v.vel.gain.setValueAtTime(Math.max(0.05, Math.min(1, velocity)), time);
    if (p.osc1.level > 0) v.osc1.start(time);
    if (p.osc2.level > 0) v.osc2.start(time);
    if (p.noise > 0) v.noise.start(time);
    v.aenv.triggerAttack(time, 1);
    v.fenv.triggerAttack(time, 1);
    v.busyUntil = Infinity;
  }
  private releaseVoice(v: Voice, time: number): void {
    const p = this.patch;
    v.aenv.triggerRelease(time);
    v.fenv.triggerRelease(time);
    const end = time + Math.max(p.ampEnv.r, p.filterEnv.r) + 0.08;
    this.stopSources(v, end);
    v.busyUntil = end + 0.01;
  }

  triggerAttackRelease(note: string, duration: number, time: number = Tone.now(), velocity = 0.8): this {
    const v = this.allocate(time);
    this.startVoice(v, note, time, velocity);
    this.releaseVoice(v, time + Math.max(0.02, duration));
    return this;
  }
  /** Key down: the note rings until triggerRelease (used by the on-screen keyboard). */
  triggerAttack(note: string, time: number = Tone.now(), velocity = 0.8): this {
    this.triggerRelease(note, time);
    const v = this.allocate(time);
    this.startVoice(v, note, time, velocity);
    this.held.set(note, v);
    return this;
  }
  triggerRelease(note: string, time: number = Tone.now()): this {
    const v = this.held.get(note);
    if (!v) return this;
    this.held.delete(note);
    this.releaseVoice(v, time);
    return this;
  }
  releaseAll(): this {
    const now = Tone.now();
    for (const v of this.voices) if (v.busyUntil > now) this.releaseVoice(v, now);
    this.held.clear();
    return this;
  }
  dispose(): this {
    try { this.releaseAll(); } catch { /* context may be gone */ }
    for (const v of this.voices) {
      [v.osc1, v.osc2, v.noise, v.g1, v.g2, v.gn, v.filter, v.fenv, v.aenv, v.vel, v.trem, v.lfo].forEach(n => { try { n?.dispose(); } catch { /* already disposed */ } });
    }
    this.voices = [];
    [...this.fx, this.bus, this.out].forEach(n => { try { n.dispose(); } catch { /* already disposed */ } });
    return this;
  }
}
