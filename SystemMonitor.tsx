// FILE: A small window that shows how well the page and the audio are running (audio clock, late steps, page speed, memory).
import { useEffect, useState } from 'react';
import * as Tone from 'tone';
import { ENGINE2_BLOCKED_BY_FILE, ENGINE2_ON, saveEngine2 } from './workletSynth';
import { AUDIO_MODES, audioLatencyMs, loadAudioMode, saveAudioMode } from './audioMode';

type Stats = {
  fps: number; lagAvg: number; lagMax: number;              // the web page itself: frames per second, and how late timers run
  clock: number | null;                                     // how fast the audio clock runs, in % of real time (average of about 8 s). Below about 90% the audio cannot keep up
  load: number | null; peak: number | null; underruns: number | null;   // the audio load that Chrome reports itself (not every browser has it)
  heapMb: number | null; heapLimitMb: number | null;        // JavaScript memory (Chrome / Edge only)
  late: number; steps: number;
};
const EMPTY: Stats = { fps: 0, lagAvg: 0, lagMax: 0, clock: null, load: null, peak: null, underruns: null, heapMb: null, heapLimitMb: null, late: 0, steps: 0 };

type RenderCapacity = { start(o?: { updateInterval?: number }): void; stop(): void; addEventListener(t: 'update', f: (e: Event & { averageLoad: number; peakLoad: number; underrunRatio: number }) => void): void; removeEventListener(t: 'update', f: (e: Event) => void): void };

/** Measures the page and the audio once per second, only while the monitor is open. It uses almost no CPU. */
function useStats(on: boolean, playing: boolean, getHealth: () => { late: number; maxLateMs: number; steps: number }): Stats {
  const [s, setS] = useState<Stats>(EMPTY);
  useEffect(() => {
    if (!on) return;
    let frames = 0, lagSum = 0, lagN = 0, lagMax = 0, raf = 0, last = performance.now();
    const countFrame = () => { frames++; raf = requestAnimationFrame(countFrame); };
    raf = requestAnimationFrame(countFrame);
    const lagTimer = window.setInterval(() => { const now = performance.now(); const lag = Math.max(0, now - last - 50); last = now; lagSum += lag; lagN++; lagMax = Math.max(lagMax, lag); }, 50);
    let ctx: BaseAudioContext | null = null; let rc: RenderCapacity | null = null; let rcState = { load: null as number | null, peak: null as number | null, under: null as number | null };
    try { ctx = Tone.getContext().rawContext as BaseAudioContext; } catch { ctx = null; }
    const onUpdate = (e: Event & { averageLoad: number; peakLoad: number; underrunRatio: number }) => { rcState = { load: e.averageLoad * 100, peak: e.peakLoad * 100, under: e.underrunRatio * 100 }; };
    try { rc = (ctx as unknown as { renderCapacity?: RenderCapacity }).renderCapacity ?? null; if (rc) { rc.addEventListener('update', onUpdate); rc.start({ updateInterval: 1 }); } } catch { rc = null; }
    let wallT = performance.now(); const win: { c: number; w: number }[] = [];   // the last readings of (audio time, real time), used for the clock value
    const timer = window.setInterval(() => {
      const nowWall = performance.now(); const dtWall = (nowWall - wallT) / 1000; wallT = nowWall;
      let clock: number | null = null;
      // The browser moves the audio clock in small jumps, so one 1-second reading can be a few % wrong. We use the last ~8 seconds instead. A real overload is still visible there.
      if (ctx && ctx.state === 'running') { win.push({ c: ctx.currentTime, w: nowWall }); if (win.length > 9) win.shift(); if (win.length >= 3) { const a = win[0]; const z = win[win.length - 1]; clock = z.w > a.w ? Math.min(100, ((z.c - a.c) / ((z.w - a.w) / 1000)) * 100) : null; } }
      else win.length = 0;
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      const h = getHealth();
      setS({ fps: Math.round(frames / dtWall), lagAvg: lagN ? lagSum / lagN : 0, lagMax, clock, load: rcState.load, peak: rcState.peak, underruns: rcState.under,
        heapMb: mem ? mem.usedJSHeapSize / 1048576 : null, heapLimitMb: mem ? mem.jsHeapSizeLimit / 1048576 : null, late: h.late, steps: h.steps });
      frames = 0; lagSum = 0; lagN = 0; lagMax = 0;
    }, 1000);
    return () => {
      cancelAnimationFrame(raf); clearInterval(lagTimer); clearInterval(timer);
      try { rc?.stop(); rc?.removeEventListener('update', onUpdate as (e: Event) => void); } catch { /* ignore */ }
    };
  }, [on, playing, getHealth]);
  return s;
}

const ACTIVE_MODE = loadAudioMode();   // the mode this page started with (a change is used after a reload)
const tone = (bad: boolean, warn: boolean) => bad ? 'bad' : warn ? 'warn' : 'good';

