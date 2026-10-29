import * as Tone from 'tone';
import { DrumPattern, Instrument, STEPS, clampBpm } from './pattern';
import { MelodyNote } from './melody';

export class BeatLabEngine {
  private kick: Tone.MembraneSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private hat: Tone.MetalSynth | null = null;
  private melody: Tone.PolySynth | null = null;
  private melodyByStep = new Map<number, MelodyNote[]>();
  private melodyMuted = false;
  private clap: Tone.NoiseSynth | null = null;
  private master: Tone.Limiter | null = null;
  private eventId: number | null = null;
  private pattern: DrumPattern;
  private stepCallback: (step: number) => void;
  private active = false;
  private generation = 0;
  private muted: Record<Instrument, boolean> = {kick: false, snare: false, hat: false, clap: false};

  constructor(pattern: DrumPattern, onStep: (step: number) => void) {
    this.pattern = pattern;
    this.stepCallback = onStep;
  }
  setPattern(pattern: DrumPattern): void { this.pattern = pattern; }
  setStepCallback(callback: (step: number) => void): void { this.stepCallback = callback; }
  setMelody(notes: MelodyNote[]): void {
    const map = new Map<number, MelodyNote[]>();
    notes.forEach(n => map.set(n.step, [...(map.get(n.step) ?? []), n]));
    this.melodyByStep = map;
  }
  setMelodyMuted(muted: boolean): void { this.melodyMuted = muted; if (muted) this.melody?.releaseAll(); }
  setMuted(name: Instrument, muted: boolean): void { this.muted[name] = muted; }
  setBpm(bpm: number): void { Tone.getTransport().bpm.value = clampBpm(bpm); }
  async start(bpm: number): Promise<void> {
    if (this.active) return;
    const generation = ++this.generation;
    await Tone.start();
    if (generation !== this.generation) return;
    if (!this.master) this.createInstruments();
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.position = '0:0:0';
    this.setBpm(bpm);
    transport.loop = true;
    transport.loopStart = 0;
    transport.loopEnd = '1m';
    this.eventId = transport.scheduleRepeat((time) => {
      const step = Math.round(transport.getTicksAtTime(time) / (transport.PPQ / 4)) % STEPS;
      this.triggerStep(step, time);
      Tone.getDraw().schedule(() => { if (this.active) this.stepCallback(step); }, time);
    }, '16n', 0);
    this.active = true;
    transport.start();
  }
  private createInstruments(): void {
    this.master = new Tone.Limiter(-3).toDestination();
    this.kick = new Tone.MembraneSynth({pitchDecay: 0.05, octaves: 8, envelope: {attack: 0.001, decay: 0.35, sustain: 0, release: 0.08}}).connect(this.master);
    this.snare = new Tone.NoiseSynth({noise: {type: 'white'}, envelope: {attack: 0.001, decay: 0.16, sustain: 0}}).connect(this.master);
    this.hat = new Tone.MetalSynth({envelope: {attack: 0.001, decay: 0.055, release: 0.02}, harmonicity: 5.1, modulationIndex: 24, resonance: 3000, octaves: 1}).connect(this.master);
    this.hat.frequency.value = 260;
    this.clap = new Tone.NoiseSynth({noise: {type: 'pink'}, envelope: {attack: 0.001, decay: 0.23, sustain: 0}}).connect(this.master);
    this.melody = new Tone.PolySynth(Tone.Synth, {oscillator: {type: 'triangle'}, envelope: {attack: 0.01, decay: 0.2, sustain: 0.45, release: 0.35}}).connect(this.master);
    this.melody.volume.value = -10;
    this.snare.volume.value = -13;
    this.hat.volume.value = -12;
    this.clap.volume.value = -11;
    this.kick.volume.value = -7;
  }
  private triggerStep(step: number, time: number): void {
    const notes = this.melodyByStep.get(step);
    if (notes && this.melody && !this.melodyMuted) {
      const stepSeconds = 60 / Tone.getTransport().bpm.value / 4;
      notes.forEach(n => this.melody?.triggerAttackRelease(n.pitch, Math.max(0.05, n.lengthSteps * stepSeconds * 0.95), time, n.velocity));
    }
    const voices: Record<Instrument, () => void> = {
      kick: () => this.kick?.triggerAttackRelease('C1', 0.25, time),
      snare: () => this.snare?.triggerAttackRelease(0.12, time),
      hat: () => this.hat?.triggerAttackRelease(0.1, time),
      clap: () => this.clap?.triggerAttackRelease(0.12, time)
    };
    (Object.keys(voices) as Instrument[]).forEach(name => { if (!this.muted[name] && this.pattern[name][step]) voices[name](); });
  }
  stop(): void {
    ++this.generation;
    this.active = false;
    const transport = Tone.getTransport();
    transport.stop();
    if (this.eventId !== null) { transport.clear(this.eventId); this.eventId = null; }
    transport.position = '0:0:0';
    this.kick?.triggerRelease();
    this.melody?.releaseAll();
  }
  dispose(): void {
    this.stop();
    this.kick?.dispose(); this.snare?.dispose(); this.hat?.dispose(); this.clap?.dispose(); this.melody?.dispose(); this.master?.dispose();
    this.melody = null; this.kick = null; this.snare = null; this.hat = null; this.clap = null; this.master = null;
  }
}
