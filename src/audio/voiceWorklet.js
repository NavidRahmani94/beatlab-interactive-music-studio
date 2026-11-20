// FILE: BeatLab synth engine 2. One AudioWorklet node plays every note of a sound, instead of a graph of many Web Audio nodes per note.
// It runs on the audio thread. Notes arrive with a start time (seconds of the audio clock), so the timing is sample accurate.
// Supports the whole SynthPatch (synth.ts): waves sine/triangle/saw/square/pulse/pwm, FM, 2 oscillators with unison, noise (white/pink/brown),
// state-variable filter (12/24 dB) with envelope, amp envelope, LFO (pitch / filter / tremolo), drive, stereo chorus, velocity, volume.
// Messages: {t:'patch', patch} {t:'note', id, start, dur, freq, vel} (dur = Infinity: held until {t:'rel', id, time}) {t:'off'}.
// This file is plain JavaScript (it is loaded as a module by the AudioWorklet, see workletSynth.ts).
//
// It copies how the OLD engine (patchSynth.ts on Tone.js) behaves, so both engines sound alike:
// - envelopes: linear attack; decay and release are Tone's "exponential approach" (time constant ln(t+1)/ln(200)) that turns into a
//   straight line for the last 10 % and ends exactly at the set time;
// - filter envelope: cutoff + cutoff·(2^octaves − 1)·env² (Tone FrequencyEnvelope, exponent 2);
// - FM: true frequency modulation by a SQUARE modulator (Tone's default), the carrier keeps its own wave;
// - unison: copies spread over ±spread/2 cents, each at −6 − 1.1·count dB, start phases i/count (Tone FatOscillator);
// - noise: Tone's white / pink / brown generators; drive: Tone.Distortion's curve, before the volume; chorus: Tone.Chorus depth.
/* global AudioWorkletProcessor, registerProcessor, currentTime, sampleRate */
const MAX_VOICES = 24;
const MAX_OSC = 10;           // 2 oscillators x 5 unison copies
const CTRL = 16;              // filter and LFO are updated every 16 samples
const TWO_PI = Math.PI * 2;
const LN200 = Math.log(200);

// the band-limited step (PolyBLEP) removes most of the harsh aliasing of saw and square waves
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
const dbToGain = db => Math.pow(10, db / 20);
const WAVES = { sine: 0, triangle: 1, sawtooth: 2, square: 3, pulse: 4, pwm: 5 };
const NOISE = { white: 0, pink: 1, brown: 2 };
const FM_SQ = 0.85;     // Chrome normalises its built-in square wave (the Tone FM modulator) to a peak of 1 including the ripple, so its flat part is a bit below 1
const START_PHASE = { sine: 0, triangle: 0.25, sawtooth: 0.5, square: 0, pulse: 0, pwm: 0 };
const lfoWave = (kind, ph) => kind === 'triangle' ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : kind === 'square' ? (ph < 0.5 ? 1 : -1) : kind === 'sawtooth' ? 2 * ph - 1 : Math.sin(TWO_PI * ph);

/** Envelope timing in samples, plus the per-sample factors of the exponential parts (like Tone's Envelope). */
function envParams(e) {
  const sr = sampleRate;
  const tc = t => Math.log(t + 1) / LN200;                     // Tone: exponentialApproachValueAtTime
  return { atk: Math.max(1, e.a * sr), dS: e.d * sr, d90: 0.9 * e.d * sr, r90: 0.9 * e.r * sr, s: e.s, rS: e.r * sr, kD: Math.exp(-1 / (tc(e.d) * sr)), kR: Math.exp(-1 / (tc(e.r) * sr)), hasDecay: e.d > 0 && e.s < 1 };
}

