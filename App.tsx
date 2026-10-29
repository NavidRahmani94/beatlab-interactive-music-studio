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
import Timeline from './Timeline';
import HeroArt from './HeroArt';
import MidiPanel from './MidiPanel';
import { MidiConnection, MidiDevice, midiSupported, openMidi } from './midiInput';
import { MidiMsg, drumForNote, heldSteps, quantizePosition } from './midiLive';
import { MidiData, drumsToGrid, encodeMidi, foldToRange, barsOf, notesToGrid, sourceNotes } from './midiFile';
import { mergeNotes } from './chords';
import { loadLite, saveLite } from './useInView';
import { DEFAULT_OCTAVE, clampOctave, keyToMidi, keyToPad, nextStep, octaveShift } from './keyboardPiano';
import { Section, clampSections, clearSlot, copySlot, insertSlot, moveSlot, removeSlot } from './arrangement';
import { MelodyNote, ScaleName, easyRoot, midiToNote, remapToScale, transposeNotes } from './melody';
import { ChannelName, Channels, ChannelSettings, MasterSettings, patchChannel, patchMaster, syncChannels } from './mixer';
import { DrumKitId, MelodyInstrumentId } from './instruments';
import { ArpSettings } from './arp';
import { MAX_PATTERNS, emptyPattern, frameAt } from './song';
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
  const [sections, setSections] = useState<Section[]>(initial.sections);
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
    schemaVersion: 5, name, bpm, patterns, playlist, tracks, synths, drumKit: kit, sections, groove, melodyView: { key: keyPc, scale }, channels, master
  }), [name, bpm, patterns, playlist, tracks, synths, kit, sections, groove, keyPc, scale, channels, master]);
  const dirty = useMemo(() => serializeProject(project) !== savedJson, [project, savedJson]);

  const engine = useRef<BeatLabEngine | null>(null);
  const frameRef = useRef<{ frame: Frame; at: number } | null>(null);   // the last step the player reported (for recording from a MIDI keyboard)
  const latest = useRef({ bpm, playing, song: { patterns, playlist, mode, current: cur } });
  latest.current = { bpm, playing, song: { patterns, playlist, mode, current: cur } };

  useEffect(() => {
    const instance = new BeatLabEngine(latest.current.song, f => { frameRef.current = { frame: f, at: performance.now() }; setFrame(f); });
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
  const getHealth = useCallback(() => engine.current?.getHealth() ?? { late: 0, maxLateMs: 0, steps: 0 }, []);
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
  function seek(step: number) {
    engine.current?.seek(step);
    setStartStep(step);
    if (latest.current.playing) frameRef.current = { frame: frameAt(step, latest.current.song.playlist, latest.current.song.mode, latest.current.song.current), at: performance.now() };
  }
  const getPlayhead = useCallback(() => (frameRef.current ? { songStep: frameRef.current.frame.songStep, at: frameRef.current.at } : null), []);
  function stop() { engine.current?.stop(); setStartStep(0); setRec(false); setPlaying(false); setFrame(null); setStatus(s => s.kind === 'error' ? s : { kind: 'info', text: 'Stopped.' }); }

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
    setChannels(p.channels); setMaster(p.master); setKit(p.drumKit); setSections(p.sections); setGroove(p.groove); setKeyPc(p.melodyView.key); setScale(p.melodyView.scale);
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
  // ---- MIDI keyboard: play the open tab, and (while the song plays) record into it
  const [midi, setMidi] = useState<{ connected: boolean; devices: MidiDevice[]; deviceId: string; message: string }>({ connected: false, devices: [], deviceId: 'all', message: midiSupported() ? 'Not connected.' : '' });
  const [rec, setRec] = useState(false);
  const [startStep, setStartStep] = useState(0);
  const [keysOn, setKeysOn] = useState(true);
  const [lite, setLite] = useState(loadLite);
  const [octave, setOctave] = useState(DEFAULT_OCTAVE);
  const [stepCursor, setStepCursor] = useState(0);
  const cursorRef = useRef(0); cursorRef.current = stepCursor;
  const drumTimer = useRef<number | undefined>(undefined);
  const conn = useRef<MidiConnection | null>(null);
  type How = { kind: 'drums' } | { kind: 'track'; id: string } | { kind: 'audition'; patch: SynthPatch };
  const live = useRef({ view, tracks, synths, synthId, rec, playing, bpm, playlist, mode, cur });
  live.current = { view, tracks, synths, synthId, rec, playing, bpm, playlist, mode, cur };
  const held = useRef(new Map<number, { t0: number; how: How; vel: number; at: { pattern: number; step: number } | null; entry?: boolean }>());
  const howNow = (): How | null => {
    const L = live.current;
    if (L.view === DRUMS_TAB) return { kind: 'drums' };
    if (L.view === 'lab') {
      const slot = L.synths.find(x => x.id === L.synthId);
      const bound = slot ? L.tracks.find(t => t.kind === 'synth' && t.instrument === customRef(slot.id)) : undefined;
      return bound ? { kind: 'track', id: bound.id } : slot ? { kind: 'audition', patch: slot.patch } : null;
    }
    return L.tracks.some(t => t.id === L.view) ? { kind: 'track', id: L.view } : null;
  };
  const onMidi = useCallback((m: MidiMsg) => {
    const eng = engine.current; const L = live.current;
    if (!eng || m.kind === 'other') return;
    const name = midiToNote(m.note);
    if (m.kind === 'off') {
      const h = held.current.get(m.note);
      if (!h) return;
      held.current.delete(m.note);
      if (h.how.kind === 'audition') eng.auditionUp(h.how.patch, name);
      else if (h.how.kind === 'track') {
        eng.liveUp(h.how.id, name);
        if (h.at) {
          const midiNote = foldToRange(m.note); const at = h.at; const id = h.how.id;
          const n: MelodyNote = { id: `n${midiNote}_${at.step}`, pitch: midiToNote(midiNote), step: at.step, lengthSteps: h.entry ? 1 : Math.min(heldSteps(performance.now() - h.t0, L.bpm), 32 - at.step), velocity: h.vel };
          if (h.entry && ![...held.current.values()].some(x => x.entry)) setStepCursor(c => nextStep(c));
          setPatterns(ps => ps.map((p, i) => (i === at.pattern ? withNotes(p, id, mergeNotes(notesFor(p, id), [n])) : p)));
        }
      }
      return;
    }
    const how = howNow();
    if (!how) return;
    const fr = frameRef.current;
    const where = (): { pattern: number; step: number } | null => {
      if (L.rec && !L.playing) return { pattern: L.cur, step: cursorRef.current };   // step entry: notes go to the highlighted step
      if (!L.rec || !fr) return null;
      const q = quantizePosition(fr.frame, (performance.now() - fr.at) / (60000 / L.bpm / 4), L.playlist, L.mode, L.cur);
      return q.pattern === null ? null : { pattern: q.pattern, step: q.step };
    };
    if (how.kind === 'drums') {
      const inst = drumForNote(m.note);
      if (!inst) return;
      eng.liveDrum(inst, m.velocity);
      const at = where();
      if (at) setPatterns(ps => ps.map((p, i) => (i === at.pattern ? { ...p, drums: { ...p.drums, [inst]: p.drums[inst].map((v, s) => (s === at.step ? true : v)) } } : p)));
      if (at && !L.playing) { window.clearTimeout(drumTimer.current); drumTimer.current = window.setTimeout(() => setStepCursor(c => nextStep(c)), 220); }  // pads hit together share one step
      return;
    }
    if (how.kind === 'audition') void eng.auditionDown(how.patch, name); else eng.liveDown(how.id, name, m.velocity);
    held.current.set(m.note, { t0: performance.now(), how, vel: Math.max(0.05, m.velocity), at: how.kind === 'track' ? where() : null, entry: how.kind === 'track' && L.rec && !L.playing });
  }, []);
  async function connectMidi() {
    try {
      await engine.current?.prepare();
      conn.current?.dispose();
      conn.current = await openMidi(onMidi, devices => setMidi(s => ({ ...s, devices, message: devices.length ? `${devices.length} keyboard${devices.length > 1 ? 's' : ''} found.` : 'Allowed, but no keyboard found. Plug one in.' })));
      setMidi(s => ({ ...s, connected: true, deviceId: 'all' }));
    } catch (e) { setMidi(s => ({ ...s, message: e instanceof Error ? e.message : 'MIDI could not start.' })); }
  }
  useEffect(() => () => { conn.current?.dispose(); }, []);
  // ---- computer keyboard as a piano (and ← → to move the step-entry cursor)
  const keyHeld = useRef(new Map<string, number>());
  const octaveRef = useRef(octave); octaveRef.current = octave;
  useEffect(() => {
    if (!keysOn) return;
    const typing = (el: EventTarget | null) => { const t = el as HTMLElement | null; return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); };
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const L = live.current;
      if (L.rec && !L.playing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); setStepCursor(c => nextStep(c, e.key === 'ArrowRight' ? 1 : -1)); return; }
      if (e.repeat) return;
      const shift = L.view === DRUMS_TAB ? 0 : octaveShift(e.key);
      if (shift) { setOctave(o => clampOctave(o + shift)); return; }
      const note = L.view === DRUMS_TAB ? keyToPad(e.key) : keyToMidi(e.key, octaveRef.current);
      if (note === null || keyHeld.current.has(e.key.toLowerCase())) return;
      keyHeld.current.set(e.key.toLowerCase(), note);
      void engine.current?.prepare().then(() => onMidi({ kind: 'on', note, velocity: 0.8 } as MidiMsg));
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const note = keyHeld.current.get(k);
      if (note === undefined) return;
      keyHeld.current.delete(k);
      onMidi({ kind: 'off', note, velocity: 0 } as MidiMsg);
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); keyHeld.current.forEach(n => onMidi({ kind: 'off', note: n, velocity: 0 } as MidiMsg)); keyHeld.current.clear(); };
  }, [keysOn, onMidi]);
  // clicking a note name in the piano roll plays it with that track's sound
  const previewHeld = useRef(new Set<string>());
  const previewNote = useCallback((trackId: string, midi: number, down: boolean) => {
    const eng = engine.current; if (!eng) return;
    const name = midiToNote(midi); const key = `${trackId}:${midi}`;
    if (down) {
      previewHeld.current.add(key);
      void eng.prepare().then(() => {
        eng.liveDown(trackId, name, 0.8);
        // released before the audio engine was ready (first click): let the note ring briefly instead of hanging
        if (!previewHeld.current.has(key)) window.setTimeout(() => eng.liveUp(trackId, name), 250);
      });
    } else if (previewHeld.current.delete(key)) eng.liveUp(trackId, name);
  }, []);
  const midiTarget = view === DRUMS_TAB ? 'DRUMS (pads: GM notes 36 kick, 38 snare, 42 hat, 39 clap)' : view === 'lab' ? (synths.find(x => x.id === synthId)?.name ?? 'no synth selected') : (trackById(tracks, view)?.name ?? '—');
  function exportMidi() {
    const bytes = encodeMidi({ bpm, patterns, playlist, tracks, mode, pattern: cur, name });
    download(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'audio/midi' }), `${safeFileName(name)}${mode === 'pattern' ? '_' + safeFileName(pattern.name) : ''}.mid`);
    setStatus({ kind: 'info', text: `Exported ${mode === 'pattern' ? pattern.name : 'the song'} as a MIDI file.` });
  }
  function importMidi(data: MidiData, source: number | 'drums', bar: number | 'all', useTempo: boolean): string {
    const drums = source === 'drums';
    if (!drums && !selectedTrack) return 'Open a track tab first (not DRUMS or SYNTH LAB), then import.';
    const notes = sourceNotes(data, source);
    const make = (b: number, nameOf: string): PatternData => drums ? { ...emptyPattern(nameOf), drums: drumsToGrid(notes, data.ppq, b) } : withNotes(emptyPattern(nameOf), selectedTrack!.id, notesToGrid(notes, data.ppq, b));
    let msg: string;
    if (bar === 'all') {
      const room = MAX_PATTERNS - patterns.length;
      if (room <= 0) return `You already have ${MAX_PATTERNS} patterns. Delete one first.`;
      const count = Math.min(barsOf(notes, data.ppq), room);
      const made = Array.from({ length: count }, (_, i) => make(i, `MIDI bar ${i + 1}`));
      setPatterns(ps => [...ps, ...made]); setCurrent(patterns.length);
      msg = `Imported ${count} bar${count > 1 ? 's' : ''} as new patterns.`;
    } else if (drums) { editCurrent(p => ({ ...p, drums: drumsToGrid(notes, data.ppq, bar) })); msg = `Imported bar ${bar + 1} into the DRUMS of “${pattern.name}”.`; }
    else { setTrackNotes(selectedTrack!.id)(notesToGrid(notes, data.ppq, bar)); msg = `Imported bar ${bar + 1} into “${selectedTrack!.name}” in “${pattern.name}”.`; }
    if (useTempo && data.bpm) setBpm(clampBpm(data.bpm));
    setStatus({ kind: 'info', text: msg });
    return msg;
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
    onInstrument={(id: MelodyInstrumentId) => setInstrument(t.id, id)} onArp={patch => setTrackArp(t.id, patch)} playingStep={stepHere} onPreview={(m, d) => previewNote(t.id, m, d)} cursor={rec && !playing && view === t.id ? stepCursor : -1} />;

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
    <header><div><div className="eyebrow">INTERACTIVE MUSIC STUDIO</div><h1><span>BEAT</span>LAB<span className="dot">.</span></h1></div><div className="head-right"><button className={'theme-btn' + (lite ? ' on' : '')} aria-pressed={lite} aria-label="Lite mode" title="Lite mode: stops the decorative animation and draws the visualiser less often. Helps slow computers and phones." onClick={() => { setLite(l => { saveLite(!l); return !l; }); }}>{lite ? '🍃 LITE ON' : '🍃 LITE'}</button><button className="theme-btn" aria-label="Colour theme" title="Switch between automatic, dark and light" onClick={() => setTheme(nextTheme(theme))}>{THEME_LABEL[theme]}</button><div className="phase">PHASE 01–10 <span>• V0.18 TEST BUILD</span></div></div></header>
    <section className="intro hero"><div className="hero-text"><div className="eyebrow">YOUR FIRST SONG</div><h2>Make some noise.</h2><p>Ambient. Drums. Melody. Arpeggio. Mix. Master. Arrange. Export WAV / MP3.</p></div><HeroArt playing={playing} bpm={bpm} lite={lite} /></section>
    {pendingRestore && <div className="restore-banner" role="alert">
      <span>Unsaved work from {new Date(pendingRestore.savedAt).toLocaleString()} was found on this device.</span>
      <button className="auto-btn" onClick={restoreAutosave}>RESTORE IT</button><button className="auto-btn" onClick={dismissRestore}>DISCARD</button>
    </div>}
    <ProjectBar name={name} onName={setName} dirty={dirty} exporting={exporting} loops={loops} unit={mode === 'song' ? 'song' : 'pattern'} onLoops={setLoops} format={format} onFormat={setFormat}
      onNew={newProject} onOpenFile={openFile} onSave={save} onSample={loadSample} onExport={exportWav} />
    <section className="panel transport"><div className="panel-label">TRANSPORT <span>SPACE = PLAY / STOP</span></div><div className="transport-controls"><button className={playing ? 'stop' : 'play'} onClick={playing ? stop : play}>{playing ? '■ STOP' : '▶ PLAY'}</button><div className="bpm"><label htmlFor="bpm">TEMPO <b>{bpm} <small>BPM</small></b></label><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={e => setBpm(clampBpm(Number(e.target.value)))} /></div><div className="undo-redo" role="group" aria-label="History"><button aria-label="Undo" title="Undo (Ctrl+Z)" disabled={histInfo.undo === 0} onClick={() => stepHistory('undo')}>↶ UNDO</button><button aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={histInfo.redo === 0} onClick={() => stepHistory('redo')}>↷ REDO</button></div><div className="indicator"><span className={playing ? 'pulse on' : 'pulse'} />{playing ? 'PLAYING' : 'STOPPED'}</div></div>
      <Timeline mode={mode} playlist={playlist} sections={sections} current={cur} bpm={bpm} playing={playing} startStep={startStep} getPlayhead={getPlayhead} onSeek={seek} /></section>
    <Visualizer lite={lite} getHealth={getHealth} playing={playing} getSpectrum={getSpectrum} getWaveform={getWaveform} step={playFrame?.step ?? -1} bar={playFrame?.bar ?? 0} bars={bars} />

    <MidiPanel supported={midiSupported()} connected={midi.connected} devices={midi.devices} deviceId={midi.deviceId} message={midi.message} rec={rec} playing={playing} target={midiTarget}
      exportUnit={mode === 'pattern' ? pattern.name : 'song'} onConnect={connectMidi} onDevice={id => { conn.current?.select(id); setMidi(s => ({ ...s, deviceId: id })); }}
      onRec={setRec} onExport={exportMidi} onImport={importMidi} keysOn={keysOn} onKeys={setKeysOn} octave={octave} onOctave={o => setOctave(clampOctave(o))}
      cursor={rec && !playing ? stepCursor : -1} view={view === DRUMS_TAB ? 'drums' : 'notes'} />

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
      onSlot={paint} onBars={n => { const len = resizePlaylist(playlist, n).length; setPlaylist(pl => resizePlaylist(pl, n)); setSections(s => clampSections(s, len)); }}
      sections={sections} onSections={setSections} onBuild={(pl, sec) => { setPlaylist(pl); setSections(sec); setMode('song'); }}
      onDropPattern={(bar, pat) => setPlaylist(pl => setSlot(pl, bar, pat))} onMoveSlot={(from, to, copy) => setPlaylist(pl => (copy ? copySlot(pl, from, to) : moveSlot(pl, from, to)))} onClearSlot={bar => setPlaylist(pl => clearSlot(pl, bar))}
      onInsertSlot={i => { setPlaylist(pl => insertSlot(pl, i)); }} onRemoveSlot={i => { setPlaylist(pl => removeSlot(pl, i)); setSections(s => clampSections(s, Math.max(1, playlist.length - 1))); }} onClearBars={() => setPlaylist(pl => pl.map(() => null))} onMode={setMode} />
    <MixerPanel tracks={tracks} channels={channels} master={master} onChannel={changeChannel} onMaster={changeMaster} getLevelDb={getLevelDb} playing={playing} />
    <div role={status.kind === 'error' ? 'alert' : 'status'} className={'status ' + status.kind}>{status.text}</div>
    <footer><span>BEATLAB / V0.18 TEST BUILD</span><span>BUILT WITH REACT + TONE.JS</span><span>AUDIO UNVERIFIED BY EAR</span></footer>
  </main>;
}
