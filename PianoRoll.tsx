import { Dispatch, KeyboardEvent, PointerEvent, SetStateAction, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_MIDI, MIN_MIDI, MelodyNote, ScaleName, inScale, midiToNote, noteToMidi, noteAt, notesAtStep, resizeNote, scaleRows, setNoteVelocity, setStepVelocity, toggleNote
} from './melody';
import { STEPS } from './pattern';
import { useFollowPlayhead } from './useFollow';

type Props = {
  notes: MelodyNote[];
  onNotes: Dispatch<SetStateAction<MelodyNote[]>>;
  advanced: boolean;
  keyPc: number;
  scale: ScaleName;
  defaultLength: number;    // length of a note made with a plain click
  velocity: number;         // velocity of new notes
  enabled: boolean;
  playingStep: number;      // -1 when this pattern is not being played right now
  accent: string;           // CSS colour of this track
  onPreview?: (midi: number, down: boolean) => void; // press / release a note name to hear it
  cursor?: number;          // step-entry position (highlighted column), -1 = none
  touchDraw: boolean;       // touch screens: true = dragging draws/stretches notes, false = dragging scrolls (a tap still adds/removes)
};

const ADV_ROW_PX = 23; // 20px row + 3px gap

type Drag =
  | { kind: 'tap'; midi: number; step: number }
  | { kind: 'create'; id: string; startStep: number; moved: boolean }
  | { kind: 'existing'; id: string; noteStep: number; startStep: number; moved: boolean };

type CellInfo = { start: boolean; end: boolean; v: number };
type RowProps = {
  midi: number; name: string; inKey: boolean; isRoot: boolean; advanced: boolean; cursor: number; sig: string; row: (CellInfo | undefined)[];
  onPreview?: (midi: number, down: boolean) => void; onKey: (midi: number, step: number, detail: number) => void;
};
/** One row of the roll. Memoised on what it shows (the signature of its cells), so changing pattern or note only redraws the rows that really changed. */
const Row = memo(function Row({ midi, name, inKey, isRoot, advanced, cursor, row, onPreview, onKey }: RowProps) {
  return <div className={'mrow' + (name.includes('#') ? ' black' : '') + (inKey ? ' inkey' : '') + (isRoot ? ' root' : '')}>
    <span className={'mlabel' + (onPreview ? ' key' : '')} role={onPreview ? 'button' : undefined} aria-label={onPreview ? `Hear ${name}` : undefined} title={onPreview ? `Click to hear ${name}` : undefined}
      onPointerDown={onPreview ? e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); onPreview(midi, true); } : undefined}
      onPointerUp={onPreview ? () => onPreview(midi, false) : undefined} onPointerCancel={onPreview ? () => onPreview(midi, false) : undefined}>{name}</span>
    {row.map((cell, s) => {
      const cls = 'mcell' + (cell ? ' on' + (cell.start ? ' start' : '') + (cell.end ? ' end' : '') : '') + (s % 4 === 0 ? ' beat' : '') + (s === 16 ? ' bar2' : '') +
        (s === cursor ? ' stepcur' : '') + (advanced && !inKey ? ' out' : '');
      return <button key={s} data-midi={midi} data-step={s} className={cls} style={cell ? { ['--v' as string]: cell.v } : undefined}
        aria-label={`${name} step ${s + 1}`} aria-pressed={!!cell} onClick={e => onKey(midi, s, e.detail)} />;
    })}
  </div>;
}, (a, b) => a.sig === b.sig && a.cursor === b.cursor && a.advanced === b.advanced && a.inKey === b.inKey && a.isRoot === b.isRoot && a.midi === b.midi && a.onPreview === b.onPreview && a.onKey === b.onKey);

/**
 * Piano roll. CLICK an empty cell = new note (default length). DRAG sideways from an empty cell = a note of any length.
 * DRAG sideways from a cell of an existing note = stretch / shrink it. CLICK an existing note = remove it.
 */
