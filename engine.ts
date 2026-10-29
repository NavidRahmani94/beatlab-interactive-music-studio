import * as Tone from 'tone';
import { clampBpm } from './pattern';
import { Channels, MasterSettings, defaultChannels, defaultMaster } from './mixer';
import { DrumKitId, MelodicTrack, MelodyInstrumentId, TRACK_DEFAULT_INSTRUMENT } from './instruments';
import { ArpSettings, defaultArp } from './arp';
import { Frame, PatternData, PlayMode, Playlist, frameAt } from './song';
import { Rig } from './rig';
import { SynthPatch, SynthSlot } from './synth';

export type SongState = { patterns: PatternData[]; playlist: Playlist; mode: PlayMode; current: number };

/** Live playback: one Tone.Transport clock drives the shared Rig; the engine counts 16th-note ticks itself so a song can be any length. */
export class BeatLabEngine {
  private rig: Rig | null = null;
  private eventId: number | null = null;
  private song: SongState;
  private arp: ArpSettings = defaultArp();
  private channels: Channels = defaultChannels();
  private master: MasterSettings = defaultMaster();
  private instruments: Record<MelodicTrack, MelodyInstrumentId> = { ...TRACK_DEFAULT_INSTRUMENT };
  private kit: DrumKitId = 'classic';
  private synths: SynthSlot[] = [];
  private bpm = 120;
  private frameCallback: (frame: Frame) => void;
  private active = false;
  private generation = 0;
  private tick = 0;

  constructor(song: SongState, onFrame: (frame: Frame) => void) {
    this.song = song;
    this.frameCallback = onFrame;
  }
  setSong(song: SongState): void { this.song = song; }
  setArp(arp: ArpSettings): void { this.arp = arp; }
  setChannels(channels: Channels): void { this.channels = channels; this.rig?.setChannels(channels); }
  setMaster(master: MasterSettings): void { this.master = master; this.rig?.setMaster(master); }
  setTrackInstrument(track: MelodicTrack, id: MelodyInstrumentId): void {
    this.instruments[track] = id;
    this.rig?.setTrackInstrument(track, id);
    this.rig?.setChannels(this.channels);
  }
  setSynths(synths: SynthSlot[]): void { this.synths = synths; this.rig?.setSynths(synths); }
  setDrumKit(id: DrumKitId): void { this.kit = id; this.rig?.setDrumKit(id); }
  setFrameCallback(callback: (frame: Frame) => void): void { this.frameCallback = callback; }
  /** Master output level in dB, or -Infinity before the first PLAY. */
  getLevelDb(): number { return this.rig ? this.rig.getLevelDb() : -Infinity; }
  getSpectrum(): Float32Array | null { return this.rig ? this.rig.getSpectrum() : null; }
  getWaveform(): Float32Array | null { return this.rig ? this.rig.getWaveform() : null; }
  isPlaying(): boolean { return this.active; }
  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
    Tone.getTransport().bpm.value = this.bpm;
    this.rig?.setTempo(this.bpm);
  }
  /** Builds the audio graph the first time it is needed (a click or key press is required by the browser). */
  private async ensureRig(generation: number): Promise<Rig | null> {
    if (this.rig) return this.rig;
    const rig = new Rig();
    this.rig = rig;
    rig.setSynths(this.synths);
    rig.setDrumKit(this.kit);
    (Object.keys(this.instruments) as MelodicTrack[]).forEach(t => rig.setTrackInstrument(t, this.instruments[t]));
    rig.setMaster(this.master);
    rig.setChannels(this.channels);
    rig.setTempo(this.bpm);
    await rig.ready();
    return generation === this.generation ? rig : null;
  }
  /** Synth Lab keyboard: key down / key up on a patch, even while the song is stopped. */
  async auditionDown(patch: SynthPatch, note: string): Promise<void> {
    await Tone.start();
    const rig = await this.ensureRig(this.generation);
    rig?.auditionDown(patch, note);
  }
  auditionUp(patch: SynthPatch, note: string): void { this.rig?.auditionUp(patch, note); }
  auditionStop(): void { this.rig?.auditionStop(); }
  async start(bpm: number): Promise<void> {
    if (this.active) return;
    const generation = ++this.generation;
    await Tone.start();
    if (generation !== this.generation) return;
    await this.ensureRig(generation);
    if (generation !== this.generation) return;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.position = '0:0:0';
    this.setBpm(bpm);
    transport.loop = false;
    this.tick = 0;
    this.eventId = transport.scheduleRepeat((time) => {
      const tick = this.tick++;
      const { patterns, playlist, mode, current } = this.song;
      const frame = frameAt(tick, playlist, mode, current);
      const pattern = frame.pattern === null ? null : patterns[frame.pattern] ?? null;
      this.rig?.triggerStep(frame.step, time, pattern, this.arp, tick, 60 / transport.bpm.value / 4);
      Tone.getDraw().schedule(() => { if (this.active) this.frameCallback(frame); }, time);
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
