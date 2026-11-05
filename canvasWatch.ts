// FILE: Keeps a canvas's size and its theme colours up to date WITHOUT reading layout or styles in every animation frame.
// Reading clientWidth / getComputedStyle inside requestAnimationFrame makes the browser lay out and restyle the page
// every frame. Here the size comes from a ResizeObserver and the colours are read again only when the theme changes.

export type CanvasWatch = {
  /** CSS width / height of the element in pixels (kept current by a ResizeObserver). */
  readonly w: number;
  readonly h: number;
  /** The value of a CSS variable listed in `vars`, or `fallback` when it is empty. */
  color: (name: string, fallback: string) => string;
  stop: () => void;
};

export function watchCanvas(el: HTMLElement, vars: string[]): CanvasWatch {
  let w = el.clientWidth, h = el.clientHeight;
  const colors = new Map<string, string>();
  const readColors = () => { const s = getComputedStyle(el); vars.forEach(v => colors.set(v, s.getPropertyValue(v).trim())); };
  readColors();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { w = el.clientWidth; h = el.clientHeight; }) : null;
  ro?.observe(el);
  // the theme is switched with <html data-theme="light|dark"> (theme.ts)
  const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(readColors) : null;
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  return {
    get w() { return ro ? w : el.clientWidth; },   // no ResizeObserver (very old browser): read it directly as before
    get h() { return ro ? h : el.clientHeight; },
    color: (name, fallback) => colors.get(name) || fallback,
    stop: () => { ro?.disconnect(); mo?.disconnect(); }
  };
}
