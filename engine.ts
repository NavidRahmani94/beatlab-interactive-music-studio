import * as Tone from 'tone';
import { DrumPattern, STEPS, clampBpm } from './pattern';
import { MelodyNote } from './melody';
import { Channels, MasterSettings, defaultChannels, defaultMaster } from './mixer';
import { DrumKitId, MelodyInstrumentId } from './instruments';
import { Rig, groupMelodyByStep } from './rig';

/** Live playback: one Tone.Transport clock drives the shared Rig. */
export class BeatLabEngine {
  private rig: Rig | null = null;
  private eventId: number | null = null;
  private pattern: DrumPattern;
  private melodyByStep = new Map<number, MelodyNote[]>();
  private channels: Channels = defaultChannels();
  private master: MasterSettings = defaultMaster();
  private instrument: MelodyInstrumentId = 'softSynth';
  private kit: DrumKitId = 'classic';
  private bpm = 120;
  private stepCallback: (step: number) => void;
  private active = false;
  private generation = 0;

  constructor(pattern: DrumPattern, onStep: (step: number) => void) {
    this.pattern = pattern;
    this.stepCallback = onStep;
  }
  setPattern(pattern: DrumPattern): void { this.pattern = pattern; }
  setMelody(notes: MelodyNote[]): void { this.melodyByStep = groupMelodyByStep(notes); }
  setChannels(channels: Channels): void { this.channels = channels; this.rig?.setChannels(channels); }
  setMaster(master: MasterSettings): void { this.master = master; this.rig?.setMaster(master); }
  setMelodyInstrument(id: MelodyInstrumentId): void { this.instrument = id; this.rig?.setMelodyInstrument(id); this.rig?.setChannels(this.channels); }
  setDrumKit(id: DrumKitId): void { this.kit = id; this.rig?.setDrumKit(id); }
  setStepCallback(callback: (step: number) => void): void { this.stepCallback = callback; }
  /** Master output level in dB, or -Infinity before the first PLAY. */
  getLevelDb(): number { return this.rig ? this.rig.getLevelDb() : -Infinity; }
  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
    Tone.getTransport().bpm.value = this.bpm;
    this.rig?.setTempo(this.bpm);
  }
  async start(bpm: number): Promise<void> {
    if (this.active) return;
    const generation = ++this.generation;
    await Tone.start();
    if (generation !== this.generation) return;
    if (!this.rig) {
      const rig = new Rig();
      this.rig = rig;
      rig.setDrumKit(this.kit);
      rig.setMelodyInstrument(this.instrument);
      rig.setMaster(this.master);
      rig.setChannels(this.channels);
      rig.setTempo(this.bpm);
      await rig.ready();
      if (generation !== this.generation) return;
    }
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
      this.rig?.triggerStep(step, time, this.pattern, this.melodyByStep, 60 / transport.bpm.value / 4);
      Tone.getDraw().schedule(() => { if (this.active) this.stepCallback(step); }, time);
    }, '16n', 0);
    this.active = true;
    transport.start();
  }
  stop(): void {
    ++this.generation;
    this.active = false;
    const transport = Tone.getTransport();
    transport.stop();
    if (this.eventId !== null) { transport.clear(this.eventId); this.eventId = null; }
    transport.position = '0:0:0';
    this.rig?.releaseAll();
  }
  dispose(): void {
    this.stop();
    this.rig?.dispose();
    this.rig = null;
  }
}
