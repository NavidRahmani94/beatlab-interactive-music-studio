import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Envelope, FACTORY_IDS, FACTORY_SOUNDS, FILTER_TYPES, FilterType, LFO_TARGETS, LFO_WAVES, LfoTarget, LfoWave, LIMITS, MAX_SYNTHS, NOISE_COLORS, NoiseColor,
  OscSettings, SOUND_GROUPS, SynthPatch, SynthSlot, WAVES, Wave, addSynth, clampPatch, customRef, defaultPatch, makePatch, randomPatch, removeSynth, updateSynth
} from './synth';
import { MELODIC_TRACKS, MelodicTrack } from './instruments';
import { TrackInstruments } from './project';

type Props = {
  synths: SynthSlot[];
  onSynths: (fn: (prev: SynthSlot[]) => SynthSlot[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tracks: TrackInstruments;
  onUse: (track: MelodicTrack, ref: string) => void;
  onKeyDown: (patch: SynthPatch, note: string) => void;
  onKeyUp: (patch: SynthPatch, note: string) => void;
  onKeysStop: () => void;
  getWaveform: () => Float32Array | null;
};

const TRACK_NAMES: Record<MelodicTrack, string> = { melody: 'Melody', ambient: 'Ambient', arp: 'Arpeggio' };
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (midi: number): string => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const isBlack = (midi: number): boolean => [1, 3, 6, 8, 10].includes(midi % 12);
// computer keyboard -> semitones above the keyboard's first C (a-row = white keys, w-row = black keys)
const KEY_MAP: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };

function Knob(p: { label: string; value: number; min: number; max: number; step?: number; log?: boolean; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const { value, min, max, log } = p;
  const pos = log ? Math.log(value / min) / Math.log(max / min) : value;
  const fmt = p.fmt ?? ((v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)));
  return <label className="knob">
    <span>{p.label}<b>{fmt(value)}</b></span>
    <input type="range" aria-label={p.label} min={log ? 0 : min} max={log ? 1 : max} step={log ? 0.001 : p.step ?? 0.01} value={pos}
      onChange={e => { const v = Number(e.target.value); p.onChange(log ? min * Math.pow(max / min, v) : v); }} />
  </label>;
}

function Choice<T extends string>(p: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return <label className="knob choice">
    <span>{p.label}</span>
    <select aria-label={p.label} value={p.value} onChange={e => p.onChange(e.target.value as T)}>
      {(Object.keys(p.options) as T[]).map(k => <option key={k} value={k}>{p.options[k]}</option>)}
    </select>
  </label>;
}

/** Little picture of an ADSR envelope. */
function EnvGraph({ env }: { env: Envelope }) {
  const total = env.a + env.d + 0.5 + env.r;
  const W = 160, H = 46;
  const x = (t: number) => (t / total) * W;
  const y = (v: number) => H - 4 - v * (H - 10);
  const pts = [[0, 0], [env.a, 1], [env.a + env.d, env.s], [env.a + env.d + 0.5, env.s], [total, 0]].map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return <svg className="env-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Envelope shape"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
}

function EnvEditor(p: { title: string; env: Envelope; onChange: (e: Envelope) => void }) {
  const { env } = p;
  const t = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);
  return <div className="lab-card">
    <h4>{p.title}</h4>
    <EnvGraph env={env} />
    <Knob label={`${p.title} attack`} value={env.a} min={LIMITS.a[0]} max={LIMITS.a[1]} log fmt={t} onChange={a => p.onChange({ ...env, a })} />
    <Knob label={`${p.title} decay`} value={env.d} min={LIMITS.d[0]} max={LIMITS.d[1]} log fmt={t} onChange={d => p.onChange({ ...env, d })} />
    <Knob label={`${p.title} sustain`} value={env.s} min={0} max={1} fmt={v => `${Math.round(v * 100)}%`} onChange={s => p.onChange({ ...env, s })} />
    <Knob label={`${p.title} release`} value={env.r} min={LIMITS.r[0]} max={LIMITS.r[1]} log fmt={t} onChange={r => p.onChange({ ...env, r })} />
  </div>;
}

