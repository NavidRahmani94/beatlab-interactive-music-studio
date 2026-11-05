// FILE: BeatLab synth engine 2. One AudioWorklet node plays every note of a sound, instead of a graph of many Web Audio nodes per note.
// It runs on the audio thread. Notes arrive with a start time (seconds of the audio clock), so the timing is sample accurate.
// Supports the whole SynthPatch (synth.ts): waves sine/triangle/saw/square/pulse/pwm, FM, 2 oscillators with unison, noise, state-variable filter (12/24 dB)
// with envelope, amp envelope, LFO (pitch / filter / tremolo), drive, stereo chorus, velocity, volume.
// Messages: {t:'patch', patch} {t:'note', id, start, dur, freq, vel} (dur = Infinity: held until {t:'rel', id, time}) {t:'off'}.
// This file is plain JavaScript (it is loaded as a module by the AudioWorklet, see workletSynth.ts).
/* global AudioWorkletProcessor, registerProcessor, currentTime, sampleRate */
const MAX_VOICES = 24;
const MAX_OSC = 10;           // 2 oscillators x 5 unison copies
const CTRL = 16;              // filter and LFO are updated every 16 samples
const TWO_PI = Math.PI * 2;

// the band-limited step (PolyBLEP) removes most of the harsh aliasing of saw and square waves
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
const dbToGain = db => Math.pow(10, db / 20);
const WAVES = { sine: 0, triangle: 1, sawtooth: 2, square: 3, pulse: 4, pwm: 5 };
const lfoWave = (kind, ph) => kind === 'triangle' ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : kind === 'square' ? (ph < 0.5 ? 1 : -1) : kind === 'sawtooth' ? 2 * ph - 1 : Math.sin(TWO_PI * ph);

class Voice {
  constructor() {
    this.active = false; this.id = -1;
    this.phase = new Float64Array(MAX_OSC); this.inc = new Float64Array(MAX_OSC); this.lvl = new Float64Array(MAX_OSC);
    this.wave = new Int8Array(MAX_OSC); this.fmIdx = new Float64Array(MAX_OSC); this.fmInc = new Float64Array(MAX_OSC); this.fmPh = new Float64Array(MAX_OSC); this.n = 0;
    this.env = 0; this.stage = 0; this.wait = 0; this.fenv = 0; this.fstage = 0; this.lfoPh = 0; this.pwmPh = 0;
    this.ic1a = 0; this.ic2a = 0; this.ic1b = 0; this.ic2b = 0; this.dcx = 0; this.dcy = 0;
    this.vel = 1; this.noise = 0; this.seed = 1; this.pink = 0; this.brown = 0; this.releaseAt = Infinity; this.released = false; this.glide = null; this.startAt = 0;
  }
}

