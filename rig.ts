import * as Tone from 'tone';
import { Instrument } from './pattern';
import { MelodyNote } from './melody';
import { ChannelName, Channels, DRUM_CHANNELS, MasterSettings, REVERB_SIZES, compressorSettings, defaultChannel, defaultMaster, delaySeconds, effectiveMuted } from './mixer';
import { DrumKitId, MelodyInstrumentId } from './instruments';
import { KIND_DEFAULT_INSTRUMENT, TrackDef } from './tracks';
import { FACTORY_SOUNDS, SynthPatch, SynthSlot, customId, isCustomRef, isFactorySound } from './synth';
import { NoteSynth, PatchSynth } from './patchSynth';
import { arpAt } from './arp';
import { PatternData, notesFor } from './song';

type Strip = { vol: Tone.Volume; pan: Tone.Panner; reverbSend: Tone.Gain; delaySend: Tone.Gain };

/* eslint-disable @typescript-eslint/no-explicit-any */
type KitDef = { kick: any; snare: any; hat: any; clap: any; dur: Record<Instrument, number>; kickNote?: string };
const hatOf = (decay: number, resonance: number, mod = 28, oct = 1.2) => ({ envelope: { attack: 0.001, decay, release: 0.01 }, harmonicity: 5.1, modulationIndex: mod, resonance, octaves: oct });
const KITS: Record<DrumKitId, KitDef> = {
  classic: {
    kick: { pitchDecay: 0.05, octaves: 8, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.08 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } },
    hat: { envelope: { attack: 0.001, decay: 0.055, release: 0.02 }, harmonicity: 5.1, modulationIndex: 24, resonance: 3000, octaves: 1 },
    clap: { noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.23, sustain: 0 } },
    dur: { kick: 0.25, snare: 0.12, hat: 0.1, clap: 0.12 }
  },
  kit808: {
    kick: { pitchDecay: 0.12, octaves: 3.5, envelope: { attack: 0.001, decay: 1.0, sustain: 0, release: 0.2 } },
    snare: { noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } },
    hat: { envelope: { attack: 0.001, decay: 0.035, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 6000, octaves: 1.5 },
    clap: { noise: { type: 'white' }, envelope: { attack: 0.003, decay: 0.32, sustain: 0 } },
    dur: { kick: 0.5, snare: 0.2, hat: 0.08, clap: 0.2 }
  },
  tight: {
    kick: { pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } },
    hat: { envelope: { attack: 0.001, decay: 0.03, release: 0.01 }, harmonicity: 5.1, modulationIndex: 20, resonance: 4000, octaves: 1 },
    clap: { noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } },
    dur: { kick: 0.2, snare: 0.1, hat: 0.08, clap: 0.1 }
  },
  house909: {
    kick: { pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.1 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } },
    hat: hatOf(0.05, 7000, 32, 1.5),
    clap: { noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.28, sustain: 0 } },
    dur: { kick: 0.3, snare: 0.15, hat: 0.1, clap: 0.18 }
  },
  trap: {
    kick: { pitchDecay: 0.15, octaves: 3, envelope: { attack: 0.001, decay: 1.5, sustain: 0, release: 0.3 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.13, sustain: 0 } },
    hat: hatOf(0.025, 8000, 34, 1.5),
    clap: { noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.22, sustain: 0 } },
    dur: { kick: 0.9, snare: 0.1, hat: 0.06, clap: 0.15 }
  },
  lofi: {
    kick: { pitchDecay: 0.06, octaves: 5, envelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.1 } },
    snare: { noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.22, sustain: 0 } },
    hat: hatOf(0.04, 2800, 16, 1),
    clap: { noise: { type: 'pink' }, envelope: { attack: 0.003, decay: 0.26, sustain: 0 } },
    dur: { kick: 0.25, snare: 0.15, hat: 0.07, clap: 0.18 }
  },
  rock: {
    kick: { pitchDecay: 0.02, octaves: 4, envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.06 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.24, sustain: 0 } },
    hat: hatOf(0.08, 3500, 22, 1),
    clap: { noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } },
    dur: { kick: 0.2, snare: 0.18, hat: 0.1, clap: 0.12 }
  },
  electro: {
    kick: { pitchDecay: 0.07, octaves: 7, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.08 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } },
    hat: hatOf(0.045, 6000, 30, 1.3),
    clap: { noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.2, sustain: 0 } },
    dur: { kick: 0.22, snare: 0.12, hat: 0.08, clap: 0.14 }
  },
  dnb: {
    kick: { pitchDecay: 0.025, octaves: 5, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.17, sustain: 0 } },
    hat: hatOf(0.03, 7000, 26, 1.2),
    clap: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } },
    dur: { kick: 0.15, snare: 0.12, hat: 0.06, clap: 0.1 }
  },
  industrial: {
    kick: { pitchDecay: 0.08, octaves: 10, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.12 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.32, sustain: 0 } },
    hat: hatOf(0.11, 1800, 40, 1),
    clap: { noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.38, sustain: 0 } },
    dur: { kick: 0.35, snare: 0.25, hat: 0.12, clap: 0.28 }
  },
  chip: {
    kick: { pitchDecay: 0.02, octaves: 3, oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.03 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } },
    hat: hatOf(0.02, 9000, 12, 1),
    clap: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 } },
    dur: { kick: 0.12, snare: 0.07, hat: 0.04, clap: 0.06 }
  }
};

