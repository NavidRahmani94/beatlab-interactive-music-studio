import * as Tone from 'tone';
import { DrumPattern, Instrument } from './pattern';
import { MelodyNote } from './melody';
import { CHANNEL_NAMES, ChannelName, Channels, MasterSettings, REVERB_SIZES, defaultChannels, defaultMaster, delaySeconds, effectiveMuted } from './mixer';
import { DrumKitId, MelodyInstrumentId } from './instruments';

type Strip = { vol: Tone.Volume; pan: Tone.Panner; reverbSend: Tone.Gain; delaySend: Tone.Gain };

/* eslint-disable @typescript-eslint/no-explicit-any */
type KitDef = { kick: any; snare: any; hat: any; clap: any; dur: Record<Instrument, number> };
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
  }
};

type MelodyBuild = { synth: Tone.PolySynth<any>; filter: Tone.Filter | null; volume: number; shift: number };
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
        filter: new Tone.Filter(1400, 'lowpass'), volume: -3, shift: 0
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
    case 'softSynth':
    default:
      return {
        synth: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 18 }, envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.5 } } as any),
        filter: new Tone.Filter(2600, 'lowpass'), volume: -3, shift: 0
      };
  }
}

/**
 * The complete sound path:
 *   instruments -> channel strips (volume, pan) -> [reverb send / delay send buses] -> master in
 *   -> master reverb -> master volume -> limiter -> output (+ level meter)
 * The SAME class is used for live playback and for the offline WAV render, so both sound identical.
 * Create it while the Tone context you want (live or offline) is the active one.
 */
export class Rig {
  private masterIn: Tone.Gain;
  private masterReverb: Tone.Reverb;
  private masterVol: Tone.Volume;
  private limiter: Tone.Limiter;
  private meter: Tone.Meter;
  private sendReverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private strips = {} as Record<ChannelName, Strip>;
  private kick: Tone.MembraneSynth;
  private snare: Tone.NoiseSynth;
  private hat: Tone.MetalSynth;
  private clap: Tone.NoiseSynth;
  private melody: Tone.PolySynth<any>;
  private melodyFilter: Tone.Filter | null = null;
  private melodyShift = 0;
  private melodyId: MelodyInstrumentId | null = null;
  private kitDur: Record<Instrument, number> = KITS.classic.dur;
  private muted: Record<ChannelName, boolean> = { kick: false, snare: false, hat: false, clap: false, melody: false };
  private bpm = 120;
  private master: MasterSettings = defaultMaster();

