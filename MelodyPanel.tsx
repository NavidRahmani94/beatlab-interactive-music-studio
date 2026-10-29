import { Dispatch, KeyboardEvent, PointerEvent, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_VELOCITY, MAX_MIDI, MIN_MIDI, MelodyNote, NOTE_NAMES, PRESETS, PRESET_NAMES, PresetName, SCALES, ScaleName,
  easyRoot, generateMelody, inScale, makePreset, midiToNote, noteToMidi, remapToScale, scaleRows, setStepVelocity, stepVelocity, toggleNote, transposeNotes
} from './melody';
import { MELODY_INSTRUMENTS, MELODY_INSTRUMENT_IDS, MelodyInstrumentId } from './instruments';

type Mode = 'easy' | 'advanced';
type Props = {
  notes: MelodyNote[];
  onNotes: Dispatch<SetStateAction<MelodyNote[]>>;
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  keyPc: number;
  scale: ScaleName;
  onKeyChange: (keyPc: number) => void;
  onScaleChange: (scale: ScaleName) => void;
  instrument: MelodyInstrumentId;
  onInstrument: (id: MelodyInstrumentId) => void;
  step: number;
  playing: boolean;
};

const EASY_LENGTHS: [string, number][] = [['1 STEP', 1], ['2 STEPS', 2], ['4 STEPS', 4]];
const ADV_LENGTHS: [string, number][] = [['1', 1], ['2', 2], ['4', 4], ['8', 8]];
const ADV_ROW_PX = 23; // 20px row + 3px gap