export default function SystemMonitor({ open, onClose, playing, getHealth }: { open: boolean; onClose: () => void; playing: boolean; getHealth: () => { late: number; maxLateMs: number; steps: number } }) {
  const s = useStats(open, playing, getHealth);
  const [mode, setMode] = useState(loadAudioMode);
  const [eng2, setEng2] = useState(ENGINE2_ON);
  if (!open) return null;
  const clockTone = s.clock === null ? 'na' : tone(s.clock < 90, s.clock < 97);
  const loadTone = s.load === null ? 'na' : tone(s.load > 85, s.load > 60);
  const fpsTone = !playing ? 'na' : tone(s.fps < 20, s.fps < 45);
  const lagTone = tone(s.lagMax > 120, s.lagMax > 50);
  const memTone = s.heapMb === null || s.heapLimitMb === null ? 'na' : tone(s.heapMb > s.heapLimitMb * 0.7, s.heapMb > s.heapLimitMb * 0.4);
  const lateTone = tone(s.late > 20, s.late > 0);
  const health = !playing ? { kind: 'na', text: 'idle (press PLAY)' }
    : (s.clock !== null && s.clock < 90) || s.late > 20 || (s.underruns ?? 0) > 1 || (s.load ?? 0) > 85 ? { kind: 'bad', text: 'STRAINED' }
    : (s.clock !== null && s.clock < 97) || s.late > 0 || s.lagMax > 100 || (s.underruns ?? 0) > 0 || (s.load ?? 0) > 60 ? { kind: 'warn', text: 'BORDERLINE' }
    : { kind: 'good', text: 'OK' };
  const Row = ({ label, value, kind, hint }: { label: string; value: string; kind: string; hint: string }) => <div className={'sys-row ' + kind} title={hint}><span>{label}</span><b>{value}</b></div>;
  return <aside className="sys-monitor" aria-label="System monitor" role="region">
    <div className="sys-head"><span>SYSTEM</span><button aria-label="Close system monitor" onClick={onClose}>✕</button></div>
    <Row label="AUDIO HEALTH" kind={health.kind} value={health.text} hint="Summary of AUDIO CLOCK, LATE STEPS and PAGE LAG. OK = the audio keeps up; STRAINED = crackling is likely." />
    {s.load !== null && <Row label="AUDIO LOAD" kind={loadTone} value={`${s.load.toFixed(0)}%  (peak ${s.peak?.toFixed(0)}%)`} hint="How busy the audio thread is (the browser's render-capacity report). Near 100% = crackling." />}
    <Row label="AUDIO CLOCK" kind={clockTone} value={s.clock === null ? (playing ? '…' : 'idle') : `${s.clock.toFixed(1)}%`} hint="The audio clock should run at 100% of real time. Lower = the audio thread cannot keep up (crackles)." />
    {s.underruns !== null && <Row label="AUDIO GLITCHES" kind={tone(s.underruns > 1, s.underruns > 0)} value={`${s.underruns.toFixed(1)}%`} hint="Share of audio blocks that were late (the browser's render-capacity report)." />}
    <Row label="LATE STEPS" kind={lateTone} value={`${s.late} / ${s.steps}`} hint="Steps of the song the scheduler started late since PLAY." />
    <Row label="PAGE SPEED" kind={fpsTone} value={playing ? `${s.fps} fps` : 'idle'} hint="Frames per second of the page (animation, visualiser)." />
    <Row label="PAGE LAG" kind={lagTone} value={`${s.lagAvg.toFixed(0)} ms (max ${s.lagMax.toFixed(0)})`} hint="How late timers fire = how busy the page's main thread is." />
    <Row label="MEMORY (JS)" kind={memTone} value={s.heapMb === null ? 'n/a' : `${s.heapMb.toFixed(0)} MB`} hint="JavaScript memory of this page (Chrome / Edge). Audio buffers and the browser's own memory are not included." />
    <Row label="AUDIO DELAY" kind="na" value={audioLatencyMs() === null ? 'n/a' : `${audioLatencyMs()} ms`} hint="The delay between a note and the sound (the browser's audio buffer plus the output device)." />
    <div className="sys-row na" title="FAST: smallest buffer (about 10 ms), best for playing a keyboard. SMOOTH: about 23 ms, fewer crackles. SAFE: 80 ms, the most protection when the computer is slow. A change is used after the page is reloaded.">
      <span>AUDIO BUFFER</span><b>{AUDIO_MODES.map(m => <button key={m} className={'sys-mode' + (mode === m ? ' on' : '')} aria-pressed={mode === m} onClick={() => { setMode(m); saveAudioMode(m); }}>{m.toUpperCase()}</button>)}</b>
    </div>
    <div className="sys-row na" title="ENGINE 2 plays the live sounds (tracks, keyboard, SHAPE LAB) inside an AudioWorklet: one audio node per sound instead of many per note, so chords use far less CPU. OLD = the original engine. The export (WAV/MP3) always uses the original engine for now. A change is used after the page is reloaded.">
      <span>SOUND ENGINE</span><b>{(['on', 'off'] as const).map(m => <button key={m} className={'sys-mode' + ((eng2 ? 'on' : 'off') === m ? ' on' : '')} aria-pressed={(eng2 ? 'on' : 'off') === m} onClick={() => { setEng2(m === 'on'); saveEngine2(m === 'on'); }}>{m === 'on' ? 'ENGINE 2' : 'OLD'}</button>)}</b>
    </div>
    {ENGINE2_BLOCKED_BY_FILE && <div className="sys-foot" role="status">ENGINE 2 needs the app to be opened from a web address (npm run dev, or a web host), not directly from the HTML file. Here the OLD engine is used.</div>}
    {eng2 !== ENGINE2_ON && <div className="sys-foot" role="status">Reload the page to use {eng2 ? 'ENGINE 2' : 'the OLD engine'}.</div>}
    {mode !== ACTIVE_MODE && <div className="sys-foot" role="status">Reload the page to use the {mode.toUpperCase()} buffer.</div>}
    <div className="sys-foot">Updates every second. {s.load === null ? 'Your browser does not report the audio thread\'s load directly (AUDIO LOAD / GLITCHES appear only where it does), so AUDIO CLOCK and AUDIO HEALTH are used instead. ' : ''}Real CPU % per core is not available to web pages.</div>
  </aside>;
}
