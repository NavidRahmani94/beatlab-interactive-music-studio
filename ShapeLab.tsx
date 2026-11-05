// FILE: The SHAPE LAB panel (beta). Turning 3D shapes: a shape with N corners is a chord with N notes. It plays as an arpeggio or as a chord, on the beat.
// You build the chord progression and the arpeggio pattern yourself. The music rules are in shapeMusic.ts, the drawing in shapeScene.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DIV, Layer, MAX_LAYERS, MAX_PROG, MAX_SIDES, MAX_VOL_DB, MIN_SIDES, MIN_VOL_DB, Mode, PATTERN_KINDS, PROG_PRESETS, Progression, ROMAN, Rate, SIDES_NAME, chordName, chordNotes, clampSides, clampVolDb, defaultLayer, makePattern, noteLabel, noteSeconds, pcName, shapeToPatterns, tickEvents } from './shapeMusic';
import { MELODY_INSTRUMENTS, instrumentGroups } from './instruments';
import type { MelodyNote } from './melody';
import type { ShapeScene } from './shapeScene';   // type only: three.js is loaded on demand when the lab is opened (keeps it out of the first download)

type Props = {
  rows: number[];                                   // scaleRows(): the notes of the key and scale, with the octave on top
  bpm: number;
  keyPc: number;                                    // 0..11, changes the colours
  pulseKey: string;                                 // changes every time a kick drum hits while playing ('' = no kick now)
  lite: boolean;
  patternName: string;                              // the pattern that is open now (the new track is named after it)
  playing: boolean;                                 // the song is playing: the shapes follow its beat
  songStep: number;                                 // 16th-note counter of the song (-1 when stopped)
  onNote: (layer: number, midi: number, velocity: number, seconds: number) => void;   // plays on the own sound of that shape
  onVoices: (voices: { instrument: string; volumeDb: number }[]) => void;           // tells the audio engine the sound of every shape
  onConvert: (notesPerPattern: MelodyNote[][], instrument: string, label: string) => string;   // writes a new melody track, returns a message
};

const KEY = 'beatlab.shapelab.v2';
type Saved = { layers: Layer[]; prog: Progression };
function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    if (v && Array.isArray(v.layers) && v.layers.length >= 1 && v.layers.length <= MAX_LAYERS && Array.isArray(v.prog) && v.prog.length >= 1 && v.prog.length <= MAX_PROG
      && v.layers.every(l => l && Number.isFinite(l.sides) && Array.isArray(l.pattern) && l.pattern.length > 0 && l.pattern.every(n => Number.isInteger(n) && n >= 0 && n <= MAX_SIDES))) {
      return { layers: v.layers.map((l, i) => ({ ...l, instrument: typeof l.instrument === 'string' && l.instrument in MELODY_INSTRUMENTS ? l.instrument : defaultLayer(i).instrument, volumeDb: clampVolDb(l.volumeDb ?? -8), sides: clampSides(l.sides), octave: Math.max(-1, Math.min(1, Math.round(l.octave) || 0)), rate: (l.rate in DIV ? l.rate : '1/8') as Rate, mode: (['arp', 'chord', 'off'].includes(l.mode) ? l.mode : 'arp') as Mode })), prog: v.prog.map(d => Math.max(0, Math.min(6, Math.round(d) || 0))) };
    }
  } catch { /* no storage, or old data */ }
  return { layers: [defaultLayer(0)], prog: [0, 4, 5, 3] };
}

const RATES: Rate[] = ['1/16', '1/8', '1/4'];
const MODES: { id: Mode; label: string }[] = [{ id: 'arp', label: 'ARP' }, { id: 'chord', label: 'CHORD' }, { id: 'off', label: 'OFF' }];