class BeatLabSynth extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.patch = null; this.voices = Array.from({ length: MAX_VOICES }, () => new Voice());
    this.queue = []; this.steals = 0;
    // chorus: two delay lines (left / right), modulated by a slow LFO
    this.cLen = 4096; this.cL = new Float32Array(this.cLen); this.cR = new Float32Array(this.cLen); this.cPos = 0; this.cPh = 0;
    if (o.patch) this.setPatch(o.patch);
    if (o.notes) this.queue = o.notes.slice().sort((a, b) => a.start - b.start);
    this.port.onmessage = e => {
      const m = e.data;
      if (m.t === 'patch') this.setPatch(m.patch);
      else if (m.t === 'note') { this.queue.push(m); this.queue.sort((a, b) => a.start - b.start); }
      else if (m.t === 'rel') this.release(m.id, m.time);
      else if (m.t === 'off') { this.queue.length = 0; for (const v of this.voices) if (v.active) { v.releaseAt = 0; } }
    };
  }

  setPatch(p) {
    const k = e => ({ a: Math.max(0.001, e.a), d: Math.max(0.01, e.d), s: e.s, r: Math.max(0.01, e.r) });
    this.patch = { ...p, ampEnv: k(p.ampEnv), filterEnv: k(p.filterEnv), gain: dbToGain(p.volumeDb || 0) };
  }

  release(id, time) {
    for (const n of this.queue) if (n.id === id) n.dur = Math.max(0, time - n.start);
    for (const v of this.voices) if (v.active && v.id === id && v.releaseAt === Infinity) v.releaseAt = time;
  }

  startVoice(v, note, wait) {
    const p = this.patch; const f0 = note.freq * Math.pow(2, (p.transpose || 0) / 12);
    v.active = true; v.id = note.id === undefined ? -1 : note.id; v.vel = Math.max(0.05, Math.min(1, note.vel)); v.n = 0;
    const u = Math.max(1, Math.min(5, p.unison | 0));
    for (const [oi, o] of [[1, p.osc1], [2, p.osc2]]) {
      if (!o || o.level <= 0) continue;
      const fm = o.fmIndex > 0 && o.wave !== 'pulse' && o.wave !== 'pwm';
      const copies = fm ? 1 : u;                               // like the Tone version: unison does not apply to FM
      const base = f0 * Math.pow(2, o.octave) * Math.pow(2, o.cents / 1200);
      for (let c = 0; c < copies; c++) {
        const spread = copies === 1 ? 0 : ((c / (copies - 1)) * 2 - 1) * p.spread;      // cents
        const i = v.n;
        v.inc[i] = (base * Math.pow(2, spread / 1200)) / sampleRate;
        v.phase[i] = (c * 0.37 + oi * 0.11) % 1;               // spread start phases (no loud peak at the start)
        v.lvl[i] = o.level / Math.sqrt(copies); v.wave[i] = WAVES[o.wave] ?? 2;
        v.fmIdx[i] = fm ? o.fmIndex : 0; v.fmInc[i] = v.inc[i] * (o.fmRatio || 1); v.fmPh[i] = 0;
        v.n++;
      }
    }
    v.noise = p.noise || 0; v.seed = 1 + ((Math.random() * 1e6) | 0); v.pink = 0; v.brown = 0;
    v.env = 0; v.stage = 0; v.wait = wait; v.fenv = 0; v.fstage = 0; v.lfoPh = 0; v.pwmPh = 0;
    v.releaseAt = note.dur === Infinity ? Infinity : note.start + note.dur; v.released = false; v.glide = note.glide && note.glide.length ? note.glide : null; v.startAt = note.start;
    v.ic1a = v.ic2a = v.ic1b = v.ic2b = 0; v.dcx = v.dcy = 0;
  }

  allocate() {
    for (const v of this.voices) if (!v.active) return v;
    this.steals++;                                              // all busy: take the quietest voice
    let best = this.voices[0]; for (const v of this.voices) if (v.env < best.env) best = v;
    return best;
  }

  process(inputs, outputs) {
    const out = outputs[0]; const L = out[0]; const R = out[1] || out[0]; const N = L.length; const p = this.patch;
    L.fill(0); if (R !== L) R.fill(0);
    if (!p) return true;
    const t0 = currentTime, t1 = t0 + N / sampleRate, sr = sampleRate;
    while (this.queue.length && this.queue[0].start < t1) {
      const note = this.queue.shift(); this.startVoice(this.allocate(), note, Math.max(0, Math.round((note.start - t0) * sr)));
    }
    const ae = p.ampEnv, fe = p.filterEnv, fl = p.filter, lf = p.lfo || { target: 'off' };
    const atkS = ae.a * sr, decC = 1 - Math.exp(-3 / (ae.d * sr)), relC = Math.exp(Math.log(0.0005) / (ae.r * sr));
    const fAtk = fe.a * sr, fDecC = 1 - Math.exp(-3 / (fe.d * sr)), fRelC = Math.exp(Math.log(0.0005) / (fe.r * sr));
    const lp = fl.type, two = fl.rolloff === 24, k = 1 / ((lp === 'lowpass' || lp === 'highpass') ? Math.pow(10, Math.max(0, fl.resonance) / 20) : Math.max(0.1, fl.resonance));   // like a Web Audio biquad: low/high-pass Q is in dB
    const gain = p.gain * 0.5, pw = p.pulseWidth || 0.5, hasDc = p.osc1.wave === 'pulse' || p.osc1.wave === 'pwm' || p.osc2.wave === 'pulse' || p.osc2.wave === 'pwm';
    const lfoOn = lf.target !== 'off', lfoInc = (lf.rate || 5) / sr, depth = lf.depth || 0, pwmInc = (p.pwmRate || 2) / sr;
    const drive = p.drive || 0, driveK = 1 + drive * 8, driveNorm = drive > 0 ? 1 / Math.tanh(driveK * 0.7) : 1;
    for (const v of this.voices) {
      if (!v.active) continue;
      for (let i = 0; i < N; i += CTRL) {
        const m = Math.min(CTRL, N - i); const tBlock = t0 + i / sr;
        const rel = tBlock >= v.releaseAt;
        // ---- control rate: LFO, filter envelope, then the filter coefficients
        let lv = 0; if (lfoOn) { v.lfoPh += lfoInc * m; if (v.lfoPh >= 1) v.lfoPh -= 1; lv = lfoWave(lf.wave, v.lfoPh); }
        let cutoff = fl.cutoff;
        if (fl.envAmount > 0) {
          if (rel || v.fstage === 3) { v.fenv *= Math.pow(fRelC, m); v.fstage = 3; }
          else if (v.fstage === 0) { v.fenv += m / Math.max(1, fAtk); if (v.fenv >= 1) { v.fenv = 1; v.fstage = 1; } }
          else { v.fenv += (fe.s - v.fenv) * (1 - Math.pow(1 - fDecC, m)); }
          cutoff = fl.cutoff * Math.pow(2, fl.envAmount * v.fenv);
        }
        if (lf.target === 'filter') cutoff += cutoff * 0.9 * depth * lv;
        if (cutoff > sr * 0.45) cutoff = sr * 0.45; if (cutoff < 20) cutoff = 20;
        const g = Math.tan(Math.PI * cutoff / sr), a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
        let cents = lf.target === 'pitch' ? lv * depth * 100 : 0;
        if (v.glide) {           // slide notes: the pitch follows the points {at: seconds from the start, cents} (straight lines in cents, like the old engine's ramps)
          const el = tBlock - v.startAt; let pt = 0, pc = 0, gc = 0;
          for (const q of v.glide) { if (el < q.at) { gc = pc + (q.cents - pc) * (q.at > pt ? (el - pt) / (q.at - pt) : 1); break; } pt = q.at; pc = q.cents; gc = q.cents; }
          cents += gc;
        }
        const pitchMul = cents !== 0 ? Math.pow(2, cents / 1200) : 1;
        const tremG = lf.target === 'amp' ? 1 - depth * (0.5 - 0.5 * lv) : 1;
        for (let j = 0; j < m; j++) {
          const idx = i + j;
          if (v.wait > 0) { v.wait--; continue; }
          // ---- amp envelope
          if (rel) { v.env *= relC; if (v.env < 0.0003) { v.active = false; break; } }
          else if (v.stage === 0) { v.env += 1 / Math.max(1, atkS); if (v.env >= 1) { v.env = 1; v.stage = 1; } }
          else { v.env += (ae.s - v.env) * decC; }
          // ---- oscillators
          let s = 0;
          for (let o = 0; o < v.n; o++) {
            let ph = v.phase[o]; const dt = v.inc[o] * pitchMul; let w; const wv = v.wave[o];
            if (v.fmIdx[o] > 0) {
              let mp = v.fmPh[o]; const mod = Math.sin(TWO_PI * mp) * v.fmIdx[o]; mp += v.fmInc[o] * pitchMul; if (mp >= 1) mp -= 1; v.fmPh[o] = mp;
              w = Math.sin(TWO_PI * ph + mod);
            } else if (wv === 0) w = Math.sin(TWO_PI * ph);
            else if (wv === 1) w = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
            else if (wv === 2) w = 2 * ph - 1 - blep(ph, dt);
            else if (wv === 3) { w = ph < 0.5 ? 1 : -1; w += blep(ph, dt); let q = ph + 0.5; if (q >= 1) q -= 1; w -= blep(q, dt); }
            else {
              const width = wv === 5 ? 0.5 + 0.4 * Math.sin(TWO_PI * v.pwmPh) : pw;
              w = ph < width ? 1 : -1; w += blep(ph, dt); let q = ph - width; if (q < 0) q += 1; w -= blep(q, dt);
            }
            s += w * v.lvl[o];
            ph += dt; if (ph >= 1) ph -= 1; v.phase[o] = ph;
          }
          v.pwmPh += pwmInc / 1; if (v.pwmPh >= 1) v.pwmPh -= 1;
          if (v.noise > 0) { v.seed = (v.seed * 1664525 + 1013904223) | 0; s += (v.seed / 2147483648) * v.noise * 0.5; }
          // ---- filter (state variable, 12 dB; a second stage makes 24 dB)
          let x = s;
          let v3 = x - v.ic2a, v1 = a1 * v.ic1a + a2 * v3, v2 = v.ic2a + a2 * v.ic1a + a3 * v3; v.ic1a = 2 * v1 - v.ic1a; v.ic2a = 2 * v2 - v.ic2a;
          x = lp === 'highpass' ? x - k * v1 - v2 : lp === 'bandpass' ? k * v1 : lp === 'notch' ? x - k * v1 : v2;
          if (two) { v3 = x - v.ic2b; v1 = a1 * v.ic1b + a2 * v3; v2 = v.ic2b + a2 * v.ic1b + a3 * v3; v.ic1b = 2 * v1 - v.ic1b; v.ic2b = 2 * v2 - v.ic2b; x = lp === 'highpass' ? x - k * v1 - v2 : lp === 'bandpass' ? k * v1 : lp === 'notch' ? x - k * v1 : v2; }
          if (hasDc) { const y0 = x - v.dcx + 0.995 * v.dcy; v.dcx = x; v.dcy = y0; x = y0; }   // pulse waves are not centred: remove the offset (no click)
          const y = x * v.env * v.vel * gain * tremG;
          L[idx] += y;
        }
        if (!v.active) break;
      }
    }
    // ---- bus effects: drive, chorus (mono sum of the voices goes to both channels)
    if (drive > 0) for (let n = 0; n < N; n++) L[n] = Math.tanh(L[n] * driveK) * driveNorm * 0.7;
    if (p.chorus > 0) {
      const wet = p.chorus, len = this.cLen, base = 0.0035 * sr;
      for (let n = 0; n < N; n++) {
        const x = L[n]; this.cL[this.cPos] = x;
        this.cPh += 1.4 / sr; if (this.cPh >= 1) this.cPh -= 1;
        const dl = base * (1 + 0.5 * Math.sin(TWO_PI * this.cPh)), dr = base * (1 + 0.5 * Math.sin(TWO_PI * (this.cPh + 0.5)));
        const rd = (d) => { let pos = this.cPos - d; if (pos < 0) pos += len; const i0 = pos | 0, fr = pos - i0; return this.cL[i0] * (1 - fr) + this.cL[(i0 + 1) % len] * fr; };
        L[n] = x * (1 - wet) + rd(dl) * wet; if (R !== L) R[n] = x * (1 - wet) + rd(dr) * wet;
        this.cPos = (this.cPos + 1) % len;
      }
    } else if (R !== L) R.set(L);
    return true;
  }
}
registerProcessor('beatlab-synth', BeatLabSynth);
