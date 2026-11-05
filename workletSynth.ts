// FILE: Sound engine 2: a synthesizer that runs inside an AudioWorklet (see voiceWorklet.js). It plays the same SynthPatch as PatchSynth,
// but all voices of a sound are computed in ONE audio node (instead of ~10 Web Audio nodes per voice), so chords use much less CPU.
// It is used for live playing only (SHAPE LAB). The song and the export keep PatchSynth, so they always sound the same as before.
import * as Tone from 'tone';
import workletSource from './voiceWorklet.js?raw';
import type { NoteSynth } from './patchSynth';
import type { SynthPatch } from './synth';

/* eslint-disable @typescript-eslint/no-explicit-any */
const KEY = 'beatlab.engine2';
/** Engine 2 is on by default; the SYSTEM panel can switch it off (read once per page load). */
export const ENGINE2_ON = ((): boolean => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
export function saveEngine2(on: boolean): void { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ } }

const isFile = (): boolean => typeof location !== 'undefined' && location.protocol === 'file:';
let loading: Promise<boolean> | null = null;
let loaded = false;
/** Loads the worklet code into the audio context (once). Resolves false when this browser cannot do it (the Tone sounds are used then). */
export function loadWorklet(): Promise<boolean> {
  // A page opened straight from a file (file://) cannot load an AudioWorklet in Chrome: the old engine is used there (open the app from a web address to get engine 2).
  if (!ENGINE2_ON || isFile()) return Promise.resolve(false);
  if (loading) return loading;
  loading = (async () => {
    try {
      const ctx = Tone.getContext() as any;
      if (!ctx.rawContext?.audioWorklet) return false;
      const url = URL.createObjectURL(new Blob([workletSource], { type: 'application/javascript' }));
      await ctx.rawContext.audioWorklet.addModule(url);   // not Tone's addAudioWorkletModule: Tone keeps only the first module of a context
      loaded = true; return true;
    } catch { return false; }
  })();
  return loading;
}
export const ENGINE2_BLOCKED_BY_FILE = isFile();
export const workletReady = (): boolean => loaded;
/** True while the Rig is built for the offline export (it keeps the original engine, so the export always sounds like before). */
export const isOfflineContext = (): boolean => Tone.getContext() instanceof Tone.OfflineContext;

let nextId = 1;
export class WorkletSynth implements NoteSynth {
  readonly volume = { value: 0 };
  private node: any;
  private out: Tone.Gain;
  private held = new Map<string, number>();
  constructor(patch: SynthPatch, trimDb = 0) {
    this.out = new Tone.Gain(1);
    this.node = (Tone.getContext() as any).createAudioWorkletNode('beatlab-synth', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { patch: { ...patch, volumeDb: patch.volumeDb + trimDb } } });
    Tone.connect(this.node, this.out);
  }
  connect(destination: any): this { this.out.connect(destination); return this; }
  private freq(note: string): number { return Tone.Frequency(note).toFrequency(); }
  triggerAttackRelease(note: string, duration: number, time: number = Tone.now(), velocity = 0.8, glide: { at: number; cents: number }[] = []): this {
    this.node.port.postMessage({ t: 'note', id: nextId++, start: time, dur: Math.max(0.02, duration), freq: this.freq(note), vel: velocity, glide });
    return this;
  }
  triggerAttack(note: string, time: number = Tone.now(), velocity = 0.8): this {
    this.triggerRelease(note, time);
    const id = nextId++; this.held.set(note, id);
    this.node.port.postMessage({ t: 'note', id, start: time, dur: Infinity, freq: this.freq(note), vel: velocity });
    return this;
  }
  triggerRelease(note: string, time: number = Tone.now()): this {
    const id = this.held.get(note); if (id === undefined) return this;
    this.held.delete(note); this.node.port.postMessage({ t: 'rel', id, time }); return this;
  }
  releaseAll(): this { this.held.clear(); try { this.node.port.postMessage({ t: 'off' }); } catch { /* gone */ } return this; }
  dispose(): this {
    try { this.releaseAll(); } catch { /* context may be gone */ }
    const node = this.node; const out = this.out;
    // the tail of the last notes still rings for a moment, so the node is removed a little later
    setTimeout(() => { try { node.disconnect(); out.dispose(); } catch { /* already gone */ } }, 1500);
    return this;
  }
}