export default function PianoRoll({ notes, onNotes, advanced, keyPc, scale, defaultLength, velocity, enabled, playingStep, accent, touchDraw, onPreview, cursor = -1 }: Props) {
  const rollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const laneDragging = useRef(false);
  useFollowPlayhead(rollRef, playingStep);
  // The playhead is moved on the DOM directly: re-rendering ~2000 cells every sixteenth note was the main cause of small hiccups
  useEffect(() => {
    const el = rollRef.current; if (!el) return;
    el.querySelectorAll('.mcell.current').forEach(c => c.classList.remove('current'));
    if (playingStep >= 0) el.querySelectorAll(`.mcell[data-step="${playingStep}"]`).forEach(c => c.classList.add('current'));
  });
  const previewRef = useRef(onPreview); previewRef.current = onPreview;
  const stablePreview = useMemo(() => (onPreview ? (m: number, d: boolean) => previewRef.current?.(m, d) : undefined), [!!onPreview]); // eslint-disable-line react-hooks/exhaustive-deps
  const notesRef = useRef(onNotes); notesRef.current = onNotes; const defRef = useRef({ defaultLength, velocity }); defRef.current = { defaultLength, velocity };
  const onKey = useCallback((midi: number, step: number, detail: number) => {
    if (detail !== 0) return;
    notesRef.current(prev => toggleNote(prev, midi, step, defRef.current.defaultLength, defRef.current.velocity));
  }, []);

  const rows = useMemo(() => advanced
    ? Array.from({ length: MAX_MIDI - MIN_MIDI + 1 }, (_, i) => MAX_MIDI - i)
    : scaleRows(keyPc, scale).slice().reverse(), [advanced, keyPc, scale]);

  // per row: the 32 cells and a short signature of them (so unchanged rows are not redrawn)
  const rowData = useMemo(() => {
    const map = new Map<number, { row: (CellInfo | undefined)[]; sig: string }>();
    notes.forEach(n => {
      const midi = noteToMidi(n.pitch);
      if (midi === null) return;
      let r = map.get(midi); if (!r) { r = { row: Array(STEPS).fill(undefined), sig: '' }; map.set(midi, r); }
      for (let s = n.step; s < n.step + n.lengthSteps && s < STEPS; s++) r.row[s] = { start: s === n.step, end: s === n.step + n.lengthSteps - 1, v: n.velocity };
    });
    map.forEach(r => { r.sig = r.row.map(c => (c ? `${c.start ? 1 : 0}${c.end ? 1 : 0}${c.v.toFixed(2)}` : '-')).join(','); });
    return map;
  }, [notes]);
  const emptyRow = useMemo<(CellInfo | undefined)[]>(() => Array(STEPS).fill(undefined), []);

  const hidden = advanced ? 0 : notes.filter(n => !rows.includes(noteToMidi(n.pitch) ?? -1)).length;

  useEffect(() => {
    if (advanced && rollRef.current) rollRef.current.scrollTop = (MAX_MIDI - 76) * ADV_ROW_PX;
  }, [advanced]);

  const cellAt = (x: number, y: number): { midi: number; step: number } | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-midi]') as HTMLElement | null;
    if (!el) return null;
    return { midi: Number(el.dataset.midi), step: Number(el.dataset.step) };
  };
  const stepAtX = (x: number): number | null => {
    // use the cells of any row to find the step under the pointer even when the pointer left the row vertically
    const first = rollRef.current?.querySelector('[data-midi]') as HTMLElement | null;
    if (!first) return null;
    const rowCells = Array.from(first.parentElement?.querySelectorAll('[data-step]') ?? []) as HTMLElement[];
    if (!rowCells.length) return null;
    let best = 0;
    rowCells.forEach((c, i) => { const r = c.getBoundingClientRect(); if (x >= r.left) best = i; });
    return best;
  };

  function down(e: PointerEvent<HTMLDivElement>) {
    const cell = (e.target as HTMLElement).closest('[data-midi]') as HTMLElement | null;
    if (!cell || e.button !== 0) return;
    const midi = Number(cell.dataset.midi);
    const step = Number(cell.dataset.step);
    if (e.pointerType === 'touch') { // a finger may be scrolling: decide on release (tap) or after a sideways drag (draw mode)
      drag.current = { kind: 'tap', midi, step };
      if (touchDraw) e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const existing = noteAt(notes, midi, step);
    if (existing) {
      drag.current = { kind: 'existing', id: existing.id, noteStep: existing.step, startStep: step, moved: false };
    } else {
      drag.current = { kind: 'create', id: `n${midi}_${step}`, startStep: step, moved: false };
      onNotes(prev => toggleNote(prev, midi, step, defaultLength, velocity));
    }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    let d = drag.current;
    if (!d) return;
    const hit = cellAt(e.clientX, e.clientY);
    const step = hit ? hit.step : stepAtX(e.clientX);
    if (d.kind === 'tap') {
      if (!touchDraw || step === null || step === d.step) return;
      const { midi, step: s0 } = d;
      const existing = noteAt(notes, midi, s0);
      if (existing) d = drag.current = { kind: 'existing', id: existing.id, noteStep: existing.step, startStep: s0, moved: false };
      else { d = drag.current = { kind: 'create', id: `n${midi}_${s0}`, startStep: s0, moved: false }; onNotes(prev => toggleNote(prev, midi, s0, defaultLength, velocity)); }
    }
    if (step === null || step === d.startStep && !d.moved) return;
    d.moved = true;
    const from = d.kind === 'create' ? d.startStep : d.noteStep;
    const length = Math.max(1, Math.min(STEPS - from, step - from + 1));
    onNotes(prev => resizeNote(prev, d.id, length));
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (d && d.kind === 'tap') { onNotes(prev => toggleNote(prev, d.midi, d.step, defaultLength, velocity)); return; }
    if (d && d.kind === 'existing' && !d.moved) onNotes(prev => prev.filter(n => n.id !== d.id)); // plain click removes
  }
  // ---- velocity lane: one bar per NOTE (the notes of a chord side by side, lowest on the left); drag a bar to change only that note, hold Shift to change the whole step
  const laneDrag = useRef<{ id: string; step: number } | null>(null);
  const [velInfo, setVelInfo] = useState('');
  const barAt = (clientX: number, clientY: number): { id: string; step: number; v: number; label: string } | null => {
    const cell = (document.elementFromPoint(clientX, clientY) as HTMLElement | null)?.closest('[data-vstep]') as HTMLElement | null
      ?? (laneDrag.current ? (rollRef.current?.querySelector(`[data-vstep="${laneDrag.current.step}"]`) as HTMLElement | null) : null);
    if (!cell) return null;
    const step = Number(cell.dataset.vstep);
    const r = cell.getBoundingClientRect();
    const list = notesAtStep(notes, step);
    if (!list.length) return null;
    const idx = Math.max(0, Math.min(list.length - 1, Math.floor(((clientX - r.left) / Math.max(1, r.width)) * list.length)));
    return { id: list[idx].id, step, v: 1 - (clientY - r.top) / r.height, label: list[idx].pitch };
  };
  function laneSet(e: PointerEvent<HTMLDivElement>, first: boolean) {
    const hit = barAt(e.clientX, e.clientY);
    if (first) laneDrag.current = hit ? { id: hit.id, step: hit.step } : null;
    const drag = laneDrag.current;
    if (!drag) return;
    const cell = rollRef.current?.querySelector(`[data-vstep="${drag.step}"]`) as HTMLElement | null;
    if (!cell) return;
    const r = cell.getBoundingClientRect();
    const v = 1 - (e.clientY - r.top) / r.height;
    if (e.shiftKey) onNotes(prev => setStepVelocity(prev, drag.step, v));
    else onNotes(prev => setNoteVelocity(prev, drag.id, v));
    const name = notes.find(n => n.id === drag.id)?.pitch ?? '';
    setVelInfo(`${e.shiftKey ? 'STEP ' + (drag.step + 1) + ' (ALL NOTES)' : name} · ${Math.round(Math.max(0.05, Math.min(1, v)) * 100)}`);
  }
  function laneKey(e: KeyboardEvent<HTMLDivElement>, id: string, v: number) {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
    if (!d) return;
    e.preventDefault();
    onNotes(prev => setNoteVelocity(prev, id, v + d));
  }

  return <>
    <div className={'roll-wrap ' + (advanced ? 'advanced' : 'easy') + (enabled ? '' : ' is-muted')} ref={rollRef} style={{ ['--accent' as string]: accent }}>
      <div className={'roll' + (touchDraw ? ' draw' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
        <div className="mrow mhead"><span />{Array.from({ length: STEPS }, (_, i) => <span key={i} className={(i === 16 ? 'bar2' : '') + (i === cursor ? ' stepcur' : '')}>{i + 1}</span>)}</div>
        {rows.map(midi => {
          const d = rowData.get(midi);
          return <Row key={midi} midi={midi} name={midiToNote(midi)} inKey={inScale(midi, keyPc, scale)} isRoot={((midi - keyPc) % 12 + 12) % 12 === 0} advanced={advanced} cursor={cursor}
            sig={d ? d.sig : ''} row={d ? d.row : emptyRow} onPreview={stablePreview} onKey={onKey} />;
        })}
        <div className="mrow vel-lane" title="Drag a bar up/down to set the velocity (loudness) of that note. The notes of a chord are side by side. Shift = the whole step."
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); laneDragging.current = true; laneSet(e, true); }}
          onPointerMove={e => { if (laneDragging.current) laneSet(e, false); }}
          onPointerUp={() => { laneDragging.current = false; laneDrag.current = null; }} onPointerCancel={() => { laneDragging.current = false; laneDrag.current = null; }}>
          <span className="mlabel">VELOCITY{velInfo && <small className="vel-readout">{velInfo}</small>}</span>
          {Array.from({ length: STEPS }, (_, s) => {
            const list = notesAtStep(notes, s);
            return <div key={s} data-vstep={s} className={'vel-cell' + (list.length === 0 ? ' empty' : '') + (list.length > 1 ? ' chord' : '') + (s % 4 === 0 ? ' beat' : '')}>
              {list.map(n => <div key={n.id} className="vel-note" role="slider" tabIndex={0} title={`${n.pitch} · ${Math.round(n.velocity * 100)}`} aria-label={`Velocity ${n.pitch} step ${s + 1}`}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(n.velocity * 100)} onKeyDown={e => laneKey(e, n.id, n.velocity)}>
                <div className="vel-bar" style={{ height: `${n.velocity * 100}%` }} />
                {list.length === 1 && <span className="vel-num">{Math.round(n.velocity * 100)}</span>}
              </div>)}
            </div>;
          })}
        </div>
      </div>
    </div>
    {hidden > 0 && <div className="roll-note">{hidden} NOTE{hidden > 1 ? 'S' : ''} OUTSIDE THIS VIEW STILL PLAY</div>}
  </>;
}