type MelodyBuild = { synth: NoteSynth; filter: Tone.Filter | null; volume: number; shift: number };
function buildMelody(id: MelodyInstrumentId): MelodyBuild {
  switch (id) {
    case 'electricPiano':
      return {
        synth: new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 10, oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 1.2, sustain: 0.15, release: 0.8 }, modulation: { type: 'square' }, modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 } } as any),
        filter: null, volume: -1, shift: 0
      };
    case 'pluck':
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.12 } } as any),
        filter: new Tone.Filter(3200, 'lowpass'), volume: -12, shift: 0
      };
    case 'warmPad':
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 30 }, envelope: { attack: 0.35, decay: 0.4, sustain: 0.7, release: 1.2 } } as any),
        filter: new Tone.Filter(1400, 'lowpass'), volume: -6, shift: 0
      };
    case 'bell':
      return {
        synth: new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.5, modulationIndex: 14, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 1.8, sustain: 0, release: 1.2 }, modulation: { type: 'sine' }, modulationEnvelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 } } as any),
        filter: null, volume: -1, shift: 0
      };
    case 'lead':
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 2, spread: 14 }, envelope: { attack: 0.008, decay: 0.18, sustain: 0.55, release: 0.25 } } as any),
        filter: new Tone.Filter(4200, 'lowpass'), volume: -4, shift: 0
      };
    case 'bass':
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.6, release: 0.2 } } as any),
        filter: new Tone.Filter(900, 'lowpass'), volume: -11, shift: -12
      };
    case 'strings':
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 22 }, envelope: { attack: 0.5, decay: 0.3, sustain: 0.85, release: 1.4 } } as any),
        filter: new Tone.Filter(2200, 'lowpass'), volume: -9, shift: 0
      };
    case 'airPad':
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fattriangle', count: 3, spread: 40 }, envelope: { attack: 0.9, decay: 0.5, sustain: 0.8, release: 2.0 } } as any),
        filter: new Tone.Filter(1800, 'lowpass'), volume: -7, shift: 0
      };
    case 'glassPad':
      return {
        synth: new Tone.PolySynth(Tone.FMSynth, { harmonicity: 4, modulationIndex: 3, oscillator: { type: 'sine' }, envelope: { attack: 0.7, decay: 0.6, sustain: 0.8, release: 2.0 }, modulation: { type: 'sine' }, modulationEnvelope: { attack: 0.8, decay: 0.5, sustain: 0.6, release: 1.5 } } as any),
        filter: null, volume: -3, shift: 0
      };
    case 'drone':
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 2, spread: 12 }, envelope: { attack: 1.2, decay: 0.5, sustain: 1, release: 2.0 } } as any),
        filter: new Tone.Filter(500, 'lowpass'), volume: -5, shift: -12
      };
    case 'softSynth':
    default:
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 18 }, envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.5 } } as any),
        filter: new Tone.Filter(2600, 'lowpass'), volume: -4, shift: 0
      };
  }
}

type Voice = { sig: string; synth: NoteSynth; filter: Tone.Filter | null; shift: number };
type TrackRuntime = { def: TrackDef; voice: Voice };

/** Notes that START on this step (the ones that need a trigger). */
export function notesStartingAt(notes: MelodyNote[], step: number): MelodyNote[] { return notes.filter(n => n.step === step); }

