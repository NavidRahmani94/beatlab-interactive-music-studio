// FILE: The INSPECT mode. While it is on, a click on any part of the page shows which file and line of code it comes from, what it runs, and how that file connects to the others.
// It stops the click from reaching the page, so nothing is played or changed while you look around.
import { useEffect, useRef, useState } from 'react';
import graph from 'virtual:beatlab-graph';
import '../styles/inspect.css';
import { folderInfo, fullPath, fileName, labelOf, parseSrc, splitHandlers } from './inspectInfo';

type Step = { el: Element; file: string; line: number; label: string };
type View = { file: string; line: number | null; label: string; handlers: string[]; chain: Step[]; el: Element | null };

const UI = '[data-insp-ui], .insp-toggle';
const ancestors = (el: Element): Step[] => {
  const out: Step[] = [];
  for (let n: Element | null = el.closest('[data-src]'); n && out.length < 8; n = n.parentElement ? n.parentElement.closest('[data-src]') : null) {
    const s = parseSrc(n.getAttribute('data-src')); if (s) out.push({ el: n, file: s.file, line: s.line, label: labelOf(n) });
  }
  return out;
};
const viewOf = (el: Element): View | null => {
  const chain = ancestors(el); if (!chain.length) return null;
  const handlers: string[] = [];
  for (const s of chain.slice(0, 4)) for (const h of splitHandlers(s.el.getAttribute('data-on'))) if (!handlers.includes(h)) handlers.push(h);
  return { file: chain[0].file, line: chain[0].line, label: chain[0].label, handlers, chain, el: chain[0].el };
};

export default function Inspector({ onClose }: { onClose: () => void }) {
  const [hover, setHover] = useState<{ r: DOMRect; tag: string } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [copied, setCopied] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    document.body.classList.add('insp-on');
    const inUi = (t: EventTarget | null) => t instanceof Element && !!t.closest(UI);
    const move = (e: MouseEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        if (inUi(e.target) || !(e.target instanceof Element)) { setHover(null); return; }
        const n = e.target.closest('[data-src]'); const s = n && parseSrc(n.getAttribute('data-src'));
        setHover(n && s ? { r: n.getBoundingClientRect(), tag: s.file + ':' + s.line } : null);
      });
    };
    const block = (e: Event) => { if (inUi(e.target)) return; e.preventDefault(); e.stopPropagation(); };
    const click = (e: MouseEvent) => {
      if (inUi(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.target instanceof Element) { const v = viewOf(e.target); if (v) setView(v); }
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const stops = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'dblclick', 'contextmenu'];
    window.addEventListener('mousemove', move, true); window.addEventListener('click', click, true); window.addEventListener('keydown', key, true);
    stops.forEach(t => window.addEventListener(t, block, true));
    const gone = () => setHover(null);
    window.addEventListener('scroll', gone, true); window.addEventListener('resize', gone);
    return () => {
      document.body.classList.remove('insp-on'); if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener('mousemove', move, true); window.removeEventListener('click', click, true); window.removeEventListener('keydown', key, true);
      stops.forEach(t => window.removeEventListener(t, block, true));
      window.removeEventListener('scroll', gone, true); window.removeEventListener('resize', gone);
    };
  }, [onClose]);

  const node = view ? graph.files[view.file] : null;
  const sel = view?.el && view.el.isConnected ? view.el.getBoundingClientRect() : null;
  const copy = () => { if (!view) return; try { void navigator.clipboard.writeText(fullPath(view.file) + (view.line ? ':' + view.line : '')); setCopied(true); window.setTimeout(() => setCopied(false), 1200); } catch { /* clipboard not allowed */ } };
  const chip = (f: string) => <button key={f} className="insp-chip" title={fullPath(f)} onClick={() => setView({ file: f, line: null, label: fileName(f), handlers: [], chain: [], el: null })}>{f}</button>;

  return <>
    {hover && <div className={'insp-box' + (hover.r.top < 26 ? ' low' : '')} data-insp-ui style={{ left: hover.r.left, top: hover.r.top, width: hover.r.width, height: hover.r.height }}><span className="insp-tag">{hover.tag}</span></div>}
    {sel && <div className="insp-box sel" data-insp-ui style={{ left: sel.left, top: sel.top, width: sel.width, height: sel.height }} />}
    <div className="insp-panel" data-insp-ui role="dialog" aria-label="Inspect mode">
      <div className="insp-head"><b>INSPECT</b><span>{view ? view.label : 'click any part of the page'}</span><button className="insp-x" aria-label="Leave inspect mode" onClick={onClose}>ESC ✕</button></div>
      {!view && <div className="insp-hint">Nothing is played or changed while this is on. Click a button, a slider, a panel or any other part of the page and you will see the file and line of its code, what it runs, and which other files it is connected to.</div>}
      {view && <div className="insp-body">
        <div className="insp-sec"><h4>CODE</h4><div className="insp-row"><span className="insp-code">{fullPath(view.file)}{view.line ? ':' + view.line : ''}</span><button className="insp-chip" onClick={copy}>{copied ? 'copied' : 'copy'}</button></div>
          {node && <div className="insp-none">{node.lines} lines in this file</div>}</div>
        {node?.desc && <div className="insp-sec"><h4>WHAT THIS FILE DOES</h4>{node.desc}</div>}
        {folderInfo(view.file) && <div className="insp-sec"><h4>FOLDER</h4>{folderInfo(view.file)}</div>}
        {view.handlers.length > 0 && <div className="insp-sec"><h4>WHEN YOU USE IT, IT RUNS</h4>{view.handlers.map(h => <code key={h} className="insp-handler">{h}</code>)}<div className="insp-none">Look up the function name in the file above.</div></div>}
        {view.chain.length > 1 && <div className="insp-sec"><h4>WHERE IT SITS (INNER → OUTER)</h4><div className="insp-chips">{view.chain.map((s, i) => <button key={i} className="insp-chip" title={s.label} onClick={() => setView(viewOf(s.el))}>{s.file}:{s.line}</button>)}</div></div>}
        {node && <div className="insp-sec"><h4>THIS FILE USES</h4>{node.imports.length || node.libs.length ? <div className="insp-chips">{node.imports.map(chip)}{node.libs.map(l => <span key={l} className="insp-chip lib" title="library">{l}</span>)}</div> : <span className="insp-none">nothing else</span>}</div>}
        {node && <div className="insp-sec"><h4>USED BY</h4>{node.usedBy.length ? <div className="insp-chips">{node.usedBy.map(chip)}</div> : <span className="insp-none">no other file (it is the entry point or used from the page)</span>}</div>}
        {node && <div className="insp-sec"><h4>TESTS</h4>{node.tests.length ? <div className="insp-chips">{node.tests.map(chip)}</div> : <span className="insp-none">no test file for this one</span>}</div>}
      </div>}
    </div>
  </>;
}
