import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BeatLabEngine } from './engine';
import { Instrument, clampBpm, toggleStep } from './pattern';
import DrumPanel from './DrumPanel';
import MixerPanel from './MixerPanel';
import PlaylistPanel from './PlaylistPanel';
import ProjectBar from './ProjectBar';
import TrackPanel from './TrackPanel';
import Visualizer from './Visualizer';
import { MelodyNote, ScaleName, easyRoot, remapToScale, transposeNotes } from './melody';
import { ChannelName, Channels, ChannelSettings, MasterSettings, patchChannel, patchMaster } from './mixer';
import { DrumKitId, MELODIC_TRACKS, MelodicTrack, MelodyInstrumentId, TAB_LABELS, TAB_ORDER, TabId } from './instruments';
import { ArpSettings } from './arp';
import { Frame, PatternData, PlayMode, Playlist, addPattern, deletePattern, duplicatePattern, emptyDrumPattern, renamePattern, resizePlaylist, setSlot } from './song';
import { BeatLabProject, MAX_FILE_BYTES, SAMPLE_PROJECTS, TrackInstruments, defaultProject, hasAudibleContent, parseProject, safeFileName, serializeProject } from './project';
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

const mapNotes = (patterns: PatternData[], fn: (notes: MelodyNote[]) => MelodyNote[]): PatternData[] =>
  patterns.map(p => ({ ...p, melody: fn(p.melody), ambient: fn(p.ambient), arp: fn(p.arp) }));

