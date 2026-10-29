import { useEffect, useRef, useState } from 'react';
import { BeatLabEngine } from './engine';
import { INSTRUMENTS, Instrument, clampBpm, makePattern, toggleStep } from './pattern';
import './main.css';
const labels: Record<Instrument,string> = {kick:'KICK', snare:'SNARE', hat:'HI-HAT', clap:'CLAP'};
export default function App() {
  const [pattern, setPattern] = useState(makePattern);
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState('');
  const engine = useRef<BeatLabEngine | null>(null);
  const latestPattern = useRef(pattern);
  const latestBpm = useRef(bpm);
  latestPattern.current = pattern; latestBpm.current = bpm;
  useEffect(() => {
    const instance = new BeatLabEngine(latestPattern.current, setStep);
    engine.current = instance;
    return () => { instance.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { engine.current?.setPattern(pattern); }, [pattern]);
  useEffect(() => { engine.current?.setBpm(bpm); }, [bpm]);
  async function play() {
    if (playing) return;
    setError('');
    try { await engine.current?.start(latestBpm.current); setPlaying(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Audio could not start.'); }
  }
  function stop() { engine.current?.stop(); setPlaying(false); setStep(-1); }
  return <main className="shell">
    <header><div><div className="eyebrow">INTERACTIVE MUSIC STUDIO</div><h1><span>BEAT</span>LAB<span className="dot">.</span></h1></div><div className="phase">PHASE 01–02 <span>• ENGINE + DRUM GRID</span></div></header>
    <section className="intro"><div className="eyebrow">YOUR FIRST GROOVE</div><h2>Make some noise.</h2><p>Four drum voices. Sixteen steps. One synchronized clock.</p></section>
    <section className="panel transport"><div className="panel-label">TRANSPORT <span>01 / 04</span></div><div className="transport-controls"><button className={playing?'stop':'play'} onClick={playing ? stop : play}>{playing?'■ STOP':'▶ PLAY'}</button><div className="bpm"><label htmlFor="bpm">TEMPO <b>{bpm} <small>BPM</small></b></label><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={e=>setBpm(clampBpm(Number(e.target.value)))}/></div><div className="indicator"><span className={playing?'pulse on':'pulse'}/>{playing?'PLAYING':'STOPPED'}</div></div></section>
    <section className="panel sequencer"><div className="panel-label">DRUM MACHINE <span>16-STEP SEQUENCER</span></div><div className="grid-wrap"><div className="step-numbers"><span/> {Array.from({length:16},(_,i)=><span key={i}>{String(i+1).padStart(2,'0')}</span>)}</div>{INSTRUMENTS.map(name=><div className="instrument-row" key={name}><div className="instrument-name"><span className={'inst-dot '+name}/>{labels[name]}</div>{pattern[name].map((on,i)=><button key={i} aria-label={`${name} step ${i+1}`} aria-pressed={on} className={`step ${on?'enabled '+name:''} ${playing&&step===i?'current':''} ${i%4===0?'beat':''}`} onClick={()=>setPattern(p=>toggleStep(p,name,i))}/>)}</div>)}</div><div className="grid-footer"><span>CLICK STEPS TO EDIT THE PATTERN</span><button onClick={()=>setPattern({kick:Array(16).fill(false),snare:Array(16).fill(false),hat:Array(16).fill(false),clap:Array(16).fill(false)})}>CLEAR ALL ↗</button></div></section>
    {error&&<div role="alert" className="error">{error}</div>}
    <footer><span>BEATLAB / V0.1</span><span>BUILT WITH REACT + TONE.JS</span><span>PHASE 2 OF 7 (PREVIEW)</span></footer>
  </main>;
}
