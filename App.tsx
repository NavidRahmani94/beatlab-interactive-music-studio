import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BeatLabEngine } from './engine';
import { Instrument, clampBpm, toggleStep } from './pattern';
import { DRUMS_TAB, DRUM_IDS, KIND_DEFAULT_INSTRUMENT, MAX_TRACKS, TRACK_KINDS, TRACK_KIND_IDS, TrackDef, TrackKind, addTrack, removeTrack, renameTrackLive, trackAccent, trackById, updateTrack } from './tracks';
import DrumPanel from './DrumPanel';
import MixerPanel from './MixerPanel';
import PlaylistPanel from './PlaylistPanel';
import ProjectBar from './ProjectBar';
import TrackPanel from './TrackPanel';
import SynthPanel from './SynthPanel';
import Visualizer from './Visualizer';
import HeroArt from './HeroArt';
import { MelodyNote, ScaleName, easyRoot, remapToScale, transposeNotes } from './melody';
import { ChannelName, Channels, ChannelSettings, MasterSettings, patchChannel, patchMaster, syncChannels } from './mixer';
import { DrumKitId, MelodyInstrumentId } from './instruments';
import { ArpSettings } from './arp';
import { Frame, PatternData, PlayMode, Playlist, addPattern, deletePattern, dropTrackNotes, duplicatePattern, emptyDrumPattern, notesFor, renamePattern, resizePlaylist, setSlot, withNotes } from './song';
import { BeatLabProject, MAX_FILE_BYTES, SAMPLE_PROJECTS, defaultProject, hasAudibleContent, startupProject, parseProject, safeFileName, serializeProject } from './project';
import { SynthPatch, SynthSlot, customId, customRef, isCustomRef } from './synth';
import { ExportFormat, renderProjectToWav } from './exporter';
import { STEPS } from './pattern';
import { History, commit, emptyHistory, redo as redoStep, undo as undoStep } from './history';
import { Groove } from './groove';
import { Autosave, clearAutosave, readAutosave, saveAutosave } from './autosave';
import { ThemeChoice, THEME_LABEL, applyTheme, loadTheme, nextTheme, saveTheme } from './theme';
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
  patterns.map(p => ({ ...p, notes: Object.fromEntries(Object.entries(p.notes).map(([id, n]) => [id, fn(n)])) }));