export default function MelodyPanel({ notes, onNotes, enabled, onEnabled, keyPc, scale, onKeyChange, onScaleChange, instrument, onInstrument, step, playing }: Props) {
  const [mode, setMode] = useState<Mode>('easy');
  const [length, setLength] = useState(1);                 // one cell per click by default
  const [velocity, setVelocity] = useState(DEFAULT_VELOCITY);
  const [mood, setMood] = useState<PresetName>('happy');
  const rollRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const rows = useMemo(() => {
    if (mode === 'easy') return scaleRows(keyPc, scale).slice().reverse();
    return Array.from({ length: MAX_MIDI - MIN_MIDI + 1 }, (_, i) => MAX_MIDI - i);
  }, [mode, keyPc, scale]);

  // "midi:step" -> { first cell of a note?, velocity }
  const cells = useMemo(() => {
    const map = new Map<string, { start: boolean; v: number }>();
    notes.forEach(n => {
      const midi = noteToMidi(n.pitch);
      if (midi === null) return;
      for (let s = n.step; s < n.step + n.lengthSteps; s++) map.set(`${midi}:${s}`, { start: s === n.step, v: n.velocity });
    });
    return map;
  }, [notes]);

  const hidden = mode === 'easy' ? notes.filter(n => !rows.includes(noteToMidi(n.pitch) ?? -1)).length : 0;

  useEffect(() => {
    if (mode === 'advanced' && rollRef.current) rollRef.current.scrollTop = (MAX_MIDI - 76) * ADV_ROW_PX;
  }, [mode]);

  function changeMode(next: Mode) { setMode(next); if (next === 'easy' && length > 4) setLength(4); }
  function changeKey(next: number) { onNotes(prev => transposeNotes(prev, easyRoot(next) - easyRoot(keyPc))); onKeyChange(next); }
  function changeScale(next: ScaleName) { onNotes(prev => remapToScale(prev, keyPc, scale, next)); onScaleChange(next); }
  function loadMood(name: PresetName) {
    const preset = makePreset(name, keyPc);
    setMood(name);
    onScaleChange(preset.scale);
    onInstrument(preset.instrument);
    onNotes(preset.notes);
  }
  function auto() { onNotes(generateMelody(keyPc, scale, mood, Math.floor(Math.random() * 4294967296))); }

  // ---- velocity lane (one bar per step; edits every note that starts on that step)
  function laneSet(e: PointerEvent<HTMLDivElement>) {
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-step]') as HTMLElement | null;
    if (!cell) return;
    const s = Number(cell.dataset.step);
    const r = cell.getBoundingClientRect();
    const v = 1 - (e.clientY - r.top) / r.height;
    onNotes(prev => setStepVelocity(prev, s, v));
  }
  function laneKey(e: KeyboardEvent<HTMLDivElement>, s: number) {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
    if (!d) return;
    e.preventDefault();
    onNotes(prev => setStepVelocity(prev, s, (stepVelocity(prev, s) ?? DEFAULT_VELOCITY) + d));
  }

  const lengths = mode === 'easy' ? EASY_LENGTHS : ADV_LENGTHS;
  const advanced = mode === 'advanced';

  return <section className="panel melody">
    <div className="panel-label">MELODY <span>{advanced ? 'ADVANCED · PIANO ROLL C3–C6' : 'EASY · EVERY NOTE FITS THE KEY'}</span></div>
    <div className="melody-controls">
      <div className="seg" role="group" aria-label="Melody mode">
        <button aria-pressed={!advanced} className={!advanced ? 'sel' : ''} onClick={() => changeMode('easy')}>EASY</button>
        <button aria-pressed={advanced} className={advanced ? 'sel' : ''} onClick={() => changeMode('advanced')}>ADVANCED</button>
      </div>
      <label className="ctl">INSTRUMENT
        <select value={instrument} aria-label="Melody instrument" onChange={e => onInstrument(e.target.value as MelodyInstrumentId)}>
          {MELODY_INSTRUMENT_IDS.map(id => <option key={id} value={id}>{MELODY_INSTRUMENTS[id].label} — {MELODY_INSTRUMENTS[id].hint}</option>)}
        </select>
      </label>
      <div className="ctl">MOOD
        <div className="seg" role="group" aria-label="Moods">
          {PRESET_NAMES.map(p => <button key={p} aria-pressed={mood === p} className={mood === p ? 'sel' : ''} title={`Load the ${p} melody (also sets scale and instrument)`} onClick={() => loadMood(p)}>{PRESETS[p].label}</button>)}
        </div>
      </div>
      <button className="auto-btn" title="Generate a new random melody in the current key, scale and mood" onClick={auto}>✦ AUTO MELODY</button>
    </div>
    <div className="melody-controls second">
      <label className="ctl">KEY
        <select value={keyPc} aria-label="Key" onChange={e => changeKey(Number(e.target.value))}>
          {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
      </label>
      <label className="ctl">SCALE
        <select value={scale} aria-label="Scale" onChange={e => changeScale(e.target.value as ScaleName)}>
          {(Object.keys(SCALES) as ScaleName[]).map(s => <option key={s} value={s}>{SCALES[s].label}</option>)}
        </select>
      </label>
      <div className="ctl">NOTE LENGTH
        <div className="seg" role="group" aria-label="Note length">
          {lengths.map(([label, value]) =>
            <button key={label} aria-pressed={length === value} className={length === value ? 'sel' : ''} onClick={() => setLength(value)}>{label}</button>)}
        </div>
      </div>
      <label className="ctl">NEW NOTE VELOCITY
        <span className="fader"><input type="range" min={5} max={100} value={Math.round(velocity * 100)} aria-label="New note velocity" onChange={e => setVelocity(Number(e.target.value) / 100)} /><b>{Math.round(velocity * 100)}</b></span>
      </label>
      <button className="mute-btn" style={{ marginLeft: 'auto' }} aria-label={`Melody ${enabled ? 'on' : 'off'}`} aria-pressed={enabled}
        onClick={() => onEnabled(!enabled)}>{enabled ? 'ON' : 'OFF'}</button>
    </div>
    <div className={'roll-wrap ' + mode + (enabled ? '' : ' is-muted')} ref={rollRef}>
      <div className="roll">
        <div className="mrow mhead"><span />{Array.from({ length: 16 }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
        {rows.map(midi => {
          const name = midiToNote(midi);
          const black = name.includes('#');
          const inKey = inScale(midi, keyPc, scale);
          const isRoot = ((midi - keyPc) % 12 + 12) % 12 === 0;
          return <div key={midi} className={'mrow' + (black ? ' black' : '') + (inKey ? ' inkey' : '') + (isRoot ? ' root' : '')}>
            <span className="mlabel">{name}</span>
            {Array.from({ length: 16 }, (_, s) => {
              const cell = cells.get(`${midi}:${s}`);
              const cls = 'mcell' + (cell ? ' on' + (cell.start ? ' start' : '') : '') + (s % 4 === 0 ? ' beat' : '') +
                (playing && step === s ? ' current' : '') + (advanced && !inKey ? ' out' : '');
              return <button key={s} className={cls} style={cell ? { ['--v' as string]: cell.v } : undefined} aria-label={`${name} step ${s + 1}`} aria-pressed={!!cell}
                onClick={() => onNotes(prev => toggleNote(prev, midi, s, length, velocity))} />;
            })}
          </div>;
        })}
        <div className="mrow vel-lane" title="Drag up/down to set velocity (loudness) of the notes on each step"
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; laneSet(e); }}
          onPointerMove={e => { if (dragging.current) laneSet(e); }}
          onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
          <span className="mlabel">VELOCITY</span>
          {Array.from({ length: 16 }, (_, s) => {
            const v = stepVelocity(notes, s);
            return <div key={s} data-step={s} className={'vel-cell' + (v === undefined ? ' empty' : '') + (s % 4 === 0 ? ' beat' : '')} role="slider" tabIndex={v === undefined ? -1 : 0}
              aria-label={`Velocity step ${s + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((v ?? 0) * 100)} onKeyDown={e => laneKey(e, s)}>
              <div className="vel-bar" style={{ height: `${(v ?? 0) * 100}%` }} />
              {v !== undefined && <span className="vel-num">{Math.round(v * 100)}</span>}
            </div>;
          })}
        </div>
      </div>
    </div>
    <div className="grid-footer">
      <span>{advanced ? 'ALL NOTES · DIMMED ROWS ARE OUT OF KEY · CLICK A NOTE TO REMOVE IT · DRAG THE VELOCITY BARS' : 'ONE CLICK = ONE CELL · CHANGE KEY / SCALE / MOOD TO CHANGE THE MUSIC'}
        {hidden > 0 && ` · ${hidden} NOTE${hidden > 1 ? 'S' : ''} OUTSIDE THIS VIEW STILL PLAY`}</span>
      <button onClick={() => onNotes([])}>CLEAR MELODY ↗</button>
    </div>
  </section>;
}
