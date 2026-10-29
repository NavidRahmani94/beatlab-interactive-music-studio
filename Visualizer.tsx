import { useEffect, useRef, useState } from 'react';
import { useInView } from './useInView';
import { BeatPulse, VIZ_LABEL, VIZ_MODES, VizMode, attackRelease, bandsOf, dbToUnit, isVizMode } from './vizMath';

const MODE_KEY = 'beatlab.viz.v1';
const loadMode = (): VizMode => { try { const v = localStorage.getItem(MODE_KEY); return isVizMode(v) ? v : 'bars'; } catch { return 'bars'; } };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

type Props = {
  playing: boolean;
  getSpectrum: () => Float32Array | null;
  getWaveform: () => Float32Array | null;
  lite?: boolean;     // LITE: fewer frames per second
  step: number;       // 0..31, -1 when stopped
  bar: number;        // slot shown in the label
  bars: number;
};

/** Live picture of what is playing: frequency bars + waveform + a beat bar. Drawn straight onto a canvas (no React re-renders). */
export default function Visualizer({ playing, getSpectrum, getWaveform, step, bar, bars, lite }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const seen = useInView(ref);
  const seenRef = useRef(seen); seenRef.current = seen;
  const liteRef = useRef(!!lite); liteRef.current = !!lite;
  const stepRef = useRef(step);
  stepRef.current = step;
  const [mode, setMode] = useState<VizMode>(loadMode);
  const modeRef = useRef(mode); modeRef.current = mode;
  const pick = (m: VizMode) => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* optional */ } };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const smooth: number[] = [];
    const beat = new BeatPulse(); const parts: Particle[] = []; let glow = 0; let t0 = performance.now(); let phase = 0;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = 0;
    const draw = (ts = 0) => {
      // not on screen: draw nothing. Otherwise about 30 frames a second (15 in LITE mode): half the cost, still smooth for a meter
      if (!seenRef.current || ts - last < (liteRef.current ? 60 : 30)) { raf = requestAnimationFrame(draw); return; }
      last = ts;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const style = getComputedStyle(canvas);
      const accent = style.getPropertyValue('--viz-a').trim() || '#d9ff71';
      const accent2 = style.getPropertyValue('--viz-b').trim() || '#7cf0c2';
      const grid = style.getPropertyValue('--viz-grid').trim() || '#272b37';

      const now = performance.now(); const dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
      const spec = playing ? getSpectrum() : null;
      const bands = bandsOf(spec);
      const pulse = playing ? beat.update(bands.bass, dt) : (beat.reset(), 0);
      glow = attackRelease(glow, bands.level, 0.02);
      phase += dt * (0.4 + bands.level * 1.6);
      const m = modeRef.current;
      const cx = w / 2, cy = (h - 12) / 2;
      const drawBeatBar = () => {
        const cellW = w / 32;
        for (let i = 0; i < 32; i++) {
          const on = playing && stepRef.current === i;
          ctx.fillStyle = on ? accent : grid; ctx.globalAlpha = on ? 1 : i % 4 === 0 ? 0.9 : 0.5;
          ctx.fillRect(i * cellW + 2, h - 8, cellW - 4, 5);
        }
        ctx.globalAlpha = 1;
      };
      drawBeatBar();
      if (m === 'bars') {
      const n = 48;
      const barW = w / n;
      for (let i = 0; i < n; i++) {
        let target = 0;
        if (spec && spec.length) {
          // logarithmic bin mapping so bass gets its own room
          const idx = Math.min(spec.length - 1, Math.floor(Math.pow(i / n, 1.7) * spec.length));
          const db = Number.isFinite(spec[idx]) ? spec[idx] : -100;
          target = Math.max(0, Math.min(1, (db + 90) / 70));
        }
        smooth[i] = Math.max(target, (smooth[i] ?? 0) - 0.03);
        const bh = Math.max(2, smooth[i] * (h - 24));
        const grad = ctx.createLinearGradient(0, h - 12 - bh, 0, h - 12);
        grad.addColorStop(0, accent); grad.addColorStop(1, accent2);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.35 + 0.65 * smooth[i];
        ctx.fillRect(i * barW + 1, h - 12 - bh, Math.max(1, barW - 2), bh);
      }
      ctx.globalAlpha = 1;

      const wave = playing ? getWaveform() : null;
      ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.beginPath();
      if (wave && wave.length) {
        for (let i = 0; i < wave.length; i++) {
          const x = (i / (wave.length - 1)) * w;
          const y = (h - 12) / 2 - (Number.isFinite(wave[i]) ? wave[i] : 0) * (h - 24) * 0.45;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else { ctx.moveTo(0, (h - 12) / 2); ctx.lineTo(w, (h - 12) / 2); }
      ctx.stroke();
      } else if (m === 'rings') {
        // rings: radius follows loudness, a new ring is born on every beat, the outline wobbles with the spectrum
        const R = Math.min(w, h) * 0.18;
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const rr = R * (1 + k * 0.55) * (1 + glow * 0.35 + pulse * 0.25 * (1 - k * 0.3));
          ctx.strokeStyle = k === 1 ? accent2 : accent; ctx.globalAlpha = (0.85 - k * 0.25) * (0.35 + glow);
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath();
        const N = 96;
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2 + phase * 0.3;
          const j = Math.min((spec?.length ?? 1) - 1, Math.floor(Math.pow((i % (N / 2)) / (N / 2), 1.7) * (spec?.length ?? 1)));
          const v = spec ? dbToUnit(spec[j]) : 0;
          const rr = R * 0.8 + v * R * 0.9;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = accent; ctx.globalAlpha = 0.15 + pulse * 0.6; ctx.beginPath(); ctx.arc(cx, cy, R * 0.45 * (1 + pulse * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      } else if (m === 'particles') {
        // particles: a burst on every beat (more with loud bass), treble makes them sparkle
        if (pulse === 1 && !calm) {
          const n = 6 + Math.round(bands.bass * 14);
          for (let i = 0; i < n && parts.length < 120; i++) {
            const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 160 * (0.4 + bands.bass);
            parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: Math.random() });
          }
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          const q = parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 40 * dt; q.life -= dt * (0.7 + bands.high);
          if (q.life <= 0) { parts.splice(i, 1); continue; }
          ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.hue > 0.5 ? accent : accent2;
          ctx.beginPath(); ctx.arc(q.x, q.y, 1.5 + q.life * (2 + bands.mid * 3), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.25 + glow * 0.6; ctx.fillStyle = accent2; ctx.beginPath(); ctx.arc(cx, cy, 6 + glow * 16 + pulse * 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      } else {
        // aurora: three soft waves; bass lifts them, mids speed them up, treble adds ripples
        const layers: [number, string, number][] = [[bands.bass, accent2, 0], [bands.mid, accent, 2.1], [bands.high, accent2, 4.2]];
        layers.forEach(([e, col, off], k) => {
          ctx.beginPath(); ctx.moveTo(0, h - 12);
          for (let x = 0; x <= w; x += 8) {
            const u = x / w;
            const y = cy + 18 - (Math.sin(u * 5 + phase + off) * 0.5 + 0.5) * (12 + e * (h * 0.5)) - Math.sin(u * 17 + phase * 2 + off) * bands.high * 8 - pulse * 10 - k * 6;
            ctx.lineTo(x, Math.min(h - 12, y));
          }
          ctx.lineTo(w, h - 12); ctx.closePath();
          ctx.globalAlpha = 0.18 + e * 0.3; ctx.fillStyle = col; ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing, getSpectrum, getWaveform]);

  return <section className="panel viz" aria-label="Playback visualiser">
    <div className="panel-label">VISUALISER <span>{playing ? `SLOT ${bar + 1} / ${bars} · STEP ${step + 1}` : 'PRESS PLAY'}</span>
      <span className="seg viz-modes" role="group" aria-label="Visual style">{VIZ_MODES.map(v => <button key={v} aria-pressed={mode === v} className={mode === v ? 'on' : ''} onClick={() => pick(v)}>{VIZ_LABEL[v]}</button>)}</span></div>
    <canvas ref={ref} className="viz-canvas" role="img" aria-label="Live spectrum and waveform" />
  </section>;
}
