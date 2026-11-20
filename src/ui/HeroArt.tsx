// A light decorative animation for the top of the page: mirrored equalizer bars, two drifting waves and rising notes.
// Pure CSS (only transform and opacity change), so it costs almost nothing. It follows the tempo, wakes up while the song plays,
// and stays still for people who asked their system for reduced motion.
const BARS = 36;
// fixed, hand-picked heights so the shape looks like music and never changes between renders
const HEIGHTS = [0.35, 0.55, 0.8, 0.6, 0.95, 0.5, 0.7, 0.4, 0.85, 0.65, 0.45, 0.9, 0.6, 0.75, 0.5, 0.35, 0.7, 0.9, 0.55, 0.8, 0.45, 0.65, 0.95, 0.5, 0.7, 0.4, 0.85, 0.6, 0.5, 0.8, 0.35, 0.7, 0.55, 0.9, 0.45, 0.6];
const NOTES = ['♪', '♫', '♩', '♬', '♪', '♫'];

import { useRef } from 'react';
import { useInView } from './useInView';

export default function HeroArt({ playing, bpm, lite }: { playing: boolean; bpm: number; lite?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  // still when off screen or in LITE mode: nothing is animated, nothing is repainted
  return <div ref={ref} className={'hero-art' + (playing ? ' live' : '') + (seen && !lite ? '' : ' still')} aria-hidden="true" style={{ ['--beat' as string]: `${60 / Math.max(40, bpm)}s` }}>
    <i className="orb o1" /><i className="orb o2" />
    <svg className="wave w1" viewBox="0 0 400 60" preserveAspectRatio="none"><path d="M0 30 Q 25 4 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30" /></svg>
    <svg className="wave w2" viewBox="0 0 400 60" preserveAspectRatio="none"><path d="M0 30 Q 25 56 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30" /></svg>
    <div className="eq">{Array.from({ length: BARS }, (_, i) => <span key={i} style={{ ['--h' as string]: HEIGHTS[i % HEIGHTS.length], ['--i' as string]: i }} />)}</div>
    {NOTES.map((n, i) => <b key={i} className="note" style={{ ['--n' as string]: i }}>{n}</b>)}
  </div>;
}