export default function App() {
  const initial = useMemo(startupProject, []);
  const [name, setName] = useState(initial.name);
  const [bpm, setBpm] = useState(initial.bpm);
  const [patterns, setPatterns] = useState<PatternData[]>(initial.patterns);
  const [playlist, setPlaylist] = useState<Playlist>(initial.playlist);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<PlayMode>('song');
  const [view, setView] = useState<string>(initial.tracks[0]?.id ?? DRUMS_TAB);   // 'drums', a track id, or 'lab' (Synth Lab)
  const [addOpen, setAddOpen] = useState(false);
  const [synthId, setSynthId] = useState<string | null>(initial.synths[0]?.id ?? null);
  const [tracks, setTracks] = useState<TrackDef[]>(initial.tracks);
  const [synths, setSynths] = useState<SynthSlot[]>(initial.synths);
  const [kit, setKit] = useState<DrumKitId>(initial.drumKit);
  const [groove, setGroove] = useState<Groove>(initial.groove);
  const [keyPc, setKeyPc] = useState(initial.melodyView.key);
  const [scale, setScale] = useState<ScaleName>(initial.melodyView.scale);
  const [channels, setChannels] = useState<Channels>(initial.channels);
  const [master, setMaster] = useState<MasterSettings>(initial.master);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'info', text: 'Press PLAY (or Space) to start. Everything you change is heard live.' });
  const [loops, setLoops] = useState(1);
  const [format, setFormat] = useState<ExportFormat>('wav16');
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme);
  const [savedJson, setSavedJson] = useState(() => serializeProject(initial));
  // unsaved work found from an earlier visit (offered once, never restored silently)
  const [pendingRestore, setPendingRestore] = useState<Autosave | null>(() => {
    const found = readAutosave();
    if (!found || found.json === serializeProject(initial)) return null;
    return parseProject(found.json).ok ? found : null;
  });

  useEffect(() => {
    applyTheme(theme); saveTheme(theme);
    if (theme !== 'auto') return;
    let mq: MediaQueryList | null = null;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return; }
    const on = () => applyTheme('auto');
    mq.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, [theme]);

  const cur = Math.min(current, patterns.length - 1);
  const pattern = patterns[cur];

  const project: BeatLabProject = useMemo(() => ({
    schemaVersion: 5, name, bpm, patterns, playlist, tracks, synths, drumKit: kit, groove, melodyView: { key: keyPc, scale }, channels, master
  }), [name, bpm, patterns, playlist, tracks, synths, kit, groove, keyPc, scale, channels, master]);
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
  useEffect(() => { engine.current?.setSynths(synths); }, [synths]);
  useEffect(() => { engine.current?.setChannels(channels); }, [channels]);
  useEffect(() => { engine.current?.setMaster(master); }, [master]);
  useEffect(() => { engine.current?.setTracks(tracks); }, [tracks]);
  useEffect(() => { engine.current?.setDrumKit(kit); }, [kit]);
  useEffect(() => { engine.current?.setGroove(groove); }, [groove]);
  const keysDown = useCallback((patch: SynthPatch, note: string) => { void engine.current?.auditionDown(patch, note); }, []);
  const keysUp = useCallback((patch: SynthPatch, note: string) => { engine.current?.auditionUp(patch, note); }, []);
  const keysStop = useCallback(() => { engine.current?.auditionStop(); }, []);
  // a track that points at a deleted synth goes back to its default sound
  useEffect(() => {
    setTracks(ts => {
      if (!ts.some(t => isCustomRef(t.instrument) && !synths.some(s => s.id === customId(t.instrument)))) return ts;
      return ts.map(t => isCustomRef(t.instrument) && !synths.some(s => s.id === customId(t.instrument)) ? { ...t, instrument: KIND_DEFAULT_INSTRUMENT[t.kind] } : t);
    });
    setSynthId(id => (id && synths.some(s => s.id === id) ? id : synths[0]?.id ?? null));
  }, [synths]);
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

  function setAll(p: BeatLabProject) {
    setName(p.name); setBpm(p.bpm); setPatterns(p.patterns); setPlaylist(p.playlist); setTracks(p.tracks); setSynths(p.synths); setView(v => (v === 'lab' || v === DRUMS_TAB || p.tracks.some(t => t.id === v) ? v : (p.tracks[0]?.id ?? DRUMS_TAB)));
    setChannels(p.channels); setMaster(p.master); setKit(p.drumKit); setGroove(p.groove); setKeyPc(p.melodyView.key); setScale(p.melodyView.scale);
  }
  /** Loads a whole project (new / open / sample / restore): the undo history starts again. */
  function apply(p: BeatLabProject, saved = true) {
    setAll(p); setCurrent(0);
    resetHistory(p);
    if (saved) setSavedJson(serializeProject(p));
  }

  // ---- undo / redo. Changes that come close together (a slider drag, a quick run of clicks) count as one step.
  const hist = useRef<History<BeatLabProject>>(emptyHistory());
  const base = useRef<BeatLabProject>(project);          // the last state that is already in the history
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectRef = useRef(project); projectRef.current = project;
  const [histInfo, setHistInfo] = useState({ undo: 0, redo: 0 });
  const syncInfo = () => setHistInfo({ undo: hist.current.past.length, redo: hist.current.future.length });
  function resetHistory(p: BeatLabProject) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null; hist.current = emptyHistory(); base.current = p; syncInfo();
  }
  function flushHistory() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const now = projectRef.current;
    if (serializeProject(now) === serializeProject(base.current)) return;
    hist.current = commit(hist.current, base.current); base.current = now; syncInfo();
  }
  useEffect(() => {
    if (serializeProject(project) === serializeProject(base.current)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushHistory, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function stepHistory(dir: 'undo' | 'redo') {
    flushHistory();
    const r = (dir === 'undo' ? undoStep : redoStep)(hist.current, projectRef.current);
    if (!r) return;
    hist.current = r.history; base.current = r.value; syncInfo();
    setAll(r.value);
    setStatus({ kind: 'info', text: dir === 'undo' ? 'Undone.' : 'Redone.' });
  }
  const stepRef = useRef(stepHistory); stepRef.current = stepHistory;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|)$/.test((el as HTMLInputElement).type)))) return; // let text fields undo their own typing
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); stepRef.current(e.shiftKey ? 'redo' : 'undo'); }
      else if (k === 'y') { e.preventDefault(); stepRef.current('redo'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- autosave of unsaved work (waits until the person has answered the restore question)
  useEffect(() => {
    if (pendingRestore) return;
    if (!dirty) { clearAutosave(); return; }
    const t = setTimeout(() => saveAutosave(serializeProject(project)), 1500);
    return () => clearTimeout(t);
  }, [project, dirty, pendingRestore]);
  function restoreAutosave() {
    if (!pendingRestore) return;
    const r = parseProject(pendingRestore.json);
    setPendingRestore(null);
    if (r.ok) { apply(r.project, false); setStatus({ kind: 'info', text: 'Restored your unsaved work. Save it to keep it.' }); }
  }
  function dismissRestore() { clearAutosave(); setPendingRestore(null); }
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
      const result = await renderProjectToWav(project, loops, { mode, pattern: cur, format });
      download(result.blob, `${safeFileName(name)}.${result.ext}`);
      setStatus({ kind: 'info', text: `Exported ${safeFileName(name)}.${result.ext} — ${mode === 'song' ? 'song' : 'pattern'}, ${result.bars} slot${result.bars > 1 ? 's' : ''}, ${result.seconds.toFixed(1)} s, ${Math.round(result.blob.size / 1024)} KB, ${result.detail}.` });
    } catch (e) {
      setStatus({ kind: 'error', text: `Export failed: ${e instanceof Error ? e.message : 'unknown error'}` });
    } finally { setExporting(false); }
  }

  // ---- editing the selected pattern
  const editCurrent = (fn: (p: PatternData) => PatternData) => setPatterns(ps => ps.map((p, i) => i === Math.min(current, ps.length - 1) ? fn(p) : p));
  const setTrackNotes = (trackId: string) => (action: MelodyNote[] | ((prev: MelodyNote[]) => MelodyNote[])) =>
    setPatterns(ps => ps.map((p, i) => i === Math.min(current, ps.length - 1) ? withNotes(p, trackId, typeof action === 'function' ? action(notesFor(p, trackId)) : action) : p));

  // ---- tracks: add, delete, rename, instrument
  function createTrack(kind: TrackKind, instrument?: string): string | null {
    const next = addTrack(tracks, kind, { instrument });
    if (next === tracks) { setStatus({ kind: 'error', text: `You can have at most ${MAX_TRACKS} tracks. Delete one first.` }); return null; }
    const made = next[next.length - 1];
    setTracks(next); setChannels(c => syncChannels(c, next));
    return made.id;
  }
  function addTrackOfKind(kind: TrackKind) {
    const id = createTrack(kind);
    setAddOpen(false);
    if (id) { setView(id); setStatus({ kind: 'info', text: `Added a ${TRACK_KINDS[kind].label} track. You can rename or delete it any time.` }); }
  }
  function deleteTrack(id: string) {
    const t = trackById(tracks, id);
    if (!t) return;
    if (!window.confirm(`Delete the track “${t.name}” and its notes in every pattern?`)) return;
    const next = removeTrack(tracks, id);
    setTracks(next); setPatterns(ps => dropTrackNotes(ps, id)); setChannels(c => syncChannels(c, next));
    setView(next[0]?.id ?? DRUMS_TAB);
    setStatus({ kind: 'info', text: `Deleted track “${t.name}”.` });
  }
  const renameTrack = (id: string, n: string) => setTracks(ts => renameTrackLive(ts, id, n));
  const setInstrument = (id: string, ref: string) => setTracks(ts => updateTrack(ts, id, { instrument: ref }));
  const setTrackArp = (id: string, patch: Partial<ArpSettings>) => setTracks(ts => ts.map(t => t.id === id ? { ...t, arp: { ...t.arp, ...patch } } : t));
  const selectedTrack = trackById(tracks, view);
  const renderTrack = (t: TrackDef) => <TrackPanel key={t.id} track={t} accent={trackAccent(tracks.indexOf(t))} onRename={n => renameTrack(t.id, n)} onDelete={() => deleteTrack(t.id)}
    synths={synths} notes={notesFor(pattern, t.id)} onNotes={setTrackNotes(t.id)} enabled={!(channels[t.id]?.muted)}
    onEnabled={on => changeChannel(t.id, { muted: !on })} solo={!!channels[t.id]?.solo} onSolo={solo => changeChannel(t.id, { solo })} keyPc={keyPc} scale={scale} onKeyChange={changeKey} onScaleChange={changeScale}
    onInstrument={(id: MelodyInstrumentId) => setInstrument(t.id, id)} onArp={patch => setTrackArp(t.id, patch)} playingStep={stepHere} />;

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
  // listen to one pattern on its own: switch to PATTERN mode, loop it; press again to stop
  function audition(i: number) {
    if (latest.current.playing && mode === 'pattern' && cur === i) { stop(); return; }
    setCurrent(i); setMode('pattern');
    engine.current?.setSong({ patterns, playlist, mode: 'pattern', current: i });
    if (!latest.current.playing) void play();
  }
  // listen to ONE track of the selected pattern on its own (uses the mixer's solo; press again to hear everything again)
  const trackChannels = (t: string): ChannelName[] => t === DRUMS_TAB ? [...DRUM_IDS] : [t];
  const soloedNow = (Object.keys(channels) as ChannelName[]).filter(n => channels[n].solo);
  const aloneActive = soloedNow.length === trackChannels(view).length && trackChannels(view).every(n => channels[n].solo);
  function listenAlone() {
    if (aloneActive) { setChannels(c => (Object.keys(c) as ChannelName[]).reduce((acc, n) => patchChannel(acc, n, { solo: false }), c)); return; }
    const target = trackChannels(view);
    setChannels(c => (Object.keys(c) as ChannelName[]).reduce((acc, n) => patchChannel(acc, n, { solo: target.includes(n), muted: target.includes(n) ? false : acc[n].muted }), c));
    setMode('pattern');
    engine.current?.setSong({ patterns, playlist, mode: 'pattern', current: cur });
    if (!latest.current.playing) void play();
  }
  const paint = (bar: number) => setPlaylist(pl => setSlot(pl, bar, pl[bar] === cur ? null : cur));

  const playFrame = playing ? frame : null;
  const stepHere = playFrame && playFrame.pattern === cur ? playFrame.step : -1;
  const hasNotes = (t: string) => t === DRUMS_TAB ? Object.values(pattern.drums).some(r => r.some(Boolean)) : notesFor(pattern, t).length > 0;
  const mutedTab = (t: string) => t === DRUMS_TAB ? DRUM_IDS.every(i => channels[i]?.muted) : !!channels[t]?.muted;
  const lab = view === 'lab';
  const tabLabel = (t: string) => t === DRUMS_TAB ? 'DRUMS' : (trackById(tracks, t)?.name ?? t).toUpperCase();
  const bars = mode === 'song' ? playlist.length : 1;

  return <main className="shell" style={{ ['--bar-s' as string]: `${(STEPS * 15) / bpm}s` }}>
    <header><div><div className="eyebrow">INTERACTIVE MUSIC STUDIO</div><h1><span>BEAT</span>LAB<span className="dot">.</span></h1></div><div className="head-right"><button className="theme-btn" aria-label="Colour theme" title="Switch between automatic, dark and light" onClick={() => setTheme(nextTheme(theme))}>{THEME_LABEL[theme]}</button><div className="phase">PHASE 01–10 <span>• V0.13 TEST BUILD</span></div></div></header>
    <section className="intro hero"><div className="hero-text"><div className="eyebrow">YOUR FIRST SONG</div><h2>Make some noise.</h2><p>Ambient. Drums. Melody. Arpeggio. Mix. Master. Arrange. Export WAV / MP3.</p></div><HeroArt playing={playing} bpm={bpm} /></section>
    {pendingRestore && <div className="restore-banner" role="alert">
      <span>Unsaved work from {new Date(pendingRestore.savedAt).toLocaleString()} was found on this device.</span>
      <button className="auto-btn" onClick={restoreAutosave}>RESTORE IT</button><button className="auto-btn" onClick={dismissRestore}>DISCARD</button>
    </div>}
    <ProjectBar name={name} onName={setName} dirty={dirty} exporting={exporting} loops={loops} unit={mode === 'song' ? 'song' : 'pattern'} onLoops={setLoops} format={format} onFormat={setFormat}
      onNew={newProject} onOpenFile={openFile} onSave={save} onSample={loadSample} onExport={exportWav} />
    <section className="panel transport"><div className="panel-label">TRANSPORT <span>SPACE = PLAY / STOP</span></div><div className="transport-controls"><button className={playing ? 'stop' : 'play'} onClick={playing ? stop : play}>{playing ? '■ STOP' : '▶ PLAY'}</button><div className="bpm"><label htmlFor="bpm">TEMPO <b>{bpm} <small>BPM</small></b></label><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={e => setBpm(clampBpm(Number(e.target.value)))} /></div><div className="undo-redo" role="group" aria-label="History"><button aria-label="Undo" title="Undo (Ctrl+Z)" disabled={histInfo.undo === 0} onClick={() => stepHistory('undo')}>↶ UNDO</button><button aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={histInfo.redo === 0} onClick={() => stepHistory('redo')}>↷ REDO</button></div><div className="indicator"><span className={playing ? 'pulse on' : 'pulse'} />{playing ? 'PLAYING' : 'STOPPED'}</div></div></section>
    <Visualizer playing={playing} getSpectrum={getSpectrum} getWaveform={getWaveform} step={playFrame?.step ?? -1} bar={playFrame?.bar ?? 0} bars={bars} />

    <div className="tabs" role="tablist" aria-label="Tracks">
      <button className={'mini-play' + (playing ? ' on' : '')} aria-label={playing ? 'Stop (quick)' : 'Play (quick)'} title="Play / stop from here (Space also works)" onClick={playing ? stop : play}>{playing ? '■' : '▶'}</button>
      <button className={'mini-play pat' + (playing && mode === 'pattern' ? ' on' : '')} aria-label={`Play only ${pattern.name} (quick)`} title="Loop only the pattern you are editing" onClick={() => audition(cur)}>{playing && mode === 'pattern' ? '■' : '▶'} THIS PATTERN</button>
      {[DRUMS_TAB, ...tracks.map(t => t.id)].map(t => <button key={t} role="tab" aria-selected={view === t} className={'tab' + (view === t ? ' sel' : '') + (mutedTab(t) ? ' muted' : '')} onClick={() => setView(t)}>
        <i className={'tab-dot' + (hasNotes(t) ? ' has' : '')} data-track={t} />{tabLabel(t)}
      </button>)}
      <button role="tab" aria-selected={lab} className={'tab synth-tab' + (lab ? ' sel' : '')} onClick={() => setView('lab')}>
        <i className={'tab-dot' + (synths.length ? ' has' : '')} />SYNTH LAB
      </button>
      <span className="add-track">
        <button className="auto-btn" aria-expanded={addOpen} aria-label="Add track" disabled={tracks.length >= MAX_TRACKS} title={tracks.length >= MAX_TRACKS ? `At most ${MAX_TRACKS} tracks` : 'Add a new track'} onClick={() => setAddOpen(o => !o)}>＋ TRACK</button>
        {addOpen && <span className="add-menu" role="menu" aria-label="Track kind">
          {TRACK_KIND_IDS.map(k => <button key={k} role="menuitem" aria-label={`Add ${TRACK_KINDS[k].label} track`} title={TRACK_KINDS[k].hint} onClick={() => addTrackOfKind(k)}>{TRACK_KINDS[k].label.toUpperCase()}</button>)}
        </span>}
      </span>
      {!lab && <button className={'auto-btn listen' + (aloneActive ? ' on' : '')} aria-pressed={aloneActive} aria-label={`Listen to ${tabLabel(view)} alone`}
        title="Hear only this track of the selected pattern (loops it). Press again to hear everything." onClick={listenAlone}>{aloneActive ? '■ BACK TO FULL MIX' : `🎧 LISTEN TO ${tabLabel(view)} ALONE`}</button>}
      <span className="tab-pattern">EDITING <b>{pattern.name}</b></span>
    </div>

    {lab && <SynthPanel synths={synths} onSynths={fn => setSynths(fn)} selectedId={synthId} onSelect={setSynthId} tracks={tracks}
      onUse={(id, ref) => { setInstrument(id, ref); setStatus({ kind: 'info', text: `This synth is now the sound of “${trackById(tracks, id)?.name ?? id}”.` }); }}
      onCreateTrack={sid => { const id = createTrack('synth', customRef(sid)); if (id) setStatus({ kind: 'info', text: 'Added a Synth track with its own piano roll.' }); }} renderTrack={renderTrack}
      onKeyDown={keysDown} onKeyUp={keysUp} onKeysStop={keysStop} getWaveform={getWaveform} />}
    {view === DRUMS_TAB && <DrumPanel groove={groove} onGroove={setGroove} pattern={pattern.drums} kit={kit} channels={channels} playingStep={stepHere} onKit={setKit}
      onToggle={(inst: Instrument, i: number) => editCurrent(p => ({ ...p, drums: toggleStep(p.drums, inst, i) }))}
      onMute={(inst, muted) => changeChannel(inst, { muted })} onSolo={(inst, solo) => changeChannel(inst, { solo })}
      onAllMute={muted => setChannels(c => DRUM_IDS.reduce((acc, n) => patchChannel(acc, n, { muted }), c))}
      onAllSolo={solo => setChannels(c => DRUM_IDS.reduce((acc, n) => patchChannel(acc, n, { solo }), c))} onClear={() => editCurrent(p => ({ ...p, drums: emptyDrumPattern() }))} />}
    {selectedTrack && renderTrack(selectedTrack)}


    <PlaylistPanel patterns={patterns} playlist={playlist} current={cur} mode={mode} playing={playing} playBar={playFrame?.bar ?? -1} playPattern={playFrame?.pattern ?? null}
      onSelect={setCurrent} onAudition={audition} onNew={newPattern} onDuplicate={duplicate} onDelete={remove} onRename={n => setPatterns(ps => renamePattern(ps, cur, n))}
      onSlot={paint} onBars={n => setPlaylist(pl => resizePlaylist(pl, n))} onClearBars={() => setPlaylist(pl => pl.map(() => null))} onMode={setMode} />
    <MixerPanel tracks={tracks} channels={channels} master={master} onChannel={changeChannel} onMaster={changeMaster} getLevelDb={getLevelDb} playing={playing} />
    <div role={status.kind === 'error' ? 'alert' : 'status'} className={'status ' + status.kind}>{status.text}</div>
    <footer><span>BEATLAB / V0.13 TEST BUILD</span><span>BUILT WITH REACT + TONE.JS</span><span>AUDIO UNVERIFIED BY EAR</span></footer>
  </main>;
}