/** ADSR in Tone's shape. Stages: 0 attack, 1 decay (curve), 2 decay (last 10 %, straight), 3 sustain, 4 release (curve), 5 release (straight), 6 done. */
class Env {
  constructor() { this.v = 0; this.st = 6; this.n = 0; this.v90 = 0; }
  start() { this.v = 0; this.st = 0; this.n = 0; }
  release() { if (this.st < 4) { this.st = this.v > 0 ? 4 : 6; this.n = 0; } }
  next(P, c) {
    let v = this.v;
    switch (this.st) {
      case 0: v += c / P.atk; if (v >= 1) { v = 1; this.st = P.hasDecay ? 1 : 3; this.n = 0; } break;
      case 1: v = P.s + (v - P.s) * (c === 1 ? P.kD : Math.pow(P.kD, c)); this.n += c; if (this.n >= 0.9 * P.dS) { this.v90 = v; this.st = 2; } break;
      case 2: this.n += c; v = this.v90 + (P.s - this.v90) * Math.min(1, (this.n - 0.9 * P.dS) / (0.1 * P.dS)); if (this.n >= P.dS) { v = P.s; this.st = 3; } break;
      case 4: v *= (c === 1 ? P.kR : Math.pow(P.kR, c)); this.n += c; if (this.n >= 0.9 * P.rS) { this.v90 = v; this.st = 5; } break;
      case 5: this.n += c; v = this.v90 * Math.max(0, 1 - (this.n - 0.9 * P.rS) / (0.1 * P.rS)); if (this.n >= P.rS) { v = 0; this.st = 6; } break;
      default: break;
    }
    this.v = v; return v;
  }
}

class Voice {
  constructor() {
    this.active = false; this.id = -1;
    this.phase = new Float64Array(MAX_OSC); this.inc = new Float64Array(MAX_OSC); this.lvl = new Float64Array(MAX_OSC);
    this.wave = new Int8Array(MAX_OSC); this.fmIdx = new Float64Array(MAX_OSC); this.fmInc = new Float64Array(MAX_OSC); this.fmPh = new Float64Array(MAX_OSC); this.n = 0;
    this.amp = new Env(); this.fil = new Env(); this.wait = 0; this.lfoPh = 0; this.pwmPh = 0;
    this.ic1a = 0; this.ic2a = 0; this.ic1b = 0; this.ic2b = 0; this.dcx = 0; this.dcy = 0;
    this.vel = 1; this.noise = 0; this.seed = 1; this.nb = new Float64Array(7); this.brown = 0;
    this.fmSq = new Uint8Array(MAX_OSC); this.fmEnvOf = new Int8Array(MAX_OSC); this.fe = [new Env(), new Env()];   // FM modulator: square or sine, optional own envelope (osc1 / osc2)
    this.releaseAt = Infinity; this.released = false; this.glide = null; this.startAt = 0;
  }
}

