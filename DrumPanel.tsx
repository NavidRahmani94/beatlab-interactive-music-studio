import { INSTRUMENTS, DrumPattern, Instrument } from './pattern';
import { CHANNEL_LABELS, Channels } from './mixer';
import { DRUM_KITS, DRUM_KIT_IDS, DrumKitId } from './instruments';

type Props = {
  pattern: DrumPattern;
  kit: DrumKitId;
  channels: Channels;
  playingStep: number;      // -1 when this pattern is not being played right now
  onToggle: (instrument: Instrument, step: number) => void;
  onMute: (instrument: Instrument, muted: boolean) => void;
  onSolo: (instrument: Instrument, solo: boolean) => void;
  onAllMute: (muted: boolean) => void;
  onAllSolo: (solo: boolean) => void;
  onKit: (kit: DrumKitId) => void;
  onClear: () => void;
};

/** The drum machine (unchanged behaviour; now one tab among four). */
export default function DrumPanel({ pattern, kit, channels, playingStep, onToggle, onMute, onSolo, onAllMute, onAllSolo, onKit, onClear }: Props) {
  const labels = CHANNEL_LABELS as Record<Instrument, string>;
  const allOff = INSTRUMENTS.every(i => channels[i].muted);
  const allSolo = INSTRUMENTS.every(i => channels[i].solo);
  return <section className="panel sequencer" aria-label="Drums track">
    <div className="panel-label">DRUM MACHINE <span>16-STEP SEQUENCER</span></div>
    <div className="melody-controls">
      <button className={'mute-btn wide' + (allOff ? ' off' : '')} style={{ marginLeft: 0 }} aria-pressed={!allOff} aria-label={`All drums ${allOff ? 'off' : 'on'}`} title="Turn the whole drum machine on / off" onClick={() => onAllMute(!allOff)}>DRUMS {allOff ? 'OFF' : 'ON'}</button>
      <button className={'mute-btn wide solo' + (allSolo ? ' sel' : '')} style={{ marginLeft: 0 }} aria-pressed={allSolo} aria-label="Solo all drums" title="Hear only the drums (everything else is muted). Press again to hear everything." onClick={() => onAllSolo(!allSolo)}>SOLO DRUMS</button>
      <label className="ctl">DRUM KIT<select value={kit} aria-label="Drum kit" onChange={e => onKit(e.target.value as DrumKitId)}>{DRUM_KIT_IDS.map(k => <option key={k} value={k}>{DRUM_KITS[k].label}</option>)}</select></label></div>
    <div className="grid-wrap">
      <div className="step-numbers"><span /> {Array.from({ length: 16 }, (_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div>
      {INSTRUMENTS.map(inst => {
        const muted = channels[inst].muted;
        return <div className={'instrument-row' + (muted ? ' is-muted' : '')} key={inst}>
          <div className="instrument-name"><span className={'inst-dot ' + inst} />{labels[inst]}
            <button className={'mute-btn' + (muted ? ' off' : '')} aria-pressed={!muted} aria-label={`${labels[inst]} ${muted ? 'off' : 'on'}`} title={muted ? 'Turn on' : 'Turn off'} onClick={() => onMute(inst, !muted)}>{muted ? 'OFF' : 'ON'}</button>
            <button className={'mute-btn solo' + (channels[inst].solo ? ' sel' : '')} aria-pressed={channels[inst].solo} aria-label={`Solo only ${labels[inst]}`} title={channels[inst].solo ? 'Hear everything again' : 'Hear only this instrument (all others are muted)'} onClick={() => onSolo(inst, !channels[inst].solo)}>SOLO</button>
          </div>
          {pattern[inst].map((on, i) => <button key={i} aria-label={`${inst} step ${i + 1}`} aria-pressed={on}
            className={`step ${on ? 'enabled ' + inst : ''} ${playingStep === i ? 'current' : ''} ${i % 4 === 0 ? 'beat' : ''}`} onClick={() => onToggle(inst, i)} />)}
        </div>;
      })}
    </div>
    <div className="grid-footer"><span>CLICK STEPS TO EDIT THE PATTERN</span><button onClick={onClear}>CLEAR ALL ↗</button></div>
  </section>;
}
