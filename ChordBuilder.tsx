import { Dispatch, SetStateAction, useState } from 'react';
import { CHORD_STYLES, ChordStyle, REGISTERS, Register, chordNotes, diatonicChords, mergeNotes, progressionNotes, progressionsFor, suggestNext, voiceChord } from './chords';
import { MelodyNote, DEFAULT_VELOCITY, midiToNote, scaleRows } from './melody';
import { STEPS } from './pattern';
import { TrackKind } from './tracks';

type Props = { keyPc: number; scale: Parameters<typeof diatonicChords>[1]; kind: TrackKind; onNotes: Dispatch<SetStateAction<MelodyNote[]>>; onOutOfKey: () => void };

const LENGTHS = [2, 4, 8, 16];
const POSITIONS = Array.from({ length: STEPS / 2 }, (_, i) => i * 2);

/** Pick a chord of the key and drop it on the grid; the builder moves forward and suggests the next chord. */
export default function ChordBuilder({ keyPc, scale, kind, onNotes, onOutOfKey }: Props) {
  const [open, setOpen] = useState(false);
  const [sevenths, setSevenths] = useState(false);
  const [style, setStyle] = useState<ChordStyle>("block");
  const [register, setRegister] = useState<Register>(kind === 'ambient' || kind === 'arp' ? 'low' : 'mid');
  const [inversion, setInversion] = useState(0);
  const [length, setLength] = useState(kind === 'melody' || kind === 'synth' ? 4 : 8);
  const [position, setPosition] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const [progId, setProgId] = useState('');
  const chords = diatonicChords(keyPc, scale, sevenths);
  const progs = progressionsFor(scale);
  const suggestions = suggestNext(last, scale);
  const suggested = new Set(suggestions.map(s => s.index));

  function insert(index: number) {
    const c = chords[index];
    const midis = voiceChord(c.rootPc, c.offsets, register, inversion);
    if (midis.some(m => !scaleRows(keyPc, scale).includes(m))) onOutOfKey();   // the EASY piano roll only shows the notes of one octave of the scale
    onNotes(prev => mergeNotes(prev, chordNotes(midis, position, length, style, DEFAULT_VELOCITY)));
    setLast(index);
    setPosition(p => (p + length >= STEPS ? 0 : p + length));
  }
  function useProgression() {
    const p = progs.find(x => x.id === progId);
    if (!p) return;
    onOutOfKey();
    onNotes(progressionNotes(keyPc, scale, p.chords, { sevenths, register, style, length: STEPS / p.chords.length }));
    setLast(p.chords[p.chords.length - 1]); setPosition(0);
  }

  return <div className="chord-builder">
    <button className="auto-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'} 🎹 CHORD BUILDER</button>
    {open && <div className="chord-body" role="group" aria-label="Chord builder">
      <div className="chord-row" role="group" aria-label="Chords of this key">
        {chords.map(c => <button key={c.index} className={'chord-btn' + (suggested.has(c.index) ? ' hint' : '')} aria-label={`Insert chord ${c.name}`}
          title={`${c.roman} · ${voiceChord(c.rootPc, c.offsets, register, inversion).map(midiToNote).join(' ')}${suggested.has(c.index) ? ' · suggested: ' + suggestions.find(s => s.index === c.index)?.why : ''}`}
          onClick={() => insert(c.index)}><small>{c.roman}</small><b>{c.name}</b></button>)}
      </div>
      <div className="chord-next" aria-live="polite">
        {last === null ? 'Start here: ' : `After ${chords[last].roman}: `}
        {suggestions.map(s => <span key={s.index} className="chip-note"><b>{chords[s.index].name}</b> — {s.why}</span>)}
      </div>
      <div className="melody-controls second">
        <label className="ctl">PLACE AT STEP
          <select aria-label="Chord position" value={position} onChange={e => setPosition(Number(e.target.value))}>{POSITIONS.map(p => <option key={p} value={p}>{p + 1}</option>)}</select>
        </label>
        <div className="ctl">LENGTH
          <div className="seg" role="group" aria-label="Chord length">{LENGTHS.map(l => <button key={l} aria-pressed={length === l} className={length === l ? 'sel' : ''} onClick={() => setLength(l)}>{l}</button>)}</div>
        </div>
        <div className="ctl">STYLE
          <div className="seg" role="group" aria-label="Chord style">{(Object.keys(CHORD_STYLES) as ChordStyle[]).map(s => <button key={s} title={CHORD_STYLES[s].hint} aria-pressed={style === s} className={style === s ? 'sel' : ''} onClick={() => setStyle(s)}>{CHORD_STYLES[s].label}</button>)}</div>
        </div>
        <div className="ctl">REGISTER
          <div className="seg" role="group" aria-label="Chord register">{(Object.keys(REGISTERS) as Register[]).map(r => <button key={r} aria-pressed={register === r} className={register === r ? 'sel' : ''} onClick={() => setRegister(r)}>{REGISTERS[r].label}</button>)}</div>
        </div>
        <div className="ctl">INVERSION
          <div className="seg" role="group" aria-label="Chord inversion">{[0, 1, 2].map(i => <button key={i} aria-pressed={inversion === i} className={inversion === i ? 'sel' : ''} onClick={() => setInversion(i)}>{i === 0 ? 'ROOT' : i}</button>)}</div>
        </div>
        <label className="ctl chk"><input type="checkbox" checked={sevenths} onChange={e => setSevenths(e.target.checked)} /> 7THS</label>
      </div>
      <div className="melody-controls second">
        <label className="ctl">READY-MADE PROGRESSION
          <select aria-label="Progression" value={progId} onChange={e => setProgId(e.target.value)}>
            <option value="">Choose…</option>{progs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <button className="auto-btn" disabled={!progId} title="Replaces this track's notes in the selected pattern with the progression" onClick={useProgression}>USE PROGRESSION (REPLACES NOTES)</button>
        <span className="hint">Each click adds a chord at the position, then moves forward by the chord length. Undo (Ctrl+Z) takes it back.</span>
      </div>
    </div>}
  </div>;
}