/**
 * The complete sound path:
 *   instruments -> channel strips (volume, pan, mute/solo; 4 drums + one per track) -> [reverb send / delay send buses] -> ONE master in
 *   -> EQ (low/mid/high) -> compressor -> master reverb -> master volume -> limiter -> output (+ meter, analyser)
 * The SAME class is used for live playback and for the offline WAV render, so both sound identical.
 * Create it while the Tone context you want (live or offline) is the active one.
 */
export class Rig {
  private masterIn: Tone.Gain;
  private eq: Tone.EQ3;
  private comp: Tone.Compressor;
  private masterReverb: Tone.Reverb;
  private masterVol: Tone.Volume;
  private limiter: Tone.Limiter;
  private meter: Tone.Meter;
  private spectrum: Tone.Analyser;
  private wave: Tone.Analyser;
  private sendReverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private strips = {} as Record<ChannelName, Strip>;
  private kick: Tone.MembraneSynth;
  private snare: Tone.NoiseSynth;
  private hat: Tone.MetalSynth;
  private clap: Tone.NoiseSynth;
  private tracks = new Map<string, TrackRuntime>();
  private custom = new Map<string, SynthSlot>();
  private audition: { sig: string; synth: PatchSynth } | null = null;
  private auditionOut: Tone.Volume;
  private kitDur: Record<Instrument, number> = KITS.classic.dur;
  private kickNote = 'C1';
  private muted: Record<ChannelName, boolean> = {};
  private channels: Channels = {};
  private bpm = 120;
  private master: MasterSettings = defaultMaster();

