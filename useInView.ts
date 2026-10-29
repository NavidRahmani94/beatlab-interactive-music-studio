import { RefObject, useEffect, useState } from 'react';

/** True while the element is on screen (and the tab is visible). Off-screen decoration is paused so it costs nothing. */
export function useInView(ref: RefObject<Element>): boolean {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => setSeen(entries.some(e => e.isIntersecting)), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

const LITE_KEY = 'beatlab.lite.v1';
export function loadLite(): boolean { try { return localStorage.getItem(LITE_KEY) === '1'; } catch { return false; } }
export function saveLite(on: boolean): void { try { localStorage.setItem(LITE_KEY, on ? '1' : '0'); } catch { /* optional */ } }
