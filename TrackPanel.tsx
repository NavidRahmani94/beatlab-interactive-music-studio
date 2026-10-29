import { SynthSlot, customRef } from './synth';
import { Dispatch, SetStateAction, useState } from 'react';
import {
  DEFAULT_VELOCITY, MelodyNote, NOTE_NAMES, PRESETS, PRESET_NAMES, PresetName, SCALES, ScaleName, TRACK_PRESETS, TrackPresetName,
  generateMelody, makePreset, makeTrackPreset, presetsForTrack, snapNotesToScale
} from './melody';
import { ARP_MODES, ARP_RATES, ArpMode, ArpRate, ArpSettings, clampGate } from './arp';
import { MELODY_INSTRUMENTS, instrumentGroups, MelodicTrack, MelodyInstrumentId, TAB_HINTS, TRACK_DEFAULT_LENGTH } from './instruments';
import PianoRoll from './PianoRoll';

type Props = {
  track: MelodicTrack;
  notes: MelodyNote[];
  onNotes: Dispatch<SetStateAction<MelodyNote[]>>;
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  solo: boolean;
  onSolo: (solo: boolean) => void;
  keyPc: number;
  scale: ScaleName;
  onKeyChange: (keyPc: number) => void;
  onScaleChange: (scale: ScaleName) => void;
  instrument: MelodyInstrumentId;
  synths: SynthSlot[];
  onInstrument: (id: MelodyInstrumentId) => void;
  arp: ArpSettings;
  onArp: (patch: Partial<ArpSettings>) => void;
  playingStep: number;
};

const NAMES: Record<MelodicTrack, string> = { melody: 'Melody', ambient: 'Ambient', arp: 'Arpeggio' };
const ACCENT: Record<MelodicTrack, string> = { melody: '#7cf0c2', ambient: '#9db4ff', arp: '#ffb86b' };
const LENGTHS: Record<MelodicTrack, [string, number][]> = {
  melody: [['1', 1], ['2', 2], ['4', 4], ['8', 8]],
  ambient: [['4', 4], ['8', 8], ['16', 16], ['32', 32]],
  arp: [['4', 4], ['8', 8], ['16', 16], ['32', 32]]
};