class BeatLabSynth extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.patch = null; this.voices = Array.from({ length: MAX_VOICES }, () => new Voice());
    this.queue = []; this.steals = 0;
    // chorus: two delay lines (left / right), modulated by a slow LFO
    this.cLen = 4096; this.cL = new Float32Array(this.cLen); this.cPos = 0; this.cPh = 0;
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
    const ampEnv = k(p.ampEnv), filterEnv = k(p.filterEnv);
    // osc.fmEnv (optional): the modulator has its own envelope, scaled by velocity, like Tone's FMSynth (the electric piano starts bright and gets round)
    const fmP = [p.osc1, p.osc2].map(o => (o && o.fmEnv ? envParams(k(o.fmEnv)) : null));
    this.patch = { ...p, ampEnv, filterEnv, ampP: envParams(ampEnv), filP: envParams(filterEnv), fmP, gain: dbToGain(p.volumeDb || 0) };
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
      const pulse = o.wave === 'pulse' || o.wave === 'pwm';
      const fm = o.fmIndex > 0 && !pulse;
      const copies = fm || pulse ? 1 : u;                       // like Tone's OmniOscillator: FM and pulse waves have no unison
      const base = f0 * Math.pow(2, o.octave) * Math.pow(2, o.cents / 1200);
      const lvl = copies > 1 ? o.level * dbToGain(-6 - copies * 1.1) : o.level;   // Tone FatOscillator: every copy at -6 - 1.1·count dB
      for (let c = 0; c < copies; c++) {
        const spread = copies === 1 ? 0 : -p.spread / 2 + c * (p.spread / (copies - 1));   // cents, from -spread/2 to +spread/2
        const i = v.n;
        v.inc[i] = (base * Math.pow(2, spread / 1200)) / sampleRate;
        // start phase like Tone: its saw starts mid-cycle (0 rising), its triangle a quarter in; unison copy c is DELAYED by c/count of a cycle
        v.phase[i] = (START_PHASE[o.wave] + (copies > 1 ? 1 - c / copies : 0)) % 1;
        v.lvl[i] = lvl; v.wave[i] = WAVES[o.wave] ?? 2;
        v.fmIdx[i] = fm ? o.fmIndex : 0; v.fmInc[i] = v.inc[i] * (o.fmRatio || 1); v.fmPh[i] = 0;
        v.fmSq[i] = o.fmWave === 'sine' ? 0 : 1; v.fmEnvOf[i] = fm && p.fmP[oi - 1] ? oi - 1 : -1;
        v.n++;
      }
    }
    v.fe[0].start(); v.fe[1].start();
    v.noise = p.noise || 0; v.seed = 1 + ((Math.random() * 1e6) | 0); v.nb.fill(0); v.brown = 0;
    v.amp.start(); v.fil.start(); v.wait = wait; v.lfoPh = 0; v.pwmPh = 0;
    v.releaseAt = note.dur === Infinity ? Infinity : note.start + note.dur; v.released = false; v.glide = note.glide && note.glide.length ? note.glide : null; v.startAt = note.start;
    v.ic1a = v.ic2a = v.ic1b = v.ic2b = 0; v.dcx = v.dcy = 0;
  }

  allocate() {
    for (const v of this.voices) if (!v.active) return v;
    this.steals++;                                              // all busy: take the quietest voice
    let best = this.voices[0]; for (const v of this.voices) if (v.amp.v < best.amp.v) best = v;
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
    const AP = p.ampP, FP = p.filP, fl = p.filter, lf = p.lfo || { target: 'off' };
    const lp = fl.type, two = fl.rolloff === 24, k = 1 / ((lp === 'lowpass' || lp === 'highpass') ? Math.pow(10, Math.max(0, fl.resonance) / 20) : Math.max(0.1, fl.resonance));   // like a Web Audio biquad: low/high-pass Q is in dB
    const pw = p.pulseWidth || 0.5, hasDc = p.osc1.wave === 'pulse' || p.osc1.wave === 'pwm' || p.osc2.wave === 'pulse' || p.osc2.wave === 'pwm';
    const lfoOn = lf.target !== 'off', lfoInc = (lf.rate || 5) / sr, depth = lf.depth || 0, pwmInc = (p.pwmRate || 2) / sr;
    const envOct = fl.envAmount > 0 ? Math.pow(2, fl.envAmount) - 1 : 0, fSpan = fl.cutoff * 0.9 * depth;
    const noiseKind = NOISE[p.noiseColor] ?? 0;
    for (const v of this.voices) {
      if (!v.active) continue;
      for (let i = 0; i < N; i += CTRL) {
        const m = Math.min(CTRL, N - i); const tBlock = t0 + i / sr;
        if (v.wait >= m) { v.wait -= m; continue; }            // the note starts later
        const rel = tBlock >= v.releaseAt;
        if (rel && !v.released) { v.released = true; v.amp.release(); v.fil.release(); v.fe[0].release(); v.fe[1].release(); }
        // ---- control rate: LFO, filter envelope, then the filter coefficients
        let lv = 0; if (lfoOn) { v.lfoPh += lfoInc * m; if (v.lfoPh >= 1) v.lfoPh -= 1; lv = lfoWave(lf.wave, v.lfoPh); }
        let cutoff = fl.cutoff;
        if (envOct > 0) { const e = v.fil.next(FP, m); cutoff += fl.cutoff * envOct * e * e; }        // Tone FrequencyEnvelope, exponent 2
        if (lf.target === 'filter') cutoff += fSpan * (0.3 + 1.3 * lv);                              // Tone LFO range -span … +1.6·span
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
        const amp = v.amp, FM0 = p.fmP[0], FM1 = p.fmP[1];
        for (let j = 0; j < m; j++) {
          const idx = i + j;
          if (v.wait > 0) { v.wait--; continue; }
          // ---- amp envelope
          // amp envelope: the common stages inline (this loop runs for every voice and sample), the stage changes in Env.next
          let env; const st = amp.st;
          if (st === 3) env = amp.v;                                                                  // sustain: the level does not move
          else if (st === 1 && amp.n + 1 < AP.d90) { env = amp.v = AP.s + (amp.v - AP.s) * AP.kD; amp.n++; }
          else if (st === 4 && amp.n + 1 < AP.r90) { env = amp.v *= AP.kR; amp.n++; }
          else env = amp.next(AP, 1);
          if (amp.st === 6) { v.active = false; break; }
          const fe0 = FM0 ? v.fe[0].next(FM0, 1) * v.vel : 1, fe1 = FM1 ? v.fe[1].next(FM1, 1) * v.vel : 1;
          // ---- oscillators
          let s = 0;
          for (let o = 0; o < v.n; o++) {
            let ph = v.phase[o]; let dt = v.inc[o] * pitchMul; let w; const wv = v.wave[o]; let sgn = 1, adt = dt;
            if (v.fmIdx[o] > 0) {      // FM like Tone's FMOscillator / FMSynth: the modulator (square by default) moves the carrier FREQUENCY by ± index · frequency
              let mp = v.fmPh[o]; const mdt = v.fmInc[o] * pitchMul; let mw;
              if (v.fmSq[o]) { mw = mp < 0.5 ? 1 : -1; mw += blep(mp, mdt); let mq = mp + 0.5; if (mq >= 1) mq -= 1; mw -= blep(mq, mdt); mw *= FM_SQ; }
              else mw = Math.sin(TWO_PI * mp);
              mp += mdt; if (mp >= 1) mp -= 1; v.fmPh[o] = mp;
              const fe = v.fmEnvOf[o] === 0 ? fe0 : v.fmEnvOf[o] === 1 ? fe1 : 1;
              dt *= 1 + v.fmIdx[o] * mw * fe;
              if (dt < 0) { sgn = -1; adt = -dt; } else adt = dt;     // deep FM can run the carrier backwards for a moment
              if (adt > 0.5) adt = 0.5;
            }
            if (wv === 0) w = Math.sin(TWO_PI * ph);
            else if (wv === 1) w = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
            else if (wv === 2) w = 2 * ph - 1 - sgn * blep(ph, adt);
            else if (wv === 3) { w = ph < 0.5 ? 1 : -1; w += sgn * blep(ph, adt); let q = ph + 0.5; if (q >= 1) q -= 1; w -= sgn * blep(q, adt); }
            else {
              const width = wv === 5 ? 0.5 + 0.4 * Math.sin(TWO_PI * v.pwmPh) : pw;
              w = ph < width ? 1 : -1; w += blep(ph, adt); let q = ph - width; if (q < 0) q += 1; w -= blep(q, adt);
            }
            s += w * v.lvl[o];
            ph += dt; if (ph >= 1) ph -= 1; else if (ph < 0) ph += 1; v.phase[o] = ph;
          }
          v.pwmPh += pwmInc; if (v.pwmPh >= 1) v.pwmPh -= 1;
          if (v.noise > 0) {
            v.seed = (v.seed * 1664525 + 1013904223) | 0; const wn = v.seed / 2147483648; let nz = wn;
            if (noiseKind === 1) {     // pink (Tone's filter)
              const b = v.nb;
              b[0] = 0.99886 * b[0] + wn * 0.0555179; b[1] = 0.99332 * b[1] + wn * 0.0750759; b[2] = 0.969 * b[2] + wn * 0.153852;
              b[3] = 0.8665 * b[3] + wn * 0.3104856; b[4] = 0.55 * b[4] + wn * 0.5329522; b[5] = -0.7616 * b[5] - wn * 0.016898;
              nz = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + wn * 0.5362) * 0.11; b[6] = wn * 0.115926;
            } else if (noiseKind === 2) { v.brown = (v.brown + 0.02 * wn) / 1.02; nz = v.brown * 3.5; }
            s += nz * v.noise;
          }
          // ---- filter (state variable, 12 dB; a second stage makes 24 dB)
          let x = s;
          let v3 = x - v.ic2a, v1 = a1 * v.ic1a + a2 * v3, v2 = v.ic2a + a2 * v.ic1a + a3 * v3; v.ic1a = 2 * v1 - v.ic1a; v.ic2a = 2 * v2 - v.ic2a;
          x = lp === 'highpass' ? x - k * v1 - v2 : lp === 'bandpass' ? k * v1 : lp === 'notch' ? x - k * v1 : v2;
          if (two) { v3 = x - v.ic2b; v1 = a1 * v.ic1b + a2 * v3; v2 = v.ic2b + a2 * v.ic1b + a3 * v3; v.ic1b = 2 * v1 - v.ic1b; v.ic2b = 2 * v2 - v.ic2b; x = lp === 'highpass' ? x - k * v1 - v2 : lp === 'bandpass' ? k * v1 : lp === 'notch' ? x - k * v1 : v2; }
          if (hasDc) { const y0 = x - v.dcx + 0.995 * v.dcy; v.dcx = x; v.dcy = y0; x = y0; }   // pulse waves are not centred: remove the offset (no click)
          L[idx] += x * env * v.vel * tremG;
        }
        if (!v.active) break;
      }
    }
    // ---- bus: drive (Tone.Distortion curve, BEFORE the volume like the old engine), chorus, then the volume
    const drive = p.drive || 0;
    if (drive > 0) {
      const kd = Math.min(0.95, drive * 0.9) * 100, c = (3 + kd) * 20 * Math.PI / 180;
      for (let n = 0; n < N; n++) { const x = L[n] > 1 ? 1 : L[n] < -1 ? -1 : L[n]; L[n] = c * x / (Math.PI + kd * Math.abs(x)); }
    }
    const gain = p.gain;
    if (p.chorus > 0) {
      const wet = p.chorus, len = this.cLen, base = 0.0035 * sr;
      const rd = d => { let pos = this.cPos - d; if (pos < 0) pos += len; const i0 = pos | 0, fr = pos - i0; return this.cL[i0] * (1 - fr) + this.cL[(i0 + 1) % len] * fr; };
      for (let n = 0; n < N; n++) {
        const x = L[n]; this.cL[this.cPos] = x;
        this.cPh += 1.4 / sr; if (this.cPh >= 1) this.cPh -= 1;
        const dl = base * (1 + 0.7 * Math.sin(TWO_PI * this.cPh)), dr = base * (1 + 0.7 * Math.sin(TWO_PI * (this.cPh + 0.5)));   // Tone.Chorus depth 0.7
        L[n] = (x * (1 - wet) + rd(dl) * wet) * gain; if (R !== L) R[n] = (x * (1 - wet) + rd(dr) * wet) * gain;
        this.cPos = (this.cPos + 1) % len;
      }
    } else { for (let n = 0; n < N; n++) L[n] *= gain; if (R !== L) R.set(L); }
    return true;
  }
}
registerProcessor('beatlab-synth', BeatLabSynth);