export default function App() {
  const initial = useMemo(defaultProject, []);
  const [name, setName] = useState(initial.name);
  const [bpm, setBpm] = useState(initial.bpm);
  const [patterns, setPatterns] = useState<PatternData[]>(initial.patterns);
  const [playlist, setPlaylist] = useState<Playlist>(initial.playlist);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<PlayMode>('pattern');
  const [tab, setTab] = useState<TabId>('melody');
  const [tracks, setTracks] = useState<TrackInstruments>(initial.tracks);
  const [arp, setArp] = useState<ArpSettings>(initial.arp);
  const [kit, setKit] = useState<DrumKitId>(initial.drumKit);
  const [keyPc, setKeyPc] = useState(initial.melodyView.key);
  const [scale, setScale] = useState<ScaleName>(initial.melodyView.scale);
  const [channels, setChannels] = useState<Channels>(initial.channels);
  const [master, setMaster] = useState<MasterSettings>(initial.master);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'info', text: 'Press PLAY (or Space) to start. Everything you change is heard live.' });
  const [loops, setLoops] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [savedJson, setSavedJson] = useState(() => serializeProject(initial));

  const cur = Math.min(current, patterns.length - 1);
  const pattern = patterns[cur];

  const project: BeatLabProject = useMemo(() => ({
    schemaVersion: 2, name, bpm, patterns, playlist, tracks, arp, drumKit: kit, melodyView: { key: keyPc, scale }, channels, master
  }), [name, bpm, patterns, playlist, tracks, arp, kit, keyPc, scale, channels, master]);
  const dirty = useMemo(() => serializeProject(project) !== savedJson, [project, savedJson]);

  const engine = useRef<BeatLabEngine | null>(null);
  const latest = useRef({ bpm, playing, song: { patterns, playlist, mode, current: cur } });
  latest.current = { bpm, playing, song: { patterns, playlist, mode, current: cur } };

  useEffect(() => {
    const instance = new BeatLabEngine(latest.current.song, setFrame);
    engine.current = instance;
    return () => { instance.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { engine.current?.setSong({ patterns, playlist, mode, current: cur }); }, [patterns, playlist, mode, cur]);
  useEffect(() => { engine.current?.setBpm(bpm); }, [bpm]);
  useEffect(() => { engine.current?.setArp(arp); }, [arp]);
  useEffect(() => { engine.current?.setChannels(channels); }, [channels]);
  useEffect(() => { engine.current?.setMaster(master); }, [master]);
  useEffect(() => { MELODIC_TRACKS.forEach(t => engine.current?.setTrackInstrument(t, tracks[t])); }, [tracks]);
  useEffect(() => { engine.current?.setDrumKit(kit); }, [kit]);
  const getLevelDb = useCallback(() => engine.current?.getLevelDb() ?? -Infinity, []);
  const getSpectrum = useCallback(() => engine.current?.getSpectrum() ?? null, []);
  const getWaveform = useCallback(() => engine.current?.getWaveform() ?? null, []);

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
  function stop() { engine.current?.stop(); setPlaying(false); setFrame(null); setStatus(s => s.kind === 'error' ? s : { kind: 'info', text: 'Stopped.' }); }

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
    setName(p.name); setBpm(p.bpm); setPatterns(p.patterns); setPlaylist(p.playlist); setCurrent(0); setTracks(p.tracks); setArp(p.arp);
    setChannels(p.channels); setMaster(p.master); setKit(p.drumKit); setKeyPc(p.melodyView.key); setScale(p.melodyView.scale);
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
    if (!hasAudibleContent(project)) { setStatus({ kind: 'error', text: 'Nothing to export: add some drum steps or notes (and un-mute their channels) first.' }); return; }
    if (latest.current.playing) stop();
    setExporting(true);
    setStatus({ kind: 'info', text: 'Rendering audio…' });
    try {
      const result = await renderProjectToWav(project, loops, { mode, pattern: cur });
      download(result.blob, `${safeFileName(name)}.wav`);
      setStatus({ kind: 'info', text: `Exported ${safeFileName(name)}.wav — ${mode === 'song' ? 'song' : 'pattern'}, ${result.bars} bar${result.bars > 1 ? 's' : ''}, ${result.seconds.toFixed(1)} s, ${Math.round(result.blob.size / 1024)} KB, 44.1 kHz stereo 16-bit.` });
    } catch (e) {
      setStatus({ kind: 'error', text: `Export failed: ${e instanceof Error ? e.message : 'unknown error'}` });
    } finally { setExporting(false); }
  }

  // ---- editing the selected pattern
  const editCurrent = (fn: (p: PatternData) => PatternData) => setPatterns(ps => ps.map((p, i) => i === Math.min(current, ps.length - 1) ? fn(p) : p));
  const setTrackNotes = (track: MelodicTrack) => (action: MelodyNote[] | ((prev: MelodyNote[]) => MelodyNote[])) =>
    setPatterns(ps => ps.map((p, i) => i === Math.min(current, ps.length - 1) ? { ...p, [track]: typeof action === 'function' ? action(p[track]) : action } : p));
  const trackSetters = { melody: setTrackNotes('melody'), ambient: setTrackNotes('ambient'), arp: setTrackNotes('arp') };

  // key and scale are shared by all tracks and all patterns, so changing them moves the whole song together
  const changeKey = (next: number) => { setPatterns(ps => mapNotes(ps, n => transposeNotes(n, easyRoot(next) - easyRoot(keyPc)))); setKeyPc(next); };
  const changeScale = (next: ScaleName) => { setPatterns(ps => mapNotes(ps, n => remapToScale(n, keyPc, scale, next))); setScale(next); };

  const changeChannel = (n: ChannelName, patch: Partial<ChannelSettings>) => setChannels(c => patchChannel(c, n, patch));
  const changeMaster = (patch: Partial<MasterSettings>) => setMaster(m => patchMaster(m, patch));

  // ---- patterns & playlist
  function newPattern() {
    const next = addPattern(patterns);
    if (next === patterns) return;
    setPatterns(next); setCurrent(next.length - 1);
  }
  function duplicate() {
    const next = duplicatePattern(patterns, cur);
    if (next === patterns) return;
    setPatterns(next); setCurrent(next.length - 1);
  }
  function remove() {
    if (patterns.length <= 1) return;
    if (!window.confirm(`Delete “${pattern.name}”? Bars that use it become empty.`)) return;
    const r = deletePattern(patterns, playlist, cur);
    setPatterns(r.patterns); setPlaylist(r.playlist); setCurrent(Math.max(0, Math.min(cur, r.patterns.length - 1)));
  }
  const paint = (bar: number) => setPlaylist(pl => setSlot(pl, bar, pl[bar] === cur ? null : cur));

  const playFrame = playing ? frame : null;
  const stepHere = playFrame && playFrame.pattern === cur ? playFrame.step : -1;
  const hasNotes = (t: TabId) => t === 'drums' ? Object.values(pattern.drums).some(r => r.some(Boolean)) : pattern[t].length > 0;
  const mutedTab = (t: TabId) => t === 'drums' ? (['kick', 'snare', 'hat', 'clap'] as const).every(i => channels[i].muted) : channels[t].muted;
  const bars = mode === 'song' ? playlist.length : 1;

  return <main className="shell" style={{ ['--bar-s' as string]: `${240 / bpm}s` }}>
    <header><div><div className="eyebrow">INTERACTIVE MUSIC STUDIO</div><h1><span>BEAT</span>LAB<span className="dot">.</span></h1></div><div className="phase">PHASE 01–09 <span>• V0.6 TEST BUILD</span></div></header>
    <section className="intro"><div className="eyebrow">YOUR FIRST SONG</div><h2>Make some noise.</h2><p>Ambient. Drums. Melody. Arpeggio. Mix. Master. Arrange. Export.</p></section>
    <ProjectBar name={name} onName={setName} dirty={dirty} exporting={exporting} loops={loops} unit={mode === 'song' ? 'song' : 'bar'} onLoops={setLoops}
      onNew={newProject} onOpenFile={openFile} onSave={save} onSample={loadSample} onExport={exportWav} />
    <section className="panel transport"><div className="panel-label">TRANSPORT <span>SPACE = PLAY / STOP</span></div><div className="transport-controls"><button className={playing ? 'stop' : 'play'} onClick={playing ? stop : play}>{playing ? '■ STOP' : '▶ PLAY'}</button><div className="bpm"><label htmlFor="bpm">TEMPO <b>{bpm} <small>BPM</small></b></label><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={e => setBpm(clampBpm(Number(e.target.value)))} /></div><div className="indicator"><span className={playing ? 'pulse on' : 'pulse'} />{playing ? 'PLAYING' : 'STOPPED'}</div></div></section>
    <Visualizer playing={playing} getSpectrum={getSpectrum} getWaveform={getWaveform} step={playFrame?.step ?? -1} bar={playFrame?.bar ?? 0} bars={bars} />

    <div className="tabs" role="tablist" aria-label="Tracks">
      {TAB_ORDER.map(t => <button key={t} role="tab" aria-selected={tab === t} className={'tab' + (tab === t ? ' sel' : '') + (mutedTab(t) ? ' muted' : '')} onClick={() => setTab(t)}>
        <i className={'tab-dot' + (hasNotes(t) ? ' has' : '')} data-track={t} />{TAB_LABELS[t]}
      </button>)}
      <span className="tab-pattern">EDITING <b>{pattern.name}</b></span>
    </div>

    {tab === 'drums' && <DrumPanel pattern={pattern.drums} kit={kit} channels={channels} playingStep={stepHere} onKit={setKit}
      onToggle={(inst: Instrument, i: number) => editCurrent(p => ({ ...p, drums: toggleStep(p.drums, inst, i) }))}
      onMute={(inst, muted) => changeChannel(inst, { muted })} onClear={() => editCurrent(p => ({ ...p, drums: emptyDrumPattern() }))} />}
    {tab !== 'drums' && <TrackPanel key={tab} track={tab} notes={pattern[tab]} onNotes={trackSetters[tab]} enabled={!channels[tab].muted}
      onEnabled={on => changeChannel(tab, { muted: !on })} keyPc={keyPc} scale={scale} onKeyChange={changeKey} onScaleChange={changeScale}
      instrument={tracks[tab]} onInstrument={(id: MelodyInstrumentId) => setTracks(t => ({ ...t, [tab]: id }))}
      arp={arp} onArp={patch => setArp(a => ({ ...a, ...patch }))} playingStep={stepHere} />}

    <PlaylistPanel patterns={patterns} playlist={playlist} current={cur} mode={mode} playing={playing} playBar={playFrame?.bar ?? -1} playPattern={playFrame?.pattern ?? null}
      onSelect={setCurrent} onNew={newPattern} onDuplicate={duplicate} onDelete={remove} onRename={n => setPatterns(ps => renamePattern(ps, cur, n))}
      onSlot={paint} onBars={n => setPlaylist(pl => resizePlaylist(pl, n))} onClearBars={() => setPlaylist(pl => pl.map(() => null))} onMode={setMode} />
    <MixerPanel channels={channels} master={master} onChannel={changeChannel} onMaster={changeMaster} getLevelDb={getLevelDb} playing={playing} />
    <div role={status.kind === 'error' ? 'alert' : 'status'} className={'status ' + status.kind}>{status.text}</div>
    <footer><span>BEATLAB / V0.6 TEST BUILD</span><span>BUILT WITH REACT + TONE.JS</span><span>AUDIO UNVERIFIED BY EAR</span></footer>
  </main>;
}