  constructor() {
    this.masterIn = new Tone.Gain(1);
    this.eq = new Tone.EQ3({ low: 0, mid: 0, high: 0, lowFrequency: 250, highFrequency: 2500 });
    this.comp = new Tone.Compressor({ threshold: -6, ratio: 1, attack: 0.02, release: 0.2 });
    this.masterReverb = new Tone.Reverb({ decay: REVERB_SIZES.hall.seconds, preDelay: 0.01 });
    this.masterVol = new Tone.Volume(0);
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.meter = new Tone.Meter({ smoothing: 0.85 });
    this.spectrum = new Tone.Analyser('fft', 128);
    this.spectrum.smoothing = 0.8;
    this.wave = new Tone.Analyser('waveform', 256);
    this.masterIn.chain(this.eq, this.comp, this.masterReverb, this.masterVol, this.limiter);
    this.limiter.connect(this.meter);
    this.limiter.connect(this.spectrum);
    this.limiter.connect(this.wave);

    this.sendReverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.01 });
    this.sendReverb.wet.value = 1;
    this.sendReverb.connect(this.masterIn);
    this.delay = new Tone.FeedbackDelay({ delayTime: 0.375, feedback: 0.35 });
    this.delay.wet.value = 1;
    this.delay.connect(this.masterIn);

    DRUM_CHANNELS.forEach(name => this.makeStrip(name));

    const classic = KITS.classic;
    this.kick = new Tone.MembraneSynth(classic.kick).connect(this.strips.kick.vol);
    this.snare = new Tone.NoiseSynth(classic.snare).connect(this.strips.snare.vol);
    this.hat = new Tone.MetalSynth(classic.hat).connect(this.strips.hat.vol);
    this.hat.frequency.value = 260;
    this.clap = new Tone.NoiseSynth(classic.clap).connect(this.strips.clap.vol);
    this.kick.volume.value = -7;
    this.snare.volume.value = -13;
    this.hat.volume.value = -12;
    this.clap.volume.value = -11;

    this.auditionOut = new Tone.Volume(0).connect(this.masterIn);
    this.setMaster(defaultMaster());
  }

  private makeStrip(name: ChannelName): Strip {
    const vol = new Tone.Volume(0);
    const pan = new Tone.Panner(0);
    const reverbSend = new Tone.Gain(0);
    const delaySend = new Tone.Gain(0);
    vol.connect(pan);
    pan.connect(this.masterIn);
    pan.connect(reverbSend);
    reverbSend.connect(this.sendReverb);
    pan.connect(delaySend);
    delaySend.connect(this.delay);
    const strip = { vol, pan, reverbSend, delaySend };
    this.strips[name] = strip;
    this.muted[name] = false;
    return strip;
  }
  private disposeStrip(name: ChannelName): void {
    const s = this.strips[name];
    if (!s) return;
    s.vol.dispose(); s.pan.dispose(); s.reverbSend.dispose(); s.delaySend.dispose();
    delete this.strips[name];
    delete this.muted[name];
  }

  /** The patch behind an instrument id (built-in library sound or the user's own synth), or null for the older built-in sounds. */
  private patchFor(ref: MelodyInstrumentId): SynthPatch | null {
    if (isFactorySound(ref)) return FACTORY_SOUNDS[ref].patch;
    if (isCustomRef(ref)) return this.custom.get(customId(ref))?.patch ?? null;
    return null;
  }
  private signature(ref: MelodyInstrumentId): string {
    const p = this.patchFor(ref);
    return p ? `${ref}|${JSON.stringify(p)}` : ref;
  }

  private makeVoice(def: TrackDef): Voice {
    // a deleted user synth falls back to the kind's default sound instead of silence
    const wanted = def.instrument;
    const ref = isCustomRef(wanted) && !this.custom.has(customId(wanted)) ? KIND_DEFAULT_INSTRUMENT[def.kind] : wanted;
    const patch = this.patchFor(ref);
    const out = this.strips[def.id].vol;
    if (patch) {
      const synth = new PatchSynth(patch);
      synth.connect(out);
      return { sig: this.signature(wanted), synth, filter: null, shift: 0 };
    }
    const m = buildMelody(ref);
    m.synth.volume.value = m.volume;
    if (m.filter) { m.synth.connect(m.filter); m.filter.connect(out); } else m.synth.connect(out);
    return { sig: this.signature(wanted), synth: m.synth, filter: m.filter, shift: m.shift };
  }
  private disposeVoice(v: Voice): void { v.synth.releaseAll(); v.synth.dispose(); v.filter?.dispose(); }

  /**
   * Makes the audio graph match the track list: new tracks get a strip and an instrument, deleted tracks are removed,
   * and a track whose instrument (or user synth patch) changed gets a fresh voice.
   */
  setTracks(defs: TrackDef[]): void {
    const wanted = new Set(defs.map(d => d.id));
    for (const [id, rt] of [...this.tracks]) if (!wanted.has(id)) { this.disposeVoice(rt.voice); this.tracks.delete(id); this.disposeStrip(id); }
    defs.forEach(def => {
      const have = this.tracks.get(def.id);
      if (!have) {
        if (!this.strips[def.id]) this.makeStrip(def.id);
        this.tracks.set(def.id, { def, voice: this.makeVoice(def) });
        return;
      }
      have.def = def;
      if (have.voice.sig !== this.signature(def.instrument)) { this.disposeVoice(have.voice); have.voice = this.makeVoice(def); }
    });
    this.setChannels(this.channels);
  }

  /** The user's own synths. Tracks that use one are rebuilt when its patch changes. */
  setSynths(synths: SynthSlot[]): void {
    this.custom = new Map(synths.map(s => [s.id, s]));
    this.setTracks([...this.tracks.values()].map(t => t.def));
  }

  // ---- the Synth Lab keyboard: one extra voice that is heard even when no track uses the synth
  private ensureAudition(patch: SynthPatch): PatchSynth {
    const sig = JSON.stringify(patch);
    if (!this.audition || this.audition.sig !== sig) {
      if (this.audition) this.audition.synth.dispose();
      const synth = new PatchSynth(patch);
      synth.connect(this.auditionOut);
      this.audition = { sig, synth };
    }
    return this.audition.synth;
  }
  auditionDown(patch: SynthPatch, note: string, velocity = 0.8): void { this.ensureAudition(patch).triggerAttack(note, Tone.now() + 0.005, velocity); }
  auditionUp(patch: SynthPatch, note: string): void { this.ensureAudition(patch).triggerRelease(note, Tone.now()); }
  auditionStop(): void { this.audition?.synth.releaseAll(); }

  /** Resolves when the reverb impulse responses have been generated. */
  async ready(): Promise<void> { await Promise.all([this.sendReverb.ready, this.masterReverb.ready]); }

  setChannels(channels: Channels): void {
    this.channels = channels;
    Object.keys(this.strips).forEach(name => {
      const c = channels[name] ?? defaultChannel(name, this.tracks.get(name)?.def.kind);
      const strip = this.strips[name];
      const muted = effectiveMuted(channels, name);
      strip.vol.volume.value = c.volumeDb;
      strip.vol.mute = muted;
      strip.pan.pan.value = c.pan;
      strip.reverbSend.gain.value = c.reverbSend;
      strip.delaySend.gain.value = c.delaySend;
      this.muted[name] = muted;
      if (muted) this.tracks.get(name)?.voice.synth.releaseAll();
    });
  }

  setMaster(master: MasterSettings): void {
    this.master = master;
    this.masterVol.volume.value = master.volumeDb;
    this.masterReverb.wet.value = master.reverbMix;
    const decay = REVERB_SIZES[master.reverbSize].seconds;
    if (Math.abs(Number(this.masterReverb.decay) - decay) > 1e-6) this.masterReverb.decay = decay; // regenerates the impulse response
    this.delay.feedback.value = master.delayFeedback;
    this.eq.low.value = master.eqLow;
    this.eq.mid.value = master.eqMid;
    this.eq.high.value = master.eqHigh;
    const c = compressorSettings(master.compAmount);
    this.comp.threshold.value = c.threshold;
    this.comp.ratio.value = c.ratio;
    this.updateDelay();
  }

  private updateDelay(): void { this.delay.delayTime.value = delaySeconds(this.bpm, this.master.delayDivision); }
  setTempo(bpm: number): void { this.bpm = bpm; this.updateDelay(); }

  setDrumKit(id: DrumKitId): void {
    const kit = KITS[id];
    this.kick.set(kit.kick);
    this.snare.set(kit.snare);
    this.hat.set(kit.hat);
    this.clap.set(kit.clap);
    this.kitDur = kit.dur;
    this.kickNote = kit.kickNote ?? 'C1';
  }

  /** Master output level in dB (for the meter). */
  getLevelDb(): number {
    const v = this.meter.getValue();
    return Array.isArray(v) ? Math.max(...(v as number[])) : (v as number);
  }
  /** Frequency bars in dB (about -100..0) for the visualiser. */
  getSpectrum(): Float32Array { return this.spectrum.getValue() as Float32Array; }
  /** Waveform samples (-1..1) for the visualiser. */
  getWaveform(): Float32Array { return this.wave.getValue() as Float32Array; }

  /**
   * Plays everything that sits on one 16th-note step of one pattern at an explicit audio time.
   * `pattern` is null for an empty playlist bar. Durations of drum hits are fixed seconds, so timbre never depends on BPM.
   * `tick` (global step counter) only feeds the arpeggiator's random mode.
   */
  triggerStep(step: number, time: number, pattern: PatternData | null, tick: number, stepSeconds: number): void {
    if (!pattern) return;
    const d = this.kitDur;
    const voices: Record<Instrument, () => void> = {
      kick: () => this.kick.triggerAttackRelease(this.kickNote, d.kick, time),
      snare: () => this.snare.triggerAttackRelease(d.snare, time),
      hat: () => this.hat.triggerAttackRelease(d.hat, time),
      clap: () => this.clap.triggerAttackRelease(d.clap, time)
    };
    (Object.keys(voices) as Instrument[]).forEach(name => { if (!this.muted[name] && pattern.drums[name][step]) voices[name](); });
    this.tracks.forEach(({ def, voice }, id) => {
      if (this.muted[id]) return;
      const notes = notesFor(pattern, id);
      if (def.kind === 'arp') {
        arpAt(notes, step, def.arp, tick).forEach(e => {
          const pitch = voice.shift ? Tone.Frequency(e.pitch).transpose(voice.shift).toNote() : e.pitch;
          voice.synth.triggerAttackRelease(pitch, Math.max(0.05, e.durationSteps * stepSeconds), time, e.velocity);
        });
        return;
      }
      const hold = def.kind === 'ambient' ? 1 : 0.95;
      notesStartingAt(notes, step).forEach(n => {
        const pitch = voice.shift ? Tone.Frequency(n.pitch).transpose(voice.shift).toNote() : n.pitch;
        voice.synth.triggerAttackRelease(pitch, Math.max(0.05, n.lengthSteps * stepSeconds * hold), time, n.velocity);
      });
    });
  }

  releaseAll(): void {
    this.kick.triggerRelease();
    this.tracks.forEach(t => t.voice.synth.releaseAll());
  }

  dispose(): void {
    this.releaseAll();
    this.tracks.forEach(t => this.disposeVoice(t.voice));
    this.tracks.clear();
    [this.kick, this.snare, this.hat, this.clap, this.sendReverb, this.delay, this.eq, this.comp, this.masterReverb, this.masterVol, this.limiter, this.meter, this.spectrum, this.wave, this.masterIn].forEach(n => n.dispose());
    this.audition?.synth.dispose();
    this.auditionOut.dispose();
    Object.keys(this.strips).forEach(name => this.disposeStrip(name));
  }
}