function OscEditor(p: { title: string; osc: OscSettings; onChange: (o: OscSettings) => void }) {
  const { osc } = p;
  return <div className="lab-card">
    <h4>{p.title}</h4>
    <Choice label={`${p.title} wave`} value={osc.wave} options={WAVES} onChange={wave => p.onChange({ ...osc, wave })} />
    <Knob label={`${p.title} level`} value={osc.level} min={0} max={1} fmt={v => (v === 0 ? 'off' : `${Math.round(v * 100)}%`)} onChange={level => p.onChange({ ...osc, level })} />
    <Knob label={`${p.title} octave`} value={osc.octave} min={-3} max={3} step={1} fmt={v => (v > 0 ? `+${v}` : `${v}`)} onChange={octave => p.onChange({ ...osc, octave })} />
    <Knob label={`${p.title} fine tune`} value={osc.cents} min={-100} max={100} step={1} fmt={v => `${v > 0 ? '+' : ''}${Math.round(v)} ct`} onChange={cents => p.onChange({ ...osc, cents })} />
    <Knob label={`${p.title} FM amount`} value={osc.fmIndex} min={0} max={12} fmt={v => (v === 0 ? 'off' : v.toFixed(1))} onChange={fmIndex => p.onChange({ ...osc, fmIndex })} />
    <Knob label={`${p.title} FM ratio`} value={osc.fmRatio} min={0.25} max={8} fmt={v => `×${v.toFixed(2)}`} onChange={fmRatio => p.onChange({ ...osc, fmRatio })} />
  </div>;
}

function Scope({ getWaveform }: { getWaveform: () => Float32Array | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const style = getComputedStyle(canvas);
      ctx.strokeStyle = style.getPropertyValue('--viz-grid').trim() || '#444';
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      const wave = getWaveform();
      ctx.strokeStyle = style.getPropertyValue('--viz-a').trim() || '#d9ff71';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (wave && wave.length) wave.forEach((v, i) => { const px = (i / (wave.length - 1)) * w, py = h / 2 - Math.max(-1, Math.min(1, v * 1.6)) * (h / 2 - 3); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
      else { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getWaveform]);
  return <canvas ref={ref} className="viz-canvas scope" aria-label="Oscilloscope" />;
}

function Keyboard(p: { patch: SynthPatch; onDown: (n: string) => void; onUp: (n: string) => void; onStop: () => void }) {
  const [octave, setOctave] = useState(3); // the keyboard starts at C<octave>
  const [down, setDown] = useState<Set<number>>(new Set());
  const base = (octave + 1) * 12;
  const midis = useMemo(() => Array.from({ length: 25 }, (_, i) => base + i), [base]);
  const handlers = useRef({ onDown: p.onDown, onUp: p.onUp });
  handlers.current = { onDown: p.onDown, onUp: p.onUp };
  const press = (m: number) => { setDown(d => (d.has(m) ? d : new Set(d).add(m))); handlers.current.onDown(noteName(m)); };
  const release = (m: number) => { setDown(d => { if (!d.has(m)) return d; const n = new Set(d); n.delete(m); return n; }); handlers.current.onUp(noteName(m)); };

  useEffect(() => {
    const held = new Map<string, number>();
    const typing = (t: EventTarget | null) => /^(INPUT|SELECT|TEXTAREA)$/.test((t as HTMLElement | null)?.tagName ?? '') && (t as HTMLInputElement).type !== 'range';
    const kd = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const semi = KEY_MAP[e.key.toLowerCase()];
      if (semi === undefined || held.has(e.code)) return;
      e.preventDefault();
      const m = base + semi;
      held.set(e.code, m); press(m);
    };
    const ku = (e: KeyboardEvent) => { const m = held.get(e.code); if (m === undefined) return; held.delete(e.code); release(m); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); held.forEach(m => handlers.current.onUp(noteName(m))); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const whites = midis.filter(m => !isBlack(m));
  const pointer = (m: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); press(m); },
    onPointerUp: () => release(m), onPointerCancel: () => release(m), onLostPointerCapture: () => release(m)
  });
  return <div className="lab-keys-wrap">
    <div className="lab-keys-bar">
      <span>KEYBOARD — click, touch, or type A S D F G H J K · W E T Y U for black keys</span>
      <div className="seg" role="group" aria-label="Keyboard octave">
        <button aria-label="Octave down" disabled={octave <= 1} onClick={() => { p.onStop(); setOctave(o => o - 1); }}>−</button>
        <button disabled aria-label="Current octave">C{octave}–C{octave + 2}</button>
        <button aria-label="Octave up" disabled={octave >= 5} onClick={() => { p.onStop(); setOctave(o => o + 1); }}>+</button>
      </div>
    </div>
    <div className="lab-keys" role="group" aria-label="Synth keyboard">
      {whites.map(m => {
        const blackAfter = midis.includes(m + 1) && isBlack(m + 1);
        return <div key={m} className="wkey-slot">
          <button className={'wkey' + (down.has(m) ? ' down' : '')} aria-label={`Play ${noteName(m)}`} data-note={noteName(m)} {...pointer(m)}>{m % 12 === 0 ? noteName(m) : ''}</button>
          {blackAfter && <button className={'bkey' + (down.has(m + 1) ? ' down' : '')} aria-label={`Play ${noteName(m + 1)}`} data-note={noteName(m + 1)} {...pointer(m + 1)} />}
        </div>;
      })}
    </div>
  </div>;
}