  constructor() {
    this.masterIn = new Tone.Gain(1);
    this.masterReverb = new Tone.Reverb({ decay: REVERB_SIZES.hall.seconds, preDelay: 0.01 });
    this.masterVol = new Tone.Volume(0);
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.meter = new Tone.Meter({ smoothing: 0.85 });
    this.masterIn.chain(this.masterReverb, this.masterVol, this.limiter);
    this.limiter.connect(this.meter);

    this.sendReverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.01 });
    this.sendReverb.wet.value = 1;
    this.sendReverb.connect(this.masterIn);
    this.delay = new Tone.FeedbackDelay({ delayTime: 0.375, feedback: 0.35 });
    this.delay.wet.value = 1;
    this.delay.connect(this.masterIn);

    CHANNEL_NAMES.forEach(name => {
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
      this.strips[name] = { vol, pan, reverbSend, delaySend };
    });

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

    const m = buildMelody('softSynth');
    this.melody = m.synth; this.melodyFilter = m.filter; this.melodyShift = m.shift; this.melodyId = 'softSynth';
    this.wireMelody(m);

    this.setChannels(defaultChannels());
    this.setMaster(defaultMaster());
  }

  private wireMelody(m: MelodyBuild): void {
    m.synth.volume.value = m.volume;
    if (m.filter) { m.synth.connect(m.filter); m.filter.connect(this.strips.melody.vol); }
    else m.synth.connect(this.strips.melody.vol);
  }

  /** Resolves when the reverb impulse responses have been generated. */
  async ready(): Promise<void> { await Promise.all([this.sendReverb.ready, this.masterReverb.ready]); }

  setChannels(channels: Channels): void {
    CHANNEL_NAMES.forEach(name => {
      const c = channels[name];
      const strip = this.strips[name];
      const muted = effectiveMuted(channels, name);
      strip.vol.volume.value = c.volumeDb;
      strip.vol.mute = muted;
      strip.pan.pan.value = c.pan;
      strip.reverbSend.gain.value = c.reverbSend;
      strip.delaySend.gain.value = c.delaySend;
      this.muted[name] = muted;
      if (muted && name === 'melody') this.melody.releaseAll();
    });
  }

  setMaster(master: MasterSettings): void {
    this.master = master;
    this.masterVol.volume.value = master.volumeDb;
    this.masterReverb.wet.value = master.reverbMix;
    const decay = REVERB_SIZES[master.reverbSize].seconds;
    if (Math.abs(Number(this.masterReverb.decay) - decay) > 1e-6) this.masterReverb.decay = decay; // regenerates the impulse response
    this.delay.feedback.value = master.delayFeedback;
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
  }

  setMelodyInstrument(id: MelodyInstrumentId): void {
    if (id === this.melodyId) return;
    this.melody.releaseAll();
    this.melody.dispose();
    this.melodyFilter?.dispose();
    const m = buildMelody(id);
    this.melody = m.synth; this.melodyFilter = m.filter; this.melodyShift = m.shift; this.melodyId = id;
    this.wireMelody(m);
  }

  /** Master output level in dB (for the meter). */
  getLevelDb(): number {
    const v = this.meter.getValue();
    return Array.isArray(v) ? Math.max(...(v as number[])) : (v as number);
  }

  /**
   * Plays everything that sits on one 16th-note step at an explicit audio time.
   * Durations of drum hits are fixed seconds, so timbre never depends on BPM.
   */
  triggerStep(step: number, time: number, pattern: DrumPattern, melodyByStep: Map<number, MelodyNote[]>, stepSeconds: number): void {
    const d = this.kitDur;
    const voices: Record<Instrument, () => void> = {
      kick: () => this.kick.triggerAttackRelease('C1', d.kick, time),
      snare: () => this.snare.triggerAttackRelease(d.snare, time),
      hat: () => this.hat.triggerAttackRelease(d.hat, time),
      clap: () => this.clap.triggerAttackRelease(d.clap, time)
    };
    (Object.keys(voices) as Instrument[]).forEach(name => { if (!this.muted[name] && pattern[name][step]) voices[name](); });
    const notes = melodyByStep.get(step);
    if (notes && !this.muted.melody) {
      notes.forEach(n => {
        const pitch = this.melodyShift ? Tone.Frequency(n.pitch).transpose(this.melodyShift).toNote() : n.pitch;
        this.melody.triggerAttackRelease(pitch, Math.max(0.05, n.lengthSteps * stepSeconds * 0.95), time, n.velocity);
      });
    }
  }

  releaseAll(): void {
    this.kick.triggerRelease();
    this.melody.releaseAll();
  }

  dispose(): void {
    this.releaseAll();
    [this.kick, this.snare, this.hat, this.clap, this.melody, this.sendReverb, this.delay, this.masterReverb, this.masterVol, this.limiter, this.meter, this.masterIn].forEach(n => n.dispose());
    this.melodyFilter?.dispose();
    CHANNEL_NAMES.forEach(name => { const s = this.strips[name]; s.vol.dispose(); s.pan.dispose(); s.reverbSend.dispose(); s.delaySend.dispose(); });
  }
}

export function groupMelodyByStep(notes: MelodyNote[]): Map<number, MelodyNote[]> {
  const map = new Map<number, MelodyNote[]>();
  notes.forEach(n => map.set(n.step, [...(map.get(n.step) ?? []), n]));
  return map;
}
