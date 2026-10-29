import { KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Section, sectionIndexAt } from './arrangement';
import { Playlist } from './song';
import { patternColor } from './PlaylistPanel';
import { STEPS } from './pattern';
import { formatTime, positionSteps, rulerMarks, secondsToStep, stepsToSeconds, tickEvery } from './timeline';

type Props = {
  mode: 'song' | 'pattern';
  playlist: Playlist;
  sections: Section[];
  current: number;             // pattern shown in pattern mode
  bpm: number;
  playing: boolean;
  startStep: number;           // where PLAY will begin / the playhead while stopped
  getPlayhead: () => { songStep: number; at: number } | null;   // last step reported by the player
  onSeek: (step: number) => void;
};
const SECTION_COLORS = ['#7cf0c2', '#9db4ff', '#ffb86b', '#ff8fb1', '#c8a1ff', '#89d7ff'];

/** The whole track as a time line in seconds: click or drag to jump, arrow keys to nudge. The playhead is moved on the DOM directly (no re-render per frame). */
export default function Timeline({ mode, playlist, sections, current, bpm, playing, startStep, getPlayhead, onSeek }: Props) {
  const total = mode === 'song' ? Math.max(1, playlist.length) * STEPS : STEPS;
  const totalSec = stepsToSeconds(total, bpm);
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(900);
  const dragging = useRef(false);
  const live = useRef({ total, bpm, playing, startStep, getPlayhead });
  live.current = { total, bpm, playing, startStep, getPlayhead };

  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => setWidth(el.clientWidth || 900)) : null;
    ro?.observe(el); setWidth(el.clientWidth || 900);
    return () => ro?.disconnect();
  }, []);

  // playhead + clock
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const L = live.current;
      let pos = L.startStep;
      if (L.playing) { const h = L.getPlayhead(); if (h) pos = positionSteps(h.songStep, performance.now() - h.at, L.bpm); }
      pos = Math.max(0, Math.min(L.total, pos));
      if (headRef.current) headRef.current.style.left = `${(pos / L.total) * 100}%`;
      if (timeRef.current) timeRef.current.textContent = formatTime(stepsToSeconds(pos, L.bpm), 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const every = tickEvery(totalSec, width);
  const marks = useMemo(() => rulerMarks(totalSec, every), [totalSec, every]);
  const slots = mode === 'song' ? playlist : [current];

  const seekFromX = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect(); if (!r || r.width <= 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onSeek(secondsToStep(frac * totalSec, bpm, total));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => { if (e.button !== 0) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekFromX(e.clientX); };
  const move = (e: PointerEvent<HTMLDivElement>) => { if (dragging.current) seekFromX(e.clientX); };
  const up = () => { dragging.current = false; };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const L = live.current;
    const here = L.playing ? Math.floor(positionSteps(L.getPlayhead()?.songStep ?? L.startStep, 0, L.bpm)) : L.startStep;
    const per = Math.max(1, Math.round(1 / (60 / L.bpm / 4)));          // one second in steps
    let to: number | null = null;
    if (e.key === 'ArrowRight') to = here + (e.shiftKey ? STEPS : per);
    else if (e.key === 'ArrowLeft') to = here - (e.shiftKey ? STEPS : per);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = L.total - 1;
    if (to === null) return;
    e.preventDefault(); onSeek(Math.max(0, Math.min(L.total - 1, to)));
  };

  return <div className="timeline" role="group" aria-label="Timeline">
    <div className="tl-head">
      <span className="tl-label">TIMELINE</span>
      <button className="tl-btn" aria-label="Back to the start" title="Back to the start (Home)" onClick={() => onSeek(0)}>⏮</button>
      <span className="tl-clock"><b ref={timeRef}>0:00.0</b> / {formatTime(totalSec)}</span>
      <span className="tl-hint">{mode === 'pattern' ? 'THIS PATTERN LOOPS' : 'CLICK OR DRAG TO JUMP · ← → = 1 SECOND · SHIFT = 1 SLOT'}</span>
    </div>
    <div className="tl-track" ref={trackRef} role="slider" tabIndex={0} aria-label="Song position" aria-valuemin={0} aria-valuemax={Math.round(totalSec)} aria-valuenow={Math.round(stepsToSeconds(startStep, bpm))}
      aria-valuetext={formatTime(stepsToSeconds(startStep, bpm))} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
      <div className="tl-ruler">{marks.map(t => <span key={t} className="tl-mark" style={{ left: `${(t / totalSec) * 100}%` }}><i />{formatTime(t)}</span>)}</div>
      {mode === 'song' && <div className="tl-sections">{sections.map((s, i) => s.start < slots.length && <span key={i} className="tl-section" style={{ left: `${(s.start / slots.length) * 100}%`, width: `${(Math.min(s.length, slots.length - s.start) / slots.length) * 100}%`, ['--sec' as string]: SECTION_COLORS[i % SECTION_COLORS.length] }}>{s.name}</span>)}</div>}
      <div className="tl-slots">{slots.map((p, i) => <span key={i} className={'tl-slot' + (p === null ? ' empty' : '') + (mode === 'song' && sectionIndexAt(sections, i) >= 0 ? ' in-sec' : '')} style={p === null ? undefined : { ['--c' as string]: patternColor(p) }} />)}</div>
      <div className="tl-head-line" ref={headRef} />
    </div>
  </div>;
}
