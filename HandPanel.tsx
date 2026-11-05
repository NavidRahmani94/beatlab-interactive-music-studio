// FILE: The AIR CONTROL panel: camera switch, camera picture, the instructions and the on / off boxes for each hand gesture.
// The gesture logic is in handControl.ts and handGestures.ts, the camera and the hand model in handTracker.ts.
import { useEffect, useRef, useState } from 'react';
import { ALL_FEATURES, HAND_FEATURES, HandAction, HandController, HandFeature, HandStatus } from './handControl';
import { HAND_LINES, HandTracker, loadHandTracker, openCamera } from './handTracker';
import type { LM } from './handGestures';

type Props = {
  onAction: (a: HandAction) => void;
  airNotes: number[];            // notes the AIR PIANO can play (the key + scale of the open track), low → high
};

const KEY = 'beatlab.hand.features';
function loadFeatures(): HandFeature[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (Array.isArray(v)) return ALL_FEATURES.filter(f => v.includes(f)); } catch { /* no storage */ }
  return ALL_FEATURES;
}
const IDLE: HandStatus = { gesture: 'none', label: '—', hint: '', progress: 0, hands: 0 };

function describe(a: HandAction): string {
  switch (a.type) {
    case 'play': return '▶ PLAY'; case 'stop': return '■ STOP';
    case 'tempo': return a.delta > 0 ? '⏩ tempo +1' : '⏪ tempo −1';
    case 'volume': return `🔊 master volume ${a.db} dB`; case 'tone': return `✨ brightness ${a.db > 0 ? '+' : ''}${a.db} dB`;
    case 'reverb': return `🌫 reverb ${Math.round(a.mix * 100)}%`; case 'pattern': return a.delta > 0 ? '➡ next pattern' : '⬅ previous pattern';
    case 'mute': return '🔇 mute / unmute'; case 'airOn': return `🎹 note ${a.midi}`; case 'airOff': return '';
  }
}

