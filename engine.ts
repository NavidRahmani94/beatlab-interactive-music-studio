// FILE: The live player. It uses one Tone.Transport clock and tells the Rig (rig.ts) which notes to play on every step.
// App.tsx talks only to this class, never to Tone.js directly.
import * as Tone from 'tone';
import { audioStart } from './audioMode';
import { Instrument, clampBpm } from './pattern';
import { Channels, MasterSettings, defaultMaster } from './mixer';
import { DrumKitId } from './instruments';
import { TrackDef } from './tracks';
import { Frame, PatternData, PlayMode, Playlist, frameAt } from './song';
import { Rig } from './rig';
import { loadWorklet } from './workletSynth';
import { Groove, defaultGroove } from './groove';
import { Tuning, defaultTuning } from './tuning';
import { SynthPatch, SynthSlot } from './synth';

export type SongState = { patterns: PatternData[]; playlist: Playlist; mode: PlayMode; current: number };

/** Live playback: one Tone.Transport clock drives the shared Rig; the engine counts 16th-note ticks itself so a song can be any length. */
export class BeatLabEngine {
  private rig: Rig | null = null;
  private eventId: number | null = null;
  private song: SongState;
  private trackDefs: TrackDef[] = [];
  private channels: Channels = {};
  private master: MasterSettings = defaultMaster();
  private kit: DrumKitId = 'classic';
  private groove: Groove = defaultGroove();
  private tuning: Tuning = defaultTuning();
  private synths: SynthSlot[] = [];
  private bpm = 120;
  private frameCallback: (frame: Frame) => void;
  private active = false;
  private generation = 0;
  private tick = 0;
  private startTick = 0;   // where PLAY begins (set by the timeline)
  private late = 0;        // steps whose callback ran after their own start time (the browser was too busy: an audible stutter)
  private maxLateMs = 0;

