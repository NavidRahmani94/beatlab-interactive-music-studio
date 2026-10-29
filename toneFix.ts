import * as Tone from 'tone';

/**
 * Tone.js frees every finished one-shot source (each note's oscillator, each sample play) with requestIdleCallback.
 * While music plays the page is never idle (animation + the step counter), so those callbacks can starve and the finished
 * oscillators pile up inside the audio graph: the CPU load grows the longer the song plays until the sound crackles.
 * We free them with a plain timer instead.
 */
let applied = false;
export function applyToneFix(): void {
  if (applied) return;
  applied = true;
  // A bigger audio buffer and look-ahead: the music survives short main-thread hiccups (drawing, React) instead of crackling.
  // It costs a few tens of milliseconds of latency, which is fine for a sequencer (live keys are scheduled a little ahead anyway).
  try {
    if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined') Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.15 }));
  } catch { /* keep Tone's default context */ }
  const proto = Object.getPrototypeOf(Tone.ToneOscillatorNode.prototype) as { _onended: () => void; onended: (s: unknown) => void; context: { isOffline: boolean }; dispose: () => void };
  if (!proto || typeof proto._onended !== 'function') return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proto._onended = function (this: any) {
    const noop = (Tone.ToneOscillatorNode.getDefaults() as { onended: unknown }).onended;
    if (this.onended === noop) return;
    this.onended(this);
    this.onended = noop;
    if (!this.context.isOffline) setTimeout(() => {
      // The long-lived frequency / detune signals of the oscillator stay connected to every finished node, and every new connection
      // walks all of them (cycle detection): the graph and the cost of each new note grow while the song plays. Cut the link first.
      const owner = this.__owner;
      if (owner) {
        try { owner.frequency.disconnect(this.frequency); } catch { /* not connected */ }
        try { owner.detune.disconnect(this.detune); } catch { /* not connected */ }
        this.__owner = undefined;
      }
      try { this.dispose(); } catch { /* already gone */ }
    }, 30);
  };
  // remember which Tone.Oscillator owns each one-shot node
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osc = Tone.Oscillator.prototype as any;
  const start = osc._start;
  osc._start = function (this: any, time: unknown) {
    const before = this._oscillator;
    start.call(this, time);
    if (this._oscillator && this._oscillator !== before) this._oscillator.__owner = this;
  };
}