export default function ShapeLab({ rows, bpm, keyPc, pulseKey, lite, patternName, playing, songStep, onNote, onVoices, onConvert }: Props) {
  const init = useRef(load()).current;
  const [on, setOn] = useState(false);
  const [layers, setLayers] = useState<Layer[]>(init.layers);
  const [prog, setProg] = useState<Progression>(init.prog);
  const [sel, setSel] = useState(0);
  const [running, setRunning] = useState(false);           // the shapes make sound
  const [error, setError] = useState('');
  const [bar, setBar] = useState(-1);                       // the bar that is playing now (for the highlight)
  const [slotNow, setSlotNow] = useState(-1);               // the pattern slot that is playing now
  const [lastNotes, setLastNotes] = useState('—');
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<ShapeScene | null>(null);
  const pulse = useRef(0);
  const first = useRef(true);
  const L = rows.length - 1;
  const live = useRef({ layers, prog, rows, bpm, keyPc, lite, onNote, running, playing, songStep, sel });
  live.current = { layers, prog, rows, bpm, keyPc, lite, onNote, running, playing, songStep, sel };
  const [note, setNote] = useState('');                    // message after CONVERT TO PATTERN
  const log = useRef<{ t: number; at: number; layer: number; play: number[]; name: string }[]>([]);   // for the tests
  const shown = useRef<{ chord: number[]; name: string; roman: string }[]>([]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ layers, prog })); } catch { /* ignore */ } }, [layers, prog]);
  // the audio engine gets the sound and the volume of every shape (also while the panel is closed, so a saved setup is ready)
  const voicesSig = layers.map(l => `${l.instrument}@${l.volumeDb}`).join('|');
  useEffect(() => { onVoices(layers.map(l => ({ instrument: l.instrument, volumeDb: l.volumeDb }))); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voicesSig]);
  useEffect(() => { if (first.current) { first.current = false; return; } if (pulseKey) pulse.current = 1; }, [pulseKey]);
  useEffect(() => { if (sel >= layers.length) setSel(Math.max(0, layers.length - 1)); }, [layers.length, sel]);

  // what each shape shows when nothing plays yet: the first chord of the progression
  const idle = useMemo(() => layers.map(l => { const c = chordNotes(rows, prog[0] ?? 0, l.sides, l.octave); return { chord: c, name: chordName(c), roman: ROMAN[(prog[0] ?? 0) % 7] }; }), [layers, prog, rows]);
  if (shown.current.length !== layers.length) shown.current = idle;

  /** One tick of the 16th-note clock: every shape may play. */
  const tick = (t: number) => {
    const c = live.current;
    c.layers.forEach((l, li) => {
      const ev = tickEvents(l, c.prog, t, c.rows); if (!ev) return;
      shown.current[li] = { chord: ev.chord, name: ev.name, roman: ROMAN[ev.degree % 7] };
      scene.current?.flash(li, ev.vertices);
      if (ev.play.length) {
        const accent = t % 16 === 0 ? 0.15 : 0;
        ev.play.forEach(m => c.onNote(li, m, Math.min(1, (l.mode === 'chord' ? 0.55 : 0.7) + accent), noteSeconds(c.bpm, l.rate, l.mode)));
        setLastNotes(ev.play.map(noteLabel).join(' '));
        log.current.push({ t, at: performance.now(), layer: li, play: ev.play, name: ev.name }); if (log.current.length > 400) log.current.shift();
      }
      if (li === c.sel) { setBar(ev.bar % c.prog.length); setSlotNow((t / DIV[l.rate]) % l.pattern.length); }
    });
  };

  // synced clock: follow the song's beat
  const lastSync = useRef(-1);
  useEffect(() => {
    if (!running || !playing || songStep < 0) { lastSync.current = -1; return; }
    const last = lastSync.current;
    if (last < 0 || songStep < last || songStep - last > 8) tick(songStep);
    else for (let t = last + 1; t <= songStep; t++) tick(t);
    lastSync.current = songStep;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songStep, running, playing]);

  // free clock: when the song is stopped, the shapes keep their own beat at the song tempo
  useEffect(() => {
    if (!running || playing) return;
    let t = 0; let next = performance.now() + 60;
    const id = window.setInterval(() => {
      const now = performance.now(); const ms = 60000 / live.current.bpm / 4;
      let guard = 0; while (now >= next && guard++ < 4) { tick(t++); next += ms; }
      if (guard >= 4) next = now + ms;
    }, 10);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, playing]);
  useEffect(() => { if (!running) { setBar(-1); setSlotNow(-1); shown.current = idle; } }, [running, idle]);

  // the 3D scene
  useEffect(() => {
    if (!on) return;
    const cv = canvas.current, box = wrap.current; if (!cv || !box) return;
    let cancelled = false; let cleanup: (() => void) | null = null;
    import('./shapeScene').then(({ ShapeScene: Scene }) => {
    if (cancelled) return;
    let sc: ShapeScene;
    try { sc = new Scene(cv); } catch { setError('This browser cannot draw 3D (WebGL is off). SHAPE LAB needs WebGL.'); setOn(false); return; }
    setError(''); scene.current = sc;
    const resize = () => sc.resize(box.clientWidth, box.clientHeight);
    resize(); const ro = new ResizeObserver(resize); ro.observe(box);
    const ndc = (e: PointerEvent | MouseEvent) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) }; };
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e: PointerEvent) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; sc.rotateBy(dx, dy); drag.x = e.clientX; drag.y = e.clientY; };
    const up = (e: PointerEvent) => {
      const d = drag; drag = null; if (!d || d.moved) return;
      const p = ndc(e); const hit = sc.pick(p.x, p.y); if (!hit) return;
      const c = live.current; const l = c.layers[hit.layer]; if (!l) return;
      const chord = shown.current[hit.layer]?.chord ?? []; const m = chord[hit.vertex]; if (m === undefined) return;
      setSel(hit.layer); sc.flash(hit.layer, [hit.vertex]); c.onNote(hit.layer, m, 0.8, 0.4); setLastNotes(noteLabel(m));
    };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });
    let raf = 0, last = performance.now(), visible = true, acc = 0;
    const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; }); io.observe(box);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000; last = now;
      if (document.hidden || !visible) return;
      acc += dt; if (live.current.lite && acc < 1 / 30) return;
      const step = acc; acc = 0;
      pulse.current = Math.max(0, pulse.current - step * 5);
      sc.hue = (live.current.keyPc / 12 + 0.02) % 1;
      const c = live.current;
      sc.draw(c.layers.map((l, i) => ({ ...(shown.current[i] ?? { chord: [], name: '', roman: '' }), selected: i === c.sel, muted: l.mode === 'off' })), pulse.current, step);
    };
    raf = requestAnimationFrame(frame);
    (window as unknown as { __BEATLAB_SHAPELAB__?: unknown }).__BEATLAB_SHAPELAB__ = { scene: sc, get log() { return log.current; }, get shown() { return shown.current; } };   // getters: the arrays are replaced sometimes
    cleanup = () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up);
      sc.dispose(); scene.current = null; delete (window as unknown as { __BEATLAB_SHAPELAB__?: unknown }).__BEATLAB_SHAPELAB__;
    };
    }).catch(() => { if (!cancelled) { setError('Could not load the 3D engine. Check the connection and try again.'); setOn(false); } });
    return () => { cancelled = true; cleanup?.(); };
  }, [on]);

  const cur = layers[Math.min(sel, layers.length - 1)];
  const setLayer = (patch: Partial<Layer>) => setLayers(ls => ls.map((l, i) => (i === sel ? { ...l, ...patch } : l)));
  const setSides = (n: number) => { const s = clampSides(n); setLayer({ sides: s, pattern: cur.pattern.map(v => (v > s ? ((v - 1) % s) + 1 : v)) }); };
  const setLen = (len: number) => setLayer({ pattern: Array.from({ length: len }, (_, i) => cur.pattern[i % cur.pattern.length] ?? 0) });
  const cycleSlot = (i: number) => setLayer({ pattern: cur.pattern.map((v, k) => (k === i ? (cur.mode === 'chord' ? (v ? 0 : 1) : (v + 1) % (cur.sides + 1)) : v)) });
  const degNames = (d: number) => `${ROMAN[d % 7]} ${chordName(chordNotes(rows, d, cur?.sides ?? 3, 0))}`;
  const addLayer = () => { if (layers.length >= MAX_LAYERS) return; setLayers(ls => [...ls, defaultLayer(ls.length)]); setSel(layers.length); };
  const removeLayer = () => { if (layers.length <= 1) return; setLayers(ls => ls.filter((_, i) => i !== sel)); setSel(0); };
  const slotLabel = (v: number): string => { if (!v) return '·'; if (cur.mode === 'chord') return '■'; const chord = shown.current[sel]?.chord ?? idle[sel]?.chord ?? []; const m = chord[(v - 1) % Math.max(1, chord.length)]; return m === undefined ? String(v) : pcName(m); };

  return <section className="panel shape" aria-label="Shape lab">
    <div className="panel-label">SHAPE LAB <span>3D SHAPES THAT PLAY CHORDS AND ARPEGGIOS · BETA</span></div>
    <div className="hand-top">
      <button className={'hand-switch' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => setOn(o => !o)}>
        <span className="knob" />{on ? 'SHAPE LAB ON — CLICK TO CLOSE' : 'OPEN SHAPE LAB'}
      </button>
      <span className="hand-privacy">A shape with 3 corners is a triad, 4 corners a 7th chord, 5 a 9th. Every corner shows its note. Every shape has its own sound and plays live on the beat of the song, in the key and scale of the song. It does not use the tracks of the song, until you press CONVERT TO PATTERN.</span>
    </div>
    {error && <div className="hand-error" role="alert">{error}</div>}
    {on && <div className="shape-body">
      <div className="shape-left">
        <div className="shape-stage" ref={wrap}><canvas ref={canvas} aria-label="3D shapes. Each corner is a note of the chord." /></div>
        <div className="shape-run">
          <button className={'hand-switch' + (running ? ' on' : '')} role="switch" aria-checked={running} onClick={() => setRunning(r => !r)}><span className="knob" />{running ? 'SHAPES PLAYING — CLICK TO STOP' : 'PLAY THE SHAPES'}</button>
          <span className="shape-stats" role="status" aria-live="off">{playing ? 'FOLLOWING THE SONG' : running ? 'OWN BEAT (song stopped)' : 'READY'} · CHORD <b>{shown.current[sel]?.name || idle[sel]?.name || '—'}</b> · NOTES <b>{lastNotes}</b></span>
        </div>
      </div>
      <div className="shape-side">
        <div className="shape-tabs" role="tablist" aria-label="Shapes">
          {layers.map((_, i) => <button key={i} role="tab" aria-selected={i === sel} className={'theme-btn' + (i === sel ? ' on' : '')} onClick={() => setSel(i)}>SHAPE {i + 1}</button>)}
          {layers.length < MAX_LAYERS && <button className="theme-btn" onClick={addLayer} title="Add another shape (they play together)">＋ SHAPE</button>}
          {layers.length > 1 && <button className="theme-btn" onClick={removeLayer} title="Remove this shape">✕</button>}
        </div>
        <div className="shape-row"><span>SOUND</span>
          <select aria-label="Sound of this shape" value={cur.instrument} onChange={e => setLayer({ instrument: e.target.value })}>
            {instrumentGroups().map(g => <optgroup key={g.group} label={g.group}>{g.ids.map(id => <option key={id} value={id}>{MELODY_INSTRUMENTS[id].label}</option>)}</optgroup>)}
          </select></div>
        <div className="shape-row"><span>VOLUME</span>
          <input type="range" aria-label="Volume of this shape" min={MIN_VOL_DB} max={MAX_VOL_DB} step={1} value={cur.volumeDb} onChange={e => setLayer({ volumeDb: clampVolDb(Number(e.target.value)) })} onDoubleClick={() => setLayer({ volumeDb: -8 })} />
          <b className="shape-val">{cur.volumeDb} dB</b></div>
        <div className="shape-row"><span>CORNERS</span>
          <button className="theme-btn" aria-label="Fewer corners" disabled={cur.sides <= MIN_SIDES} onClick={() => setSides(cur.sides - 1)}>−</button>
          <b className="shape-val">{cur.sides} · {SIDES_NAME[cur.sides]}</b>
          <button className="theme-btn" aria-label="More corners" disabled={cur.sides >= MAX_SIDES} onClick={() => setSides(cur.sides + 1)}>＋</button></div>
        <div className="shape-row"><span>OCTAVE</span>
          <button className="theme-btn" aria-label="Octave down" disabled={cur.octave <= -1} onClick={() => setLayer({ octave: cur.octave - 1 })}>−</button>
          <b className="shape-val">{cur.octave > 0 ? '+' : ''}{cur.octave}</b>
          <button className="theme-btn" aria-label="Octave up" disabled={cur.octave >= 1} onClick={() => setLayer({ octave: cur.octave + 1 })}>＋</button></div>
        <div className="shape-row"><span>PLAYS</span>{MODES.map(m => <button key={m.id} className={'theme-btn' + (cur.mode === m.id ? ' on' : '')} aria-pressed={cur.mode === m.id} onClick={() => setLayer({ mode: m.id })}>{m.label}</button>)}</div>
        <div className="shape-row"><span>SPEED</span>{RATES.map(r => <button key={r} className={'theme-btn' + (cur.rate === r ? ' on' : '')} aria-pressed={cur.rate === r} onClick={() => setLayer({ rate: r })}>{r}</button>)}</div>

        <div className="shape-title">CHORD PROGRESSION <em>one chord per bar · same for all shapes</em></div>
        <div className="shape-prog">
          {prog.map((d, i) => <label key={i} className={'shape-slot' + (i === bar ? ' now' : '')}><span>BAR {i + 1}</span>
            <select aria-label={`Chord of bar ${i + 1}`} value={d % L} onChange={e => setProg(p => p.map((x, k) => (k === i ? Number(e.target.value) : x)))}>
              {Array.from({ length: L }, (_, k) => <option key={k} value={k}>{degNames(k)}</option>)}
            </select></label>)}
        </div>
        <div className="shape-row">
          <button className="theme-btn" disabled={prog.length >= MAX_PROG} onClick={() => setProg(p => [...p, p[p.length - 1] ?? 0])}>＋ BAR</button>
          <button className="theme-btn" disabled={prog.length <= 1} onClick={() => setProg(p => p.slice(0, -1))}>− BAR</button>
          <select aria-label="Chord progression presets" value="" onChange={e => { const pr = PROG_PRESETS[Number(e.target.value)]; if (pr) setProg(pr.degrees.map(d => d % L)); }}>
            <option value="">PRESETS…</option>{PROG_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select></div>

        <div className="shape-title">{cur.mode === 'chord' ? 'CHORD RHYTHM' : 'ARPEGGIO PATTERN'} <em>{cur.mode === 'chord' ? 'click a step: hit or rest' : 'click a step: which corner plays (· = rest)'}</em></div>
        <div className="shape-pat" role="group" aria-label="Pattern steps">
          {cur.pattern.map((v, i) => <button key={i} className={'shape-cell' + (v ? ' on' : '') + (i === slotNow ? ' now' : '')} aria-label={`Step ${i + 1}: ${v ? (cur.mode === 'chord' ? 'hit' : 'corner ' + v) : 'rest'}`} onClick={() => cycleSlot(i)}><small>{v && cur.mode !== 'chord' ? v : ''}</small>{slotLabel(v)}</button>)}
        </div>
        <div className="shape-row">
          <span>STEPS</span>{[8, 16].map(n => <button key={n} className={'theme-btn' + (cur.pattern.length === n ? ' on' : '')} aria-pressed={cur.pattern.length === n} onClick={() => setLen(n)}>{n}</button>)}
          {PATTERN_KINDS.map(k => <button key={k.id} className="theme-btn" onClick={() => setLayer({ pattern: makePattern(k.id, cur.sides, cur.pattern.length) })}>{k.label}</button>)}
        </div>
        <div className="shape-row">
          <button className="theme-btn" onClick={() => setNote(onConvert(shapeToPatterns(cur, prog, rows), cur.instrument, `SHAPE ${sel + 1}`))} title={`Writes this shape (${prog.length} bar${prog.length === 1 ? '' : 's'}) as real notes into a new melody track named after the open pattern (${patternName})`}>⇪ CONVERT TO PATTERN</button>
          {note && <span className="shape-stats" role="status">{note}</span>}
        </div>
        <div className="hand-tips"><b>HOW</b> Press PLAY THE SHAPES. When the song plays, the shapes follow its beat; when it is stopped they use their own beat at the song tempo. Click a corner in the picture to hear its note. Drag the picture to turn it.</div>
      </div>
    </div>}
  </section>;
}
