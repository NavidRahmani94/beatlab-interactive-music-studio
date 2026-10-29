import { RefObject, useEffect } from 'react';

/** While playing, scrolls a horizontally scrollable editor so the playing step stays in view. */
export function useFollowPlayhead(wrap: RefObject<HTMLElement>, step: number, labelWidth = 60): void {
  useEffect(() => {
    const el = wrap.current;
    if (!el || step < 0 || el.scrollWidth <= el.clientWidth + 2) return;
    const cell = el.querySelector(`[data-step="${step}"]`) as HTMLElement | null;
    if (!cell) return;
    const box = el.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    if (c.left < box.left + labelWidth || c.right > box.right - 4) {
      el.scrollTo({ left: Math.max(0, el.scrollLeft + (c.left - box.left) - labelWidth - 40), behavior: 'smooth' });
    }
  }, [wrap, step, labelWidth]);
}
