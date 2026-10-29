import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BeatLabEngine } from './engine';
import { INSTRUMENTS, Instrument, clampBpm, toggleStep } from './pattern';
import MelodyPanel from './MelodyPanel';
import MixerPanel from './MixerPanel';
import ProjectBar from './ProjectBar';
import { MelodyNote, ScaleName } from './melody';
import { CHANNEL_LABELS, ChannelName, Channels, ChannelSettings, MasterSettings, patchChannel, patchMaster } from './mixer';
import { DRUM_KITS, DRUM_KIT_IDS, DrumKitId, MelodyInstrumentId } from './instruments';
import { BeatLabProject, MAX_FILE_BYTES, SAMPLE_PROJECTS, defaultProject, emptyDrums, hasAudibleContent, parseProject, safeFileName, serializeProject } from './project';
import { renderProjectToWav } from './exporter';
import './main.css';

type Status = { kind: 'info' | 'error'; text: string };

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function App() {
  const initial = useMemo(defaultProject, []);
  const [name, setName] = useState(initial.name);
  const [pattern, setPattern] = useState(initial.drums);
  const [bpm, setBpm] = useState(initial.bpm);
  const [melody, setMelody] = useState<MelodyNote[]>(initial.melody);
  const [channels, setChannels] = useState<Channels>(initial.channels);
  const [master, setMaster] = useState<MasterSettings>(initial.master);
  const [instrument, setInstrument] = useState<MelodyInstrumentId>(initial.melodyInstrument);
  const [kit, setKit] = useState<DrumKitId>(initial.drumKit);
  const [keyPc, setKeyPc] = useState(initial.melodyView.key);
  const [scale, setScale] = useState<ScaleName>(initial.melodyView.scale);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [status, setStatus] = useState<Status>({ kind: 'info', text: 'Press PLAY (or Space) to start. Everything you change is heard live.' });
  const [loops, setLoops] = useState(4);
  const [exporting, setExporting] = useState(false);
  const [savedJson, setSavedJson] = useState(() => serializeProject(initial));

  const project: BeatLabProject = useMemo(() => ({
    schemaVersion: 1, name, bpm, stepsPerBar: 16, bars: 1, drums: pattern, melody, channels, master, melodyInstrument: instrument, drumKit: kit, melodyView: { key: keyPc, scale }
  }), [name, bpm, pattern, melody, channels, master, instrument, kit, keyPc, scale]);
  const dirty = useMemo(() => serializeProject(project) !== savedJson, [project, savedJson]);

  const engine = useRef<BeatLabEngine | null>(null);
  const latest = useRef({ pattern, bpm, playing });
  latest.current = { pattern, bpm, playing };

  useEffect(() => {
    const instance = new BeatLabEngine(latest.current.pattern, setStep);
    engine.current = instance;
    return () => { instance.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { engine.current?.setPattern(pattern); }, [pattern]);
  useEffect(() => { engine.current?.setBpm(bpm); }, [bpm]);
  useEffect(() => { engine.current?.setMelody(melody); }, [melody]);
  useEffect(() => { engine.current?.setChannels(channels); }, [channels]);
  useEffect(() => { engine.current?.setMaster(master); }, [master]);
  useEffect(() => { engine.current?.setMelodyInstrument(instrument); }, [instrument]);
  useEffect(() => { engine.current?.setDrumKit(kit); }, [kit]);
  const getLevelDb = useCallback(() => engine.current?.getLevelDb() ?? -Infinity, []);

  // warn before closing the tab with unsaved work
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  async function play() {
    if (latest.current.playing) return;
    try { await engine.current?.start(latest.current.bpm); setPlaying(true); setStatus({ kind: 'info', text: 'Playing.' }); }
    catch (e) { setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Audio could not start.' }); }
  }
  function stop() { engine.current?.stop(); setPlaying(false); setStep(-1); setStatus(s => s.kind === 'error' ? s : { kind: 'info', text: 'Stopped.' }); }

  const toggleRef = useRef<() => void>(() => {});
  toggleRef.current = () => { if (latest.current.playing) stop(); else void play(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(tag)) { e.preventDefault(); toggleRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function apply(p: BeatLabProject) {
    setName(p.name); setBpm(p.bpm); setPattern(p.drums); setMelody(p.melody); setChannels(p.channels);
    setMaster(p.master); setInstrument(p.melodyInstrument); setKit(p.drumKit);
    setKeyPc(p.melodyView.key); setScale(p.melodyView.scale);
    setSavedJson(serializeProject(p));
  }
  function confirmDiscard(): boolean { return !dirty || window.confirm('You have unsaved changes. Discard them?'); }

  function newProject() {
    if (!confirmDiscard()) return;
    apply(defaultProject());
    setStatus({ kind: 'info', text: 'New project created.' });
  }
  function loadSample(sample: string) {
    if (!confirmDiscard()) return;
    apply(SAMPLE_PROJECTS[sample]());
    setStatus({ kind: 'info', text: `Loaded sample “${sample}”.` });
  }
  function save() {
    download(new Blob([serializeProject(project)], { type: 'application/json' }), `${safeFileName(name)}.beatlab.json`);
    setSavedJson(serializeProject(project));
    setStatus({ kind: 'info', text: `Saved ${safeFileName(name)}.beatlab.json` });
  }
  async function openFile(file: File) {
    if (file.size > MAX_FILE_BYTES) { setStatus({ kind: 'error', text: 'That file is too large to be a BeatLab project. Your current project was not changed.' }); return; }
    let text: string;
    try { text = await file.text(); } catch { setStatus({ kind: 'error', text: 'The file could not be read. Your current project was not changed.' }); return; }
    const result = parseProject(text);
    if (!result.ok) { setStatus({ kind: 'error', text: `Could not open “${file.name}”: ${result.error} Your current project was not changed.` }); return; }
    if (!confirmDiscard()) return;
    apply(result.project);
    setStatus({ kind: 'info', text: `Opened “${file.name}”.` });
  }
  async function exportWav() {
    if (!hasAudibleContent(project)) { setStatus({ kind: 'error', text: 'Nothing to export: add some drum steps or melody notes (and un-mute their channels) first.' }); return; }
    if (latest.current.playing) stop();
    setExporting(true);
    setStatus({ kind: 'info', text: 'Rendering audio…' });
    try {
      const result = await renderProjectToWav(project, loops);
      download(result.blob, `${safeFileName(name)}.wav`);
      setStatus({ kind: 'info', text: `Exported ${safeFileName(name)}.wav — ${result.loops} loop${result.loops > 1 ? 's' : ''}, ${result.seconds.toFixed(1)} s, ${Math.round(result.blob.size / 1024)} KB, 44.1 kHz stereo 16-bit.` });
    } catch (e) {
      setStatus({ kind: 'error', text: `Export failed: ${e instanceof Error ? e.message : 'unknown error'}` });
    } finally { setExporting(false); }
  }

  const changeChannel = (n: ChannelName, patch: Partial<ChannelSettings>) => setChannels(c => patchChannel(c, n, patch));
  const changeMaster = (patch: Partial<MasterSettings>) => setMaster(m => patchMaster(m, patch));
  const labels: Record<Instrument, string> = CHANNEL_LABELS as Record<Instrument, string>;

  return <main className="shell">
    <header><div><div className="eyebrow">INTERACTIVE MUSIC STUDIO</div><h1><span>BEAT</span>LAB<span className="dot">.</span></h1></div><div className="phase">PHASE 01–07 <span>• V0.5 TEST BUILD</span></div></header>
    <section className="intro"><div className="eyebrow">YOUR FIRST GROOVE</div><h2>Make some noise.</h2><p>Drums. Melody. Mixer. Save it. Export it.</p></section>
    <ProjectBar name={name} onName={setName} dirty={dirty} exporting={exporting} loops={loops} onLoops={setLoops}
      onNew={newProject} onOpenFile={openFile} onSave={save} onSample={loadSample} onExport={exportWav} />
    <section className="panel transport"><div className="panel-label">TRANSPORT <span>SPACE = PLAY / STOP</span></div><div className="transport-controls"><button className={playing ? 'stop' : 'play'} onClick={playing ? stop : play}>{playing ? '■ STOP' : '▶ PLAY'}</button><div className="bpm"><label htmlFor="bpm">TEMPO <b>{bpm} <small>BPM</small></b></label><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={e => setBpm(clampBpm(Number(e.target.value)))} /></div><div className="indicator"><span className={playing ? 'pulse on' : 'pulse'} />{playing ? 'PLAYING' : 'STOPPED'}</div></div></section>
    <section className="panel sequencer"><div className="panel-label">DRUM MACHINE <span>16-STEP SEQUENCER</span></div><div className="melody-controls"><label className="ctl">DRUM KIT<select value={kit} aria-label="Drum kit" onChange={e => setKit(e.target.value as DrumKitId)}>{DRUM_KIT_IDS.map(k => <option key={k} value={k}>{DRUM_KITS[k].label}</option>)}</select></label></div><div className="grid-wrap"><div className="step-numbers"><span /> {Array.from({ length: 16 }, (_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div>{INSTRUMENTS.map(inst => { const muted = channels[inst].muted; return <div className={'instrument-row' + (muted ? ' is-muted' : '')} key={inst}><div className="instrument-name"><span className={'inst-dot ' + inst} />{labels[inst]}<button className={'mute-btn' + (muted ? ' off' : '')} aria-pressed={!muted} aria-label={`${labels[inst]} ${muted ? 'off' : 'on'}`} title={muted ? 'Turn on' : 'Turn off'} onClick={() => changeChannel(inst, { muted: !muted })}>{muted ? 'OFF' : 'ON'}</button></div>{pattern[inst].map((on, i) => <button key={i} aria-label={`${inst} step ${i + 1}`} aria-pressed={on} className={`step ${on ? 'enabled ' + inst : ''} ${playing && step === i ? 'current' : ''} ${i % 4 === 0 ? 'beat' : ''}`} onClick={() => setPattern(p => toggleStep(p, inst, i))} />)}</div>; })}</div><div className="grid-footer"><span>CLICK STEPS TO EDIT THE PATTERN</span><button onClick={() => setPattern(emptyDrums())}>CLEAR ALL ↗</button></div></section>
    <MelodyPanel notes={melody} onNotes={setMelody} enabled={!channels.melody.muted} onEnabled={on => changeChannel('melody', { muted: !on })}
      keyPc={keyPc} scale={scale} onKeyChange={setKeyPc} onScaleChange={setScale} instrument={instrument} onInstrument={setInstrument} step={step} playing={playing} />
    <MixerPanel channels={channels} master={master} onChannel={changeChannel} onMaster={changeMaster} getLevelDb={getLevelDb} playing={playing} />
    <div role={status.kind === 'error' ? 'alert' : 'status'} className={'status ' + status.kind}>{status.text}</div>
    <footer><span>BEATLAB / V0.5 TEST BUILD</span><span>BUILT WITH REACT + TONE.JS</span><span>PHASES 1–7 · AUDIO UNVERIFIED BY EAR</span></footer>
  </main>;
}