export default function SynthPanel(p: Props) {
  const { synths, selectedId } = p;
  const slot = synths.find(s => s.id === selectedId) ?? null;
  const [fromLib, setFromLib] = useState('');
  const patch = slot?.patch ?? null;

  const edit = (fn: (pt: SynthPatch) => SynthPatch) => { if (slot) p.onSynths(ss => updateSynth(ss, slot.id, s => ({ ...s, patch: clampPatch(fn(s.patch)) }))); };
  const create = (name: string, source: SynthPatch) => {
    if (synths.length >= MAX_SYNTHS) return;
    const next = addSynth(synths, name, source);
    p.onSynths(() => next);
    p.onSelect(next[next.length - 1].id);
  };
  const remove = () => {
    if (!slot) return;
    if (!window.confirm(`Delete the synth “${slot.name}”? Tracks that use it go back to their default sound.`)) return;
    const rest = removeSynth(synths, slot.id);
    p.onSynths(() => rest);
    p.onSelect(rest.length ? rest[0].id : null);
  };
  const usedBy = (id: string) => MELODIC_TRACKS.filter(t => p.tracks[t] === customRef(id));
  const full = synths.length >= MAX_SYNTHS;

  return <section className="panel lab" aria-label="Synth Lab">
    <div className="panel-label">SYNTH LAB <span>DESIGN YOUR OWN SOUND · SAVED IN THE PROJECT · USE IT ON ANY TRACK</span></div>

    <div className="lab-top">
      <div className="chips" role="group" aria-label="Your synths">
        {synths.map(s => <button key={s.id} className={'chip' + (s.id === selectedId ? ' sel' : '')} style={{ ['--c' as string]: 'var(--accent-text)' }} aria-pressed={s.id === selectedId} onClick={() => { p.onKeysStop(); p.onSelect(s.id); }}>
          <i />{s.name}{usedBy(s.id).length > 0 && <small> · {usedBy(s.id).map(t => TRACK_NAMES[t]).join('+')}</small>}
        </button>)}
        {synths.length === 0 && <span className="hint">No synth yet. Make one from scratch or start from a library sound →</span>}
      </div>
      <div className="lab-actions">
        <button className="auto-btn" disabled={full} onClick={() => create('My synth', defaultPatch())}>＋ NEW SYNTH</button>
        <label className="ctl">START FROM A SOUND
          <select aria-label="Start from a library sound" value={fromLib} disabled={full} onChange={e => { const id = e.target.value; setFromLib(''); if (id) create(FACTORY_SOUNDS[id].label, FACTORY_SOUNDS[id].patch); }}>
            <option value="">Choose…</option>
            {SOUND_GROUPS.map(g => <optgroup key={g} label={g}>{FACTORY_IDS.filter(id => FACTORY_SOUNDS[id].group === g).map(id => <option key={id} value={id}>{FACTORY_SOUNDS[id].label}</option>)}</optgroup>)}
          </select>
        </label>
        <button className="auto-btn" disabled={full} onClick={() => create('Random synth', randomPatch())} title="A random but playable sound — a good way to find ideas">🎲 RANDOM</button>
      </div>
    </div>

    {!slot || !patch ? <div className="lab-empty">Press <b>＋ NEW SYNTH</b>, <b>🎲 RANDOM</b>, or pick any library sound to open it here and change it.</div> : <>
      <div className="lab-head">
        <label className="ctl">NAME <input className="name-input short" aria-label="Synth name" value={slot.name} maxLength={40} onChange={e => p.onSynths(ss => updateSynth(ss, slot.id, s => ({ ...s, name: e.target.value })))} /></label>
        <div className="ctl">USE THIS SYNTH ON
          <div className="seg" role="group" aria-label="Use this synth on">
            {MELODIC_TRACKS.map(t => { const on = p.tracks[t] === customRef(slot.id); return <button key={t} aria-pressed={on} className={on ? 'sel' : ''} onClick={() => p.onUse(t, customRef(slot.id))}>{on ? '✓ ' : ''}{TRACK_NAMES[t].toUpperCase()}</button>; })}
          </div>
        </div>
        <button className="auto-btn" disabled={full} onClick={() => create(`${slot.name} copy`, slot.patch)}>⧉ DUPLICATE</button>
        <button className="auto-btn" onClick={() => edit(() => randomPatch())} title="Replace this sound with a random one">🎲 RANDOMIZE</button>
        <button className="auto-btn danger" onClick={remove}>🗑 DELETE</button>
      </div>

      <Keyboard patch={patch} onDown={n => p.onKeyDown(patch, n)} onUp={n => p.onKeyUp(patch, n)} onStop={p.onKeysStop} />
      <div className="lab-scope"><Scope getWaveform={p.getWaveform} /></div>

      <div className="lab-grid">
        <OscEditor title="Oscillator 1" osc={patch.osc1} onChange={osc1 => edit(pt => ({ ...pt, osc1 }))} />
        <OscEditor title="Oscillator 2" osc={patch.osc2} onChange={osc2 => edit(pt => ({ ...pt, osc2 }))} />
        <div className="lab-card">
          <h4>Tone shaping</h4>
          <Knob label="Unison voices" value={patch.unison} min={1} max={5} step={1} fmt={v => `${Math.round(v)}`} onChange={unison => edit(pt => ({ ...pt, unison }))} />
          <Knob label="Unison spread" value={patch.spread} min={0} max={60} step={1} fmt={v => `${Math.round(v)} ct`} onChange={spread => edit(pt => ({ ...pt, spread }))} />
          <Knob label="Pulse width" value={patch.pulseWidth} min={0.05} max={0.95} fmt={v => `${Math.round(v * 100)}%`} onChange={pulseWidth => edit(pt => ({ ...pt, pulseWidth }))} />
          <Knob label="PWM speed" value={patch.pwmRate} min={0.1} max={20} log fmt={v => `${v.toFixed(1)} Hz`} onChange={pwmRate => edit(pt => ({ ...pt, pwmRate }))} />
          <Knob label="Noise level" value={patch.noise} min={0} max={1} fmt={v => (v === 0 ? 'off' : `${Math.round(v * 100)}%`)} onChange={noise => edit(pt => ({ ...pt, noise }))} />
          <Choice<NoiseColor> label="Noise colour" value={patch.noiseColor} options={NOISE_COLORS} onChange={noiseColor => edit(pt => ({ ...pt, noiseColor }))} />
        </div>
        <div className="lab-card">
          <h4>Filter</h4>
          <Choice<FilterType> label="Filter type" value={patch.filter.type} options={FILTER_TYPES} onChange={type => edit(pt => ({ ...pt, filter: { ...pt.filter, type } }))} />
          <Knob label="Cutoff" value={patch.filter.cutoff} min={40} max={16000} log fmt={v => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`)} onChange={cutoff => edit(pt => ({ ...pt, filter: { ...pt.filter, cutoff } }))} />
          <Knob label="Resonance" value={patch.filter.resonance} min={0.1} max={20} log fmt={v => v.toFixed(1)} onChange={resonance => edit(pt => ({ ...pt, filter: { ...pt.filter, resonance } }))} />
          <Knob label="Filter envelope amount" value={patch.filter.envAmount} min={0} max={8} fmt={v => `${v.toFixed(1)} oct`} onChange={envAmount => edit(pt => ({ ...pt, filter: { ...pt.filter, envAmount } }))} />
          <Choice<'12' | '24'> label="Filter slope" value={String(patch.filter.rolloff) as '12' | '24'} options={{ '12': '12 dB / oct (soft)', '24': '24 dB / oct (steep)' }} onChange={v => edit(pt => ({ ...pt, filter: { ...pt.filter, rolloff: v === '12' ? 12 : 24 } }))} />
        </div>
        <EnvEditor title="Amp envelope" env={patch.ampEnv} onChange={ampEnv => edit(pt => ({ ...pt, ampEnv }))} />
        <EnvEditor title="Filter envelope" env={patch.filterEnv} onChange={filterEnv => edit(pt => ({ ...pt, filterEnv }))} />
        <div className="lab-card">
          <h4>LFO (movement)</h4>
          <Choice<LfoTarget> label="LFO target" value={patch.lfo.target} options={LFO_TARGETS} onChange={target => edit(pt => ({ ...pt, lfo: { ...pt.lfo, target } }))} />
          <Choice<LfoWave> label="LFO wave" value={patch.lfo.wave} options={LFO_WAVES} onChange={wave => edit(pt => ({ ...pt, lfo: { ...pt.lfo, wave } }))} />
          <Knob label="LFO speed" value={patch.lfo.rate} min={0.1} max={20} log fmt={v => `${v.toFixed(1)} Hz`} onChange={rate => edit(pt => ({ ...pt, lfo: { ...pt.lfo, rate } }))} />
          <Knob label="LFO depth" value={patch.lfo.depth} min={0} max={1} fmt={v => `${Math.round(v * 100)}%`} onChange={depth => edit(pt => ({ ...pt, lfo: { ...pt.lfo, depth } }))} />
        </div>
        <div className="lab-card">
          <h4>Effects &amp; output</h4>
          <Knob label="Drive" value={patch.drive} min={0} max={1} fmt={v => (v === 0 ? 'off' : `${Math.round(v * 100)}%`)} onChange={drive => edit(pt => ({ ...pt, drive }))} />
          <Knob label="Chorus" value={patch.chorus} min={0} max={1} fmt={v => (v === 0 ? 'off' : `${Math.round(v * 100)}%`)} onChange={chorus => edit(pt => ({ ...pt, chorus }))} />
          <Knob label="Synth volume" value={patch.volumeDb} min={-24} max={12} step={0.5} fmt={v => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`} onChange={volumeDb => edit(pt => ({ ...pt, volumeDb }))} />
          <Knob label="Transpose" value={patch.transpose} min={-36} max={36} step={1} fmt={v => `${v > 0 ? '+' : ''}${Math.round(v)} st`} onChange={transpose => edit(pt => ({ ...pt, transpose }))} />
          <button className="auto-btn" onClick={() => edit(() => makePatch({}))}>↺ RESET TO INIT</button>
        </div>
      </div>
    </>}
  </section>;
}

// keep the type import used (Wave) for documentation of the editor's wave list
export type { Wave };
