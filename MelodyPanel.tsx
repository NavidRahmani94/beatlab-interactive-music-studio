import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_MIDI, MIN_MIDI, MelodyNote, NOTE_NAMES, PRESETS, PresetName, SCALES, ScaleName,
  easyRoot, inScale, makePreset, midiToNote, noteToMidi, scaleRows, snapNotesToScale, toggleNote, transposeNotes
} from './melody';

type Mode = 'easy' | 'advanced';
type Props = {
  notes: MelodyNote[];
  onNotes: (notes: MelodyNote[]) => void;
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  step: number;
  playing: boolean;
};

const EASY_LENGTHS: [string, number][] = [['SHORT', 1], ['MEDIUM', 2], ['LONG', 4]];
const ADV_LENGTHS: [string, number][] = [['1', 1], ['2', 2], ['4', 4], ['8', 8]];
const ADV_ROW_PX = 23; // 20px row + 3px gap

export default function MelodyPanel({ notes, onNotes, enabled, onEnabled, step, playing }: Props) {
  const [mode, setMode] = useState<Mode>('easy');
  const [keyPc, setKeyPc] = useState(0);
  const [scale, setScale] = useState<ScaleName>(PRESETS.happy.scale);
  const [length, setLength] = useState(2);
  const rollRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    if (mode === 'easy') return scaleRows(keyPc, scale).slice().reverse();
    return Array.from({ length: MAX_MIDI - MIN_MIDI + 1 }, (_, i) => MAX_MIDI - i);
  }, [mode, keyPc, scale]);

  // cell lookup: "midi:step" -> is this the first cell of a note?
  const cells = useMemo(() => {
    const map = new Map<string, boolean>();
    notes.forEach(n => {
      const midi = noteToMidi(n.pitch);
      if (midi === null) return;
      for (let s = n.step; s < n.step + n.lengthSteps; s++) map.set(`${midi}:${s}`, s === n.step);
    });
    return map;
  }, [notes]);

  const hidden = mode === 'easy' ? notes.filter(n => !rows.includes(noteToMidi(n.pitch) ?? -1)).length : 0;

  useEffect(() => {
    if (mode === 'advanced' && rollRef.current) rollRef.current.scrollTop = (MAX_MIDI - 76) * ADV_ROW_PX;
  }, [mode]);

  function changeMode(next: Mode) {
    setMode(next);
    if (next === 'easy' && length > 4) setLength(4);
  }
  function changeKey(next: number) {
    onNotes(transposeNotes(notes, easyRoot(next) - easyRoot(keyPc)));
    setKeyPc(next);
  }
  function changeScale(next: ScaleName) {
    onNotes(snapNotesToScale(notes, keyPc, next));
    setScale(next);
  }
  function loadPreset(name: PresetName) {
    const preset = makePreset(name, keyPc);
    setScale(preset.scale);
    onNotes(preset.notes);
  }

  const lengths = mode === 'easy' ? EASY_LENGTHS : ADV_LENGTHS;
  const advanced = mode === 'advanced';

  return <section className="panel melody">
    <div className="panel-label">MELODY <span>{advanced ? 'ADVANCED · PIANO ROLL C3–C6' : 'EASY · SCALE-LOCKED'}</span></div>
    <div className="melody-controls">
      <div className="seg" role="group" aria-label="Melody mode">
        <button aria-pressed={!advanced} className={!advanced ? 'sel' : ''} onClick={() => changeMode('easy')}>EASY</button>
        <button aria-pressed={advanced} className={advanced ? 'sel' : ''} onClick={() => changeMode('advanced')}>ADVANCED</button>
      </div>
      <label className="ctl">KEY
        <select value={keyPc} onChange={e => changeKey(Number(e.target.value))}>
          {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
      </label>
      <label className="ctl">SCALE
        <select value={scale} onChange={e => changeScale(e.target.value as ScaleName)}>
          {(Object.keys(SCALES) as ScaleName[]).map(s => <option key={s} value={s}>{SCALES[s].label}</option>)}
        </select>
      </label>
      <div className="seg" role="group" aria-label="Presets">
        {(Object.keys(PRESETS) as PresetName[]).map(p => <button key={p} onClick={() => loadPreset(p)}>{PRESETS[p].label}</button>)}
      </div>
      <div className="seg" role="group" aria-label="Note length">
        {lengths.map(([label, value]) =>
          <button key={label} aria-pressed={length === value} className={length === value ? 'sel' : ''} onClick={() => setLength(value)}>{label}</button>)}
      </div>
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
              const start = cells.get(`${midi}:${s}`);
              const on = start !== undefined;
              const cls = 'mcell' + (on ? ' on' + (start ? ' start' : '') : '') + (s % 4 === 0 ? ' beat' : '') +
                (playing && step === s ? ' current' : '') + (advanced && !inKey ? ' out' : '');
              return <button key={s} className={cls} aria-label={`${name} step ${s + 1}`} aria-pressed={on}
                onClick={() => onNotes(toggleNote(notes, midi, s, length))} />;
            })}
          </div>;
        })}
      </div>
    </div>
    <div className="grid-footer">
      <span>{advanced ? 'ALL NOTES AVAILABLE · DIMMED = OUT OF KEY · CLICK A NOTE TO REMOVE IT' : 'EVERY NOTE FITS THE KEY · CLICK CELLS TO ADD OR REMOVE'}
        {hidden > 0 && ` · ${hidden} NOTE${hidden > 1 ? 'S' : ''} OUTSIDE THIS VIEW STILL PLAY`}</span>
      <button onClick={() => onNotes([])}>CLEAR MELODY ↗</button>
    </div>
  </section>;
}