/** One tab for a melodic track: ambient, melody or arpeggio. They share the piano roll, key and scale. */
export default function TrackPanel(p: Props) {
  const { track } = p;
  const [advanced, setAdvanced] = useState(false);
  const [length, setLength] = useState(TRACK_DEFAULT_LENGTH[track]);
  const [velocity, setVelocity] = useState(DEFAULT_VELOCITY);
  const touchDevice = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const [touchDraw, setTouchDraw] = useState(false);
  const [mood, setMood] = useState<PresetName>('happy');
  const name = NAMES[track];

  function loadMood(m: PresetName) {
    const preset = makePreset(m, p.keyPc);
    setMood(m);
    p.onScaleChange(preset.scale);
    p.onInstrument(preset.instrument);
    p.onNotes(preset.notes);
  }
  function loadTrackPreset(id: TrackPresetName) {
    const preset = makeTrackPreset(id, p.keyPc);
    p.onInstrument(preset.instrument);
    p.onNotes(snapNotesToScale(preset.notes, p.keyPc, p.scale)); // keeps the shared key / scale
  }
  const auto = () => p.onNotes(generateMelody(p.keyPc, p.scale, mood, Math.floor(Math.random() * 4294967296)));

  return <section className="panel melody" aria-label={`${name} track`}>
    <div className="panel-label">{name.toUpperCase()} <span>{TAB_HINTS[track]} · {advanced ? 'ADVANCED · PIANO ROLL C3–C6' : 'EASY · EVERY NOTE FITS THE KEY'}</span></div>
    <div className="melody-controls">
      <div className="seg" role="group" aria-label={`${name} mode`}>
        <button aria-pressed={!advanced} className={!advanced ? 'sel' : ''} onClick={() => setAdvanced(false)}>EASY</button>
        <button aria-pressed={advanced} className={advanced ? 'sel' : ''} onClick={() => setAdvanced(true)}>ADVANCED</button>
      </div>
      <label className="ctl">INSTRUMENT
        <select value={p.instrument} aria-label={`${name} instrument`} onChange={e => p.onInstrument(e.target.value as MelodyInstrumentId)}>
          {p.synths.length > 0 && <optgroup label="★ My synths (Synth Lab)">{p.synths.map(s => <option key={s.id} value={customRef(s.id)}>{s.name}</option>)}</optgroup>}
          {instrumentGroups().map(g => <optgroup key={g.group} label={g.group}>{g.ids.map(id => <option key={id} value={id}>{MELODY_INSTRUMENTS[id].label} — {MELODY_INSTRUMENTS[id].hint}</option>)}</optgroup>)}
        </select>
      </label>
      {track === 'melody' ? <>
        <div className="ctl">MOOD
          <div className="seg" role="group" aria-label="Moods">
            {PRESET_NAMES.map(m => <button key={m} aria-pressed={mood === m} className={mood === m ? 'sel' : ''} title={`Load the ${m} melody (also sets scale and instrument)`} onClick={() => loadMood(m)}>{PRESETS[m].label}</button>)}
          </div>
        </div>
        <button className="auto-btn" title="Generate a new random melody in the current key, scale and mood" onClick={auto}>✦ AUTO MELODY</button>
      </> : <div className="ctl">READY-MADE
        <div className="seg" role="group" aria-label={`${name} presets`}>
          {presetsForTrack(track).map(id => <button key={id} title={`Load “${TRACK_PRESETS[id].label}” (keeps your key and scale)`} onClick={() => loadTrackPreset(id)}>{TRACK_PRESETS[id].label}</button>)}
        </div>
      </div>}
    </div>
    {track === 'arp' && <div className="melody-controls second" aria-label="Arpeggiator settings">
      <div className="ctl">PATTERN
        <div className="seg" role="group" aria-label="Arpeggio direction">
          {(Object.keys(ARP_MODES) as ArpMode[]).map(m => <button key={m} aria-pressed={p.arp.mode === m} className={p.arp.mode === m ? 'sel' : ''} onClick={() => p.onArp({ mode: m })}>{ARP_MODES[m].toUpperCase()}</button>)}
        </div>
      </div>
      <div className="ctl">SPEED
        <div className="seg" role="group" aria-label="Arpeggio speed">
          {(Object.keys(ARP_RATES) as ArpRate[]).map(r => <button key={r} aria-pressed={p.arp.rate === r} className={p.arp.rate === r ? 'sel' : ''} onClick={() => p.onArp({ rate: r })}>{ARP_RATES[r].label}</button>)}
        </div>
      </div>
      <div className="ctl">OCTAVES
        <div className="seg" role="group" aria-label="Arpeggio octaves">
          {([1, 2, 3] as const).map(o => <button key={o} aria-pressed={p.arp.octaves === o} className={p.arp.octaves === o ? 'sel' : ''} onClick={() => p.onArp({ octaves: o })}>{o}</button>)}
        </div>
      </div>
      <label className="ctl">GATE (note length)
        <span className="fader"><input type="range" min={20} max={100} value={Math.round(p.arp.gate * 100)} aria-label="Arpeggio gate" onChange={e => p.onArp({ gate: clampGate(Number(e.target.value) / 100) })} /><b>{Math.round(p.arp.gate * 100)}%</b></span>
      </label>
      <span className="hint">Draw long notes (a chord). The arpeggiator plays them one by one.</span>
    </div>}
    <div className="melody-controls second">
      <label className="ctl">KEY
        <select value={p.keyPc} aria-label="Key" onChange={e => p.onKeyChange(Number(e.target.value))}>
          {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
      </label>
      <label className="ctl">SCALE
        <select value={p.scale} aria-label="Scale" onChange={e => p.onScaleChange(e.target.value as ScaleName)}>
          {(Object.keys(SCALES) as ScaleName[]).map(s => <option key={s} value={s}>{SCALES[s].label}</option>)}
        </select>
      </label>
      <div className="ctl">NEW NOTE LENGTH
        <div className="seg" role="group" aria-label="Note length">
          {LENGTHS[track].map(([label, value]) =>
            <button key={label} aria-pressed={length === value} className={length === value ? 'sel' : ''} onClick={() => setLength(value)}>{label}</button>)}
        </div>
      </div>
      <label className="ctl">NEW NOTE VELOCITY
        <span className="fader"><input type="range" min={5} max={100} value={Math.round(velocity * 100)} aria-label="New note velocity" onChange={e => setVelocity(Number(e.target.value) / 100)} /><b>{Math.round(velocity * 100)}</b></span>
      </label>
      <button className={'mute-btn solo' + (p.solo ? ' sel' : '')} style={{ marginLeft: 'auto' }} aria-pressed={p.solo} aria-label={`Solo only ${name}`}
        title={p.solo ? 'Hear everything again' : 'Hear only this track (all others are muted)'} onClick={() => p.onSolo(!p.solo)}>SOLO</button>
      <button className="mute-btn" style={{ marginLeft: 0 }} aria-label={`${name} ${p.enabled ? 'on' : 'off'}`} aria-pressed={p.enabled}
        onClick={() => p.onEnabled(!p.enabled)}>{p.enabled ? 'ON' : 'OFF'}</button>
    </div>
    {touchDevice && <div className="touch-mode" role="group" aria-label="Touch mode">
      <span>FINGER:</span>
      <button className={!touchDraw ? 'sel' : ''} aria-pressed={!touchDraw} onClick={() => setTouchDraw(false)}>↔ SCROLL (tap = note)</button>
      <button className={touchDraw ? 'sel' : ''} aria-pressed={touchDraw} onClick={() => setTouchDraw(true)}>✏ DRAW (drag = long note)</button>
    </div>}
    <PianoRoll notes={p.notes} onNotes={p.onNotes} advanced={advanced} keyPc={p.keyPc} scale={p.scale} defaultLength={length} velocity={velocity}
      enabled={p.enabled} playingStep={p.playingStep} accent={ACCENT[track]} touchDraw={touchDraw} />
    <div className="grid-footer">
      <span>CLICK = NEW NOTE · DRAG SIDEWAYS = ANY LENGTH · DRAG A NOTE'S END TO STRETCH · CLICK A NOTE TO REMOVE IT</span>
      <button onClick={() => p.onNotes([])}>CLEAR {name.toUpperCase()} ↗</button>
    </div>
  </section>;
}
