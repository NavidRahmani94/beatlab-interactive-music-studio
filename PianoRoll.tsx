import { Dispatch, KeyboardEvent, PointerEvent, SetStateAction, useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_VELOCITY, MAX_MIDI, MIN_MIDI, MelodyNote, ScaleName, inScale, midiToNote, noteToMidi, noteAt, resizeNote, scaleRows, setStepVelocity, stepVelocity, toggleNote
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
  touchDraw: boolean;       // touch screens: true = dragging draws/stretches notes, false = dragging scrolls (a tap still adds/removes)
};

const ADV_ROW_PX = 23; // 20px row + 3px gap

type Drag =
  | { kind: 'tap'; midi: number; step: number }
  | { kind: 'create'; id: string; startStep: number; moved: boolean }
  | { kind: 'existing'; id: string; noteStep: number; startStep: number; moved: boolean };

/**
 * Piano roll. CLICK an empty cell = new note (default length). DRAG sideways from an empty cell = a note of any length.
 * DRAG sideways from a cell of an existing note = stretch / shrink it. CLICK an existing note = remove it.
 */
export default function PianoRoll({ notes, onNotes, advanced, keyPc, scale, defaultLength, velocity, enabled, playingStep, accent, touchDraw }: Props) {
  const rollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const laneDragging = useRef(false);
  useFollowPlayhead(rollRef, playingStep);

  const rows = useMemo(() => advanced
    ? Array.from({ length: MAX_MIDI - MIN_MIDI + 1 }, (_, i) => MAX_MIDI - i)
    : scaleRows(keyPc, scale).slice().reverse(), [advanced, keyPc, scale]);

  // "midi:step" -> { first / last cell of a note?, velocity }
  const cells = useMemo(() => {
    const map = new Map<string, { start: boolean; end: boolean; v: number }>();
    notes.forEach(n => {
      const midi = noteToMidi(n.pitch);
      if (midi === null) return;
      for (let s = n.step; s < n.step + n.lengthSteps; s++) map.set(`${midi}:${s}`, { start: s === n.step, end: s === n.step + n.lengthSteps - 1, v: n.velocity });
    });
    return map;
  }, [notes]);

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
  // keyboard / assistive technology: a click without pointer events toggles a note
  function keyClick(midi: number, step: number, detail: number) {
    if (detail !== 0) return;
    onNotes(prev => toggleNote(prev, midi, step, defaultLength, velocity));
  }

  // ---- velocity lane (one bar per step; edits every note that starts on that step)
  function laneSet(e: PointerEvent<HTMLDivElement>) {
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-vstep]') as HTMLElement | null;
    if (!cell) return;
    const s = Number(cell.dataset.vstep);
    const r = cell.getBoundingClientRect();
    onNotes(prev => setStepVelocity(prev, s, 1 - (e.clientY - r.top) / r.height));
  }
  function laneKey(e: KeyboardEvent<HTMLDivElement>, s: number) {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
    if (!d) return;
    e.preventDefault();
    onNotes(prev => setStepVelocity(prev, s, (stepVelocity(prev, s) ?? DEFAULT_VELOCITY) + d));
  }

  return <>
    <div className={'roll-wrap ' + (advanced ? 'advanced' : 'easy') + (enabled ? '' : ' is-muted')} ref={rollRef} style={{ ['--accent' as string]: accent }}>
      <div className={'roll' + (touchDraw ? ' draw' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
        <div className="mrow mhead"><span />{Array.from({ length: STEPS }, (_, i) => <span key={i} className={i === 16 ? 'bar2' : undefined}>{i + 1}</span>)}</div>
        {rows.map(midi => {
          const name = midiToNote(midi);
          const inKey = inScale(midi, keyPc, scale);
          const isRoot = ((midi - keyPc) % 12 + 12) % 12 === 0;
          return <div key={midi} className={'mrow' + (name.includes('#') ? ' black' : '') + (inKey ? ' inkey' : '') + (isRoot ? ' root' : '')}>
            <span className="mlabel">{name}</span>
            {Array.from({ length: STEPS }, (_, s) => {
              const cell = cells.get(`${midi}:${s}`);
              const cls = 'mcell' + (cell ? ' on' + (cell.start ? ' start' : '') + (cell.end ? ' end' : '') : '') + (s % 4 === 0 ? ' beat' : '') + (s === 16 ? ' bar2' : '') +
                (playingStep === s ? ' current' : '') + (advanced && !inKey ? ' out' : '');
              return <button key={s} data-midi={midi} data-step={s} className={cls} style={cell ? { ['--v' as string]: cell.v } : undefined}
                aria-label={`${name} step ${s + 1}`} aria-pressed={!!cell} onClick={e => keyClick(midi, s, e.detail)} />;
            })}
          </div>;
        })}
        <div className="mrow vel-lane" title="Drag up/down to set velocity (loudness) of the notes on each step"
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); laneDragging.current = true; laneSet(e); }}
          onPointerMove={e => { if (laneDragging.current) laneSet(e); }}
          onPointerUp={() => { laneDragging.current = false; }} onPointerCancel={() => { laneDragging.current = false; }}>
          <span className="mlabel">VELOCITY</span>
          {Array.from({ length: STEPS }, (_, s) => {
            const v = stepVelocity(notes, s);
            return <div key={s} data-vstep={s} className={'vel-cell' + (v === undefined ? ' empty' : '') + (s % 4 === 0 ? ' beat' : '')} role="slider" tabIndex={v === undefined ? -1 : 0}
              aria-label={`Velocity step ${s + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((v ?? 0) * 100)} onKeyDown={e => laneKey(e, s)}>
              <div className="vel-bar" style={{ height: `${(v ?? 0) * 100}%` }} />
              {v !== undefined && <span className="vel-num">{Math.round(v * 100)}</span>}
            </div>;
          })}
        </div>
      </div>
    </div>
    {hidden > 0 && <div className="roll-note">{hidden} NOTE{hidden > 1 ? 'S' : ''} OUTSIDE THIS VIEW STILL PLAY</div>}
  </>;
}