export default function HandPanel({ onAction, airNotes }: Props) {
  const [on, setOn] = useState(false);
  const [features, setFeatures] = useState<HandFeature[]>(loadFeatures);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [st, setSt] = useState<HandStatus>(IDLE);
  const [last, setLast] = useState('');
  const [fps, setFps] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctl = useRef(new HandController(features));
  const actionRef = useRef(onAction); actionRef.current = onAction;

  useEffect(() => { ctl.current.setEnabled(features); try { localStorage.setItem(KEY, JSON.stringify(features)); } catch { /* ignore */ } }, [features]);
  useEffect(() => { ctl.current.setAirNotes(airNotes); }, [airNotes]);

  useEffect(() => {
    if (!on) return;
    let dead = false; let stream: MediaStream | null = null; let tracker: HandTracker | null = null; let timer = 0;
    setError(''); setReady(false); setSt(IDLE); setText('Starting the camera…');
    (async () => {
      try {
        stream = await openCamera(); if (dead) { stream.getTracks().forEach(t => t.stop()); return; }
        const v = video.current; if (!v) return; v.srcObject = stream; await v.play().catch(() => undefined);
        tracker = await loadHandTracker(setText); if (dead) { tracker.close(); return; }
        setReady(true); setText('');
        let frames = 0; let since = performance.now(); let lastUi = 0;
        const loop = () => {
          if (dead) return;
          const now = performance.now();
          if (!document.hidden && video.current) {
            const hands: LM[][] | null = tracker!.detect(video.current, now);
            if (hands) {
              frames++;
              const { actions, status } = ctl.current.update(now, hands);
              actions.forEach(a => { actionRef.current(a); const d = describe(a); if (d) setLast(d); });
              draw(canvas.current, hands);
              if (now - lastUi > 80 || actions.length) { lastUi = now; setSt(status); }
            }
            if (now - since >= 1000) { setFps(Math.round((frames * 1000) / (now - since))); frames = 0; since = now; }
          }
          timer = window.setTimeout(loop, 33);
        };
        loop();
      } catch (e) { if (!dead) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setText(''); setOn(false); } }
    })();
    return () => {
      dead = true; window.clearTimeout(timer);
      ctl.current.reset().forEach(a => actionRef.current(a));
      tracker?.close(); stream?.getTracks().forEach(t => t.stop());
      if (video.current) video.current.srcObject = null;
      setReady(false); setSt(IDLE);
    };
  }, [on]);

  const toggleFeature = (f: HandFeature) => setFeatures(list => (list.includes(f) ? list.filter(x => x !== f) : [...list, f]));

  return <section className="panel hand" aria-label="Air control">
    <div className="panel-label">AIR CONTROL <span>CONTROL BEATLAB WITH YOUR HANDS · CAMERA · BETA</span></div>
    <div className="hand-top">
      <button className={'hand-switch' + (on ? ' on' : '')} role="switch" aria-checked={on} onClick={() => setOn(o => !o)}>
        <span className="knob" />{on ? 'CAMERA ON — CLICK TO TURN OFF' : 'TURN ON THE CAMERA'}
      </button>
      <span className="hand-privacy">The camera picture stays on this computer: it is analysed in the browser and never sent or saved.</span>
    </div>
    {error && <div className="hand-error" role="alert">{error}</div>}
    <div className={'hand-body' + (on ? ' live' : '')}>
      {on && <div className="hand-cam">
        <div className="hand-video">
          <video ref={video} muted playsInline aria-label="Camera preview (mirrored)" />
          <canvas ref={canvas} width={640} height={480} aria-hidden="true" />
          {!ready && <div className="hand-loading" role="status">{text || 'Starting…'}</div>}
        </div>
        <div className="hand-status" role="status" aria-live="off">
          <div className="hand-gesture"><b>{st.hands === 0 ? 'NO HAND' : st.label}</b><span>{ready ? `${st.hands} hand${st.hands === 1 ? '' : 's'} · ${fps} fps` : ''}</span></div>
          <div className="hand-bar"><i style={{ width: `${Math.round(st.progress * 100)}%` }} /></div>
          <div className="hand-hint">{st.hint || (ready ? 'Show a hand.' : '')}</div>
          <div className="hand-last">LAST ACTION: <b>{last || '—'}</b></div>
        </div>
      </div>}
      <div className="hand-help">
        <div className="hand-help-title">HOW TO USE {on ? '' : '(turn the camera on to try it)'}</div>
        <ul className="hand-list">
          {HAND_FEATURES.map(f => <li key={f.id} className={features.includes(f.id) ? '' : 'off'}>
            <label className="hand-check"><input type="checkbox" checked={features.includes(f.id)} aria-label={`${f.title} on`} onChange={() => toggleFeature(f.id)} /></label>
            <span className="hand-icon" aria-hidden="true">{f.icon}</span>
            <div><b>{f.title}</b><p>{f.how}</p></div>
          </li>)}
        </ul>
        <div className="hand-tips"><b>TIPS</b> Sit 40–80 cm from the camera with good light in front of you (not behind). Keep the whole hand inside the picture, palm towards the camera. The picture is a mirror: your right hand is on the right. Gestures need to be held for about half a second, so that the music does not stop by accident. Untick a function if you do not want it.</div>
      </div>
    </div>
  </section>;
}

function draw(c: HTMLCanvasElement | null, hands: LM[][]) {
  const g = c?.getContext('2d'); if (!c || !g) return;
  g.clearRect(0, 0, c.width, c.height);
  g.lineWidth = 3; g.strokeStyle = 'rgba(210,245,70,.95)'; g.fillStyle = '#fff';
  hands.forEach(h => {
    HAND_LINES.forEach(([a, b]) => { g.beginPath(); g.moveTo(h[a].x * c.width, h[a].y * c.height); g.lineTo(h[b].x * c.width, h[b].y * c.height); g.stroke(); });
    h.forEach(p => { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 4, 0, Math.PI * 2); g.fill(); });
  });
}
