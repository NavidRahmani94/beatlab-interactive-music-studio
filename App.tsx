import { useEffect, useRef, useState } from 'react';
import { BeatLabEngine } from './engine';
import { INSTRUMENTS, Instrument, clampBpm, makePattern, toggleStep } from './pattern';
import MelodyPanel from './MelodyPanel';
import { MelodyNote, makePreset } from './melody';
import './main.css';
const labels: Record<Instrument,string> = {kick:'KICK', snare:'SNARE', hat:'HI-HAT', clap:'CLAP'};
export default function App() {
  const [pattern, setPattern] = useState(makePattern);
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [melody, setMelody] = useState<MelodyNote[]>(() => makePreset('happy', 0).notes);
  const [melodyOn, setMelodyOn] = useState(true);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState<Record<Instrument, boolean>>({kick: false, snare: false, hat: false, clap: false});
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
  useEffect(() => { engine.current?.setMelody(melody); }, [melody]);
  useEffect(() => { engine.current?.setMelodyMuted(!melodyOn); }, [melodyOn]);
  useEffect(() => { INSTRUMENTS.forEach(n => engine.current?.setMuted(n, muted[n])); }, [muted]);
  async function play() {
    if (playing) return;
    setError('');
    try { await engine.current?.start(latestBpm.current); setPlaying(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Audio could not start.'); }
  }
  function stop() { engine.current?.stop(); setPlaying(false); setStep(-1); }
  return <main className="shell">
    <header><div><div className="eyebrow">INTERACTIVE MUSIC STUDIO</div><h1><span>BEAT</span>LAB<span className="dot">.</span></h1></div><div className="phase">PHASE 01–03 <span>• DRUMS + MELODY</span></div></header>
    <section className="intro"><div className="eyebrow">YOUR FIRST GROOVE</div><h2>Make some noise.</h2><p>Four drum voices. One melody. Sixteen steps. One synchronized clock.</p></section>
    <section className="panel transport"><div className="panel-label">TRANSPORT <span>01 / 04</span></div><div className="transport-controls"><button className={playing?'stop':'play'} onClick={playing ? stop : play}>{playing?'■ STOP':'▶ PLAY'}</button><div className="bpm"><label htmlFor="bpm">TEMPO <b>{bpm} <small>BPM</small></b></label><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={e=>setBpm(clampBpm(Number(e.target.value)))}/></div><div className="indicator"><span className={playing?'pulse on':'pulse'}/>{playing?'PLAYING':'STOPPED'}</div></div></section>
    <section className="panel sequencer"><div className="panel-label">DRUM MACHINE <span>16-STEP SEQUENCER</span></div><div className="grid-wrap"><div className="step-numbers"><span/> {Array.from({length:16},(_,i)=><span key={i}>{String(i+1).padStart(2,'0')}</span>)}</div>{INSTRUMENTS.map(name=><div className={'instrument-row'+(muted[name]?' is-muted':'')} key={name}><div className="instrument-name"><span className={'inst-dot '+name}/>{labels[name]}<button className={'mute-btn'+(muted[name]?' off':'')} aria-pressed={!muted[name]} aria-label={`${labels[name]} ${muted[name]?'off':'on'}`} title={muted[name]?'Turn on':'Turn off'} onClick={()=>setMuted(m=>({...m,[name]:!m[name]}))}>{muted[name]?'OFF':'ON'}</button></div>{pattern[name].map((on,i)=><button key={i} aria-label={`${name} step ${i+1}`} aria-pressed={on} className={`step ${on?'enabled '+name:''} ${playing&&step===i?'current':''} ${i%4===0?'beat':''}`} onClick={()=>setPattern(p=>toggleStep(p,name,i))}/>)}</div>)}</div><div className="grid-footer"><span>CLICK STEPS TO EDIT THE PATTERN</span><button onClick={()=>setPattern({kick:Array(16).fill(false),snare:Array(16).fill(false),hat:Array(16).fill(false),clap:Array(16).fill(false)})}>CLEAR ALL ↗</button></div></section>
    <MelodyPanel notes={melody} onNotes={setMelody} enabled={melodyOn} onEnabled={setMelodyOn} step={step} playing={playing}/>
    {error&&<div role="alert" className="error">{error}</div>}
    <footer><span>BEATLAB / V0.2</span><span>BUILT WITH REACT + TONE.JS</span><span>PHASE 3 OF 7 (UNVERIFIED)</span></footer>
  </main>;
}
