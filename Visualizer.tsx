import { useEffect, useRef } from 'react';

type Props = {
  playing: boolean;
  getSpectrum: () => Float32Array | null;
  getWaveform: () => Float32Array | null;
  step: number;       // 0..15, -1 when stopped
  bar: number;        // bar shown in the label
  bars: number;
};

/** Live picture of what is playing: frequency bars + waveform + a beat bar. Drawn straight onto a canvas (no React re-renders). */
export default function Visualizer({ playing, getSpectrum, getWaveform, step, bar, bars }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const smooth: number[] = [];
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const style = getComputedStyle(canvas);
      const accent = style.getPropertyValue('--viz-a').trim() || '#d9ff71';
      const accent2 = style.getPropertyValue('--viz-b').trim() || '#7cf0c2';
      const grid = style.getPropertyValue('--viz-grid').trim() || '#272b37';

      // beat bar: 16 small cells, current step lit
      const cellW = w / 16;
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = playing && stepRef.current === i ? accent : grid;
        ctx.globalAlpha = playing && stepRef.current === i ? 1 : i % 4 === 0 ? 0.9 : 0.5;
        ctx.fillRect(i * cellW + 2, h - 8, cellW - 4, 5);
      }
      ctx.globalAlpha = 1;

      const spec = playing ? getSpectrum() : null;
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
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing, getSpectrum, getWaveform]);

  return <section className="panel viz" aria-label="Playback visualiser">
    <div className="panel-label">VISUALISER <span>{playing ? `BAR ${bar + 1} / ${bars} · STEP ${step + 1}` : 'PRESS PLAY'}</span></div>
    <canvas ref={ref} className="viz-canvas" role="img" aria-label="Live spectrum and waveform" />
  </section>;
}