  constructor(song: SongState, onFrame: (frame: Frame) => void) {
    this.song = song;
    this.frameCallback = onFrame;
  }
  setSong(song: SongState): void { this.song = song; }
  setTracks(tracks: TrackDef[]): void { this.trackDefs = tracks; this.rig?.setTracks(tracks); }
  setChannels(channels: Channels): void { this.channels = channels; this.rig?.setChannels(channels); }
  setMaster(master: MasterSettings): void { this.master = master; this.rig?.setMaster(master); }
  setSynths(synths: SynthSlot[]): void { this.synths = synths; this.rig?.setSynths(synths); }
  setDrumKit(id: DrumKitId): void { this.kit = id; this.rig?.setDrumKit(id); }
  setGroove(g: Groove): void { this.groove = g; this.rig?.setGroove(g); }
  setTuning(t: Tuning): void { this.tuning = t; this.rig?.setTuning(t); }
  setFrameCallback(callback: (frame: Frame) => void): void { this.frameCallback = callback; }
  /** Master output level in dB, or -Infinity before the first PLAY. */
  private wantMetering = false;
  setMetering(on: boolean): void { this.wantMetering = on; this.rig?.setMetering(on); }
  getChannelLevels(name: string): [number, number] { return this.rig ? this.rig.getChannelLevels(name) : [-Infinity, -Infinity]; }
  getLevelDb(): number { return this.rig ? this.rig.getLevelDb() : -Infinity; }
  getSpectrum(): Float32Array | null { return this.rig ? this.rig.getSpectrum() : null; }
  getWaveform(): Float32Array | null { return this.rig ? this.rig.getWaveform() : null; }
  /** Timing health since PLAY: how many steps started late, and the worst delay. */
  getHealth(): { late: number; maxLateMs: number; steps: number } { return { late: this.late, maxLateMs: Math.round(this.maxLateMs), steps: this.tick }; }
  isPlaying(): boolean { return this.active; }
  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
    Tone.getTransport().bpm.value = this.bpm;
    this.rig?.setTempo(this.bpm);
  }
  /** Builds the audio graph the first time it is needed (a click or key press is required by the browser). */
  private async ensureRig(generation: number): Promise<Rig | null> {
    await loadWorklet();   // sound engine 2 (AudioWorklet); when it cannot load, the old sounds are used
    if (this.rig) return this.rig;
    const rig = new Rig();
    this.rig = rig;
    rig.setMetering(this.wantMetering);
    rig.setSynths(this.synths);
    rig.setDrumKit(this.kit);
    rig.setGroove(this.groove);
    rig.setTuning(this.tuning);
    rig.setTracks(this.trackDefs);
    rig.setShapeVoices(this.shapeCfg);
    rig.setMaster(this.master);
    rig.setChannels(this.channels);
    rig.setTempo(this.bpm);
    await rig.ready();
    return generation === this.generation ? rig : null;
  }
  /** Synth Lab keyboard: key down / key up on a patch, even while the song is stopped. */
  async auditionDown(patch: SynthPatch, note: string): Promise<void> {
    await audioStart();
    const rig = await this.ensureRig(this.generation);
    rig?.auditionDown(patch, note);
  }
  auditionUp(patch: SynthPatch, note: string): void { this.rig?.auditionUp(patch, note); }
  auditionStop(): void { this.rig?.auditionStop(); }
  /** Starts the audio engine (call from a click) so that a MIDI keyboard can be heard right away. */
  async prepare(): Promise<void> { await audioStart(); await this.ensureRig(this.generation); }
  liveDown(trackId: string, note: string, velocity: number): void { this.rig?.liveDown(trackId, note, velocity); }
  liveUp(trackId: string, note: string): void { this.rig?.liveUp(trackId, note); }
  liveShot(trackId: string, note: string, seconds: number, velocity: number): void { this.rig?.liveShot(trackId, note, seconds, velocity); }
  /** SHAPE LAB: the sound of each shape (stored, so it is also used when the audio engine starts later). */
  private shapeCfg: { instrument: string; volumeDb: number }[] = [];
  setShapeVoices(cfgs: { instrument: string; volumeDb: number }[]): void { this.shapeCfg = cfgs; this.rig?.setShapeVoices(cfgs); }
  shapeShot(i: number, note: string, seconds: number, velocity: number): void { this.rig?.shapeShot(i, note, seconds, velocity); }
  liveDrum(inst: Instrument, velocity: number): void { this.rig?.liveDrum(inst, velocity); }
  async start(bpm: number): Promise<void> {
    if (this.active) return;
    const generation = ++this.generation;
    await audioStart();
    if (generation !== this.generation) return;
    await this.ensureRig(generation);
    if (generation !== this.generation) return;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.position = '0:0:0';
    this.setBpm(bpm);
    transport.loop = false;
    this.tick = this.startTick; this.late = 0; this.maxLateMs = 0;
    this.eventId = transport.scheduleRepeat((time) => {
      const lateMs = (Tone.getContext().rawContext.currentTime - time) * 1000;   // raw clock: Tone.now() already includes the look-ahead
      if (lateMs > 1) { this.late++; this.maxLateMs = Math.max(this.maxLateMs, lateMs); }
      const tick = this.tick++;
      const { patterns, playlist, mode, current } = this.song;
      const frame = frameAt(tick, playlist, mode, current);
      const pattern = frame.pattern === null ? null : patterns[frame.pattern] ?? null;
      this.rig?.triggerStep(frame.step, time, pattern, tick, 60 / transport.bpm.value / 4);
      Tone.getDraw().schedule(() => { if (this.active) this.frameCallback(frame); }, time);
    }, '16n', 0);
    this.active = true;
    transport.start();
  }
  /** Jump to a step: while playing the song continues from there, while stopped PLAY will begin there. */
  seek(step: number): void {
    const t = Math.max(0, Math.floor(step));
    this.startTick = t;
    if (this.active) { this.tick = t; this.rig?.releaseAll(); }
  }
  stop(): void {
    this.startTick = 0;
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
