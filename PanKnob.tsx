// FILE: A small round knob for the left / right position (pan) of a channel. It works with the mouse, touch and the keyboard.
import { PointerEvent, KeyboardEvent, useRef } from 'react';

type Props = { label: string; value: number; onChange: (pan: number) => void };
const clamp = (v: number) => Math.max(-1, Math.min(1, Math.round(v * 20) / 20));

/** A rotary pan knob: drag up/right for right, down/left for left, arrow keys for fine steps, double-click (or Home) to centre. */
export default function PanKnob({ label, value, onChange }: Props) {
  const drag = useRef<{ x: number; y: number; v: number } | null>(null);
  const angle = value * 135;
  const down = (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, v: value }; };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    onChange(clamp(d.v + ((e.clientX - d.x) + (d.y - e.clientY)) / 120));
  };
  const up = () => { drag.current = null; };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.25 : 0.05;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(clamp(value + step));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(clamp(value - step));
    else if (e.key === 'Home') onChange(0);
    else if (e.key === 'End') onChange(1);
    else return;
    e.preventDefault();
  };
  return <div className="pan-knob" role="slider" tabIndex={0} aria-label={label} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}
    aria-valuetext={Math.abs(value) < 0.02 ? 'center' : value < 0 ? `left ${Math.round(-value * 100)}` : `right ${Math.round(value * 100)}`}
    title="Drag to pan · double-click to centre" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={() => onChange(0)} onKeyDown={key}>
    <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
      <circle cx="20" cy="20" r="16" className="knob-body" />
      <g transform={`rotate(${angle} 20 20)`}><line x1="20" y1="20" x2="20" y2="7" className="knob-tick" /></g>
      <circle cx="20" cy="4" r="1.6" className="knob-mid" />
    </svg>
  </div>;
}
