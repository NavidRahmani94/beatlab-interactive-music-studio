// FILE: The audio buffer mode. SMOOTH (default) asks the browser for a bigger audio buffer: a little more delay, but much fewer crackles on slow computers.
// FAST asks for the smallest buffer (lowest delay, good for playing a keyboard, but it crackles more easily when the computer is busy).
// SAFE asks for a big buffer (80 ms delay): the best protection against crackles when the computer is slow.
import * as Tone from 'tone';

export type AudioMode = 'fast' | 'smooth' | 'safe';
export const AUDIO_MODES: AudioMode[] = ['fast', 'smooth', 'safe'];
const KEY = 'beatlab.audiomode';
export function loadAudioMode(): AudioMode {
  try { const v = localStorage.getItem(KEY); return v === 'fast' || v === 'safe' ? v : 'smooth'; } catch { return 'smooth'; }
}
export function saveAudioMode(m: AudioMode): void { try { localStorage.setItem(KEY, m); } catch { /* no storage */ } }

/** FAST = smallest buffer (about 10 ms). SMOOTH = the browser's "playback" buffer (about 23 ms). SAFE = 80 ms: the most protection against crackles. */
const LATENCY_HINT: Record<AudioMode, AudioContextLatencyCategory | number> = { fast: 'interactive', smooth: 'playback', safe: 0.08 };
let configured = false;
/** Must run before the first sound node is made. The mode is read once, so a change needs a page reload. */
export function configureAudio(): void {
  if (configured) return; configured = true;
  if (typeof AudioContext === 'undefined') return;     // tests (no browser)
  // Chrome also accepts a number of seconds for latencyHint; the type of Tone does not list it
  try { Tone.setContext(new Tone.Context({ latencyHint: LATENCY_HINT[loadAudioMode()] } as never)); } catch { /* the default context still works */ }
}
/** Starts the audio (call it from a click). Use this instead of Tone.start(). */
export async function audioStart(): Promise<void> { configureAudio(); await Tone.start(); }
/** The delay of the audio output in milliseconds (what the browser really gave us). */
export function audioLatencyMs(): number | null {
  try { const c = Tone.getContext().rawContext as AudioContext; const v = (c.baseLatency ?? 0) + (c.outputLatency ?? 0); return v > 0 ? Math.round(v * 1000) : null; } catch { return null; }
}
