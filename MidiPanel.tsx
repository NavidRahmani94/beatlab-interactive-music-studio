import { ChangeEvent, useRef, useState } from 'react';
import { MidiDevice } from './midiInput';
import { MidiData, barsOf, decodeMidi, hasDrumNotes, sourceNotes } from './midiFile';

type Props = {
  supported: boolean;
  connected: boolean;
  devices: MidiDevice[];
  deviceId: string;
  message: string;
  rec: boolean;
  playing: boolean;
  target: string;          // what the keyboard plays right now (the open tab)
  exportUnit: string;      // 'song' or the pattern name
  onConnect: () => void;
  onDevice: (id: string) => void;
  onRec: (on: boolean) => void;
  onExport: () => void;
  /** Puts the chosen part of the file into the project; returns a message for the status line. */
  onImport: (data: MidiData, source: number | 'drums', bar: number | 'all', useTempo: boolean) => string;
};

/** MIDI keyboard (play + record) and .mid file import / export. */
export default function MidiPanel(p: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MidiData | null>(null);
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState<string>('0');
  const [bar, setBar] = useState<string>('0');
  const [useTempo, setUseTempo] = useState(true);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const r = decodeMidi(new Uint8Array(await f.arrayBuffer()));
    if (!r.ok) { setData(null); setNote(r.error); return; }
    setData(r.data); setFileName(f.name); setSource('0'); setBar('0'); setNote('');
  }
  const sources = data ? [
    ...data.tracks.map((t, i) => ({ value: String(i), label: `${t.name || 'Track ' + (i + 1)} · ${t.notes.length} notes` })),
    ...(data.tracks.some(t => hasDrumNotes(t.notes)) ? [{ value: 'drums', label: 'Drums (General MIDI drum notes)' }] : [])
  ] : [];
  const notesOfSource = data ? sourceNotes(data, source === 'drums' ? 'drums' : Number(source)) : [];
  const bars = data ? barsOf(notesOfSource.length ? notesOfSource : data.tracks[0].notes, data.ppq) : 1;

  return <section className="panel midi" aria-label="MIDI">
    <div className="panel-label">
      <button className="auto-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'} 🎹 MIDI</button>
      <span>PLAY AND RECORD WITH A KEYBOARD · IMPORT / EXPORT .MID FILES</span>
    </div>
    {open && <div className="midi-body">
      <div className="melody-controls">
        {p.supported
          ? <button className="auto-btn" onClick={p.onConnect}>{p.connected ? '↻ RECONNECT KEYBOARD' : '🎹 CONNECT KEYBOARD'}</button>
          : <span className="hint">Live MIDI keyboards need Chrome or Edge on a computer. File import / export below works everywhere.</span>}
        {p.connected && <label className="ctl">INPUT
          <select aria-label="MIDI input" value={p.deviceId} onChange={e => p.onDevice(e.target.value)}>
            <option value="all">All keyboards</option>{p.devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>}
        {p.connected && <button className={'auto-btn rec' + (p.rec ? ' on' : '')} aria-pressed={p.rec} disabled={!p.playing && !p.rec}
          title={p.playing ? 'While the song plays, notes you play are written into the open track' : 'Press PLAY first, then REC'} onClick={() => p.onRec(!p.rec)}>{p.rec ? '● RECORDING' : '○ REC'}</button>}
        <span className="hint" role="status">{p.message}{p.connected ? ` Keyboard plays: ${p.target}.` : ''}</span>
      </div>
      <div className="melody-controls second">
        <button className="auto-btn" onClick={p.onExport} aria-label="Export MIDI file">⬇ EXPORT .MID ({p.exportUnit})</button>
        <button className="auto-btn" onClick={() => fileRef.current?.click()}>⬆ IMPORT .MID…</button>
        <input ref={fileRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden aria-label="Open MIDI file" onChange={pick} />
        <span className="hint">Export writes drums on channel 10 and one MIDI track per BeatLab track (arpeggio tracks as held notes; groove is not included).</span>
        {note && <span className="hint err" role="alert">{note}</span>}
      </div>
      {data && <div className="melody-controls second" aria-label="Import settings">
        <span className="hint"><b>{fileName}</b> · {data.tracks.length} tracks{data.bpm ? ` · ${data.bpm} BPM` : ''}</span>
        <label className="ctl">TAKE
          <select aria-label="MIDI source" value={source} onChange={e => { setSource(e.target.value); setBar('0'); }}>{sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        </label>
        <label className="ctl">BAR (32 STEPS)
          <select aria-label="MIDI bar" value={bar} onChange={e => setBar(e.target.value)}>
            {Array.from({ length: bars }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
            {bars > 1 && <option value="all">All bars → new patterns</option>}
          </select>
        </label>
        {data.bpm && <label className="ctl chk"><input type="checkbox" checked={useTempo} onChange={e => setUseTempo(e.target.checked)} /> USE FILE TEMPO</label>}
        <button className="auto-btn" onClick={() => setNote(p.onImport(data, source === 'drums' ? 'drums' : Number(source), bar === 'all' ? 'all' : Number(bar), useTempo))}>IMPORT</button>
        <span className="hint">Notes go into the open tab ({p.target}); drums go into DRUMS. Undo (Ctrl+Z) takes it back.</span>
      </div>}
    </div>}
  </section>;
}
