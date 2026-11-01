import { Fragment, useEffect, useRef, useState } from 'react';
import { FX_IDS, FX_TYPES, FxType, MAX_FX, addFx, isFxType, moveFx, patchFx, removeFx } from './fx';
import PanKnob from './PanKnob';
import {
  channelGroups, channelLabel, defaultChannel, ChannelName, ChannelSettings, Channels, DELAY_DIVISIONS, DelayDivision, MAX_FEEDBACK, MasterSettings,
  REVERB_SIZES, ReverbSize, VOLUME_MAX_DB, VOLUME_MIN_DB, EQ_MAX_DB, EQ_MIN_DB
} from './mixer';
import { TrackDef } from './tracks';

type Props = {
  channels: Channels;
  tracks: TrackDef[];
  master: MasterSettings;
  onChannel: (name: ChannelName, patch: Partial<ChannelSettings>) => void;
  onMaster: (patch: Partial<MasterSettings>) => void;
  getLevelDb: () => number;
  getChannelLevels: (name: string) => [number, number];
  playing: boolean;
};

const fmtDb = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;
const fmtPan = (p: number) => (Math.abs(p) < 0.02 ? 'C' : p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`);

export default function MixerPanel({ channels, tracks, master, onChannel, onMaster, getLevelDb, getChannelLevels, playing }: Props) {
  const mixRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<HTMLSpanElement>(null);
  const [fxOpen, setFxOpen] = useState<Record<string, boolean>>({});

  // animate the master level meter without re-rendering React
  useEffect(() => {
    let raf = 0;
    let peak = -60;
    const tick = () => {
      const db = playing ? getLevelDb() : -Infinity;
      const shown = Number.isFinite(db) ? Math.max(-60, db) : -60;
      peak = Math.max(shown, peak - 0.4);
      if (meterRef.current) meterRef.current.style.width = `${((shown + 60) / 60) * 100}%`;
      if (peakRef.current) peakRef.current.style.left = `${((peak + 60) / 60) * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getLevelDb]);

  // animate the L / R signal meters of every channel (straight on the DOM, no React re-render)
  useEffect(() => {
    const peaks = new Map<string, number>(); let raf = 0;
    const tick = () => {
      mixRef.current?.querySelectorAll<HTMLElement>('.lvl[data-ch]').forEach(el => {
        const name = el.dataset.ch as string; const lv = playing ? getChannelLevels(name) : [-Infinity, -Infinity];
        [0, 1].forEach(i => {
          const db = Number.isFinite(lv[i]) ? Math.max(-60, lv[i]) : -60; const key = name + i;
          const pk = Math.max(db, (peaks.get(key) ?? -60) - 0.5); peaks.set(key, pk);
          const fill = el.querySelector<HTMLElement>(`.lvl-bar.b${i} i`); const peak = el.querySelector<HTMLElement>(`.lvl-bar.b${i} u`);
          if (fill) fill.style.width = `${((db + 60) / 60) * 100}%`;
          if (peak) peak.style.left = `${((pk + 60) / 60) * 100}%`;
        });
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getChannelLevels]);

  return <section className="panel mixer">
    <div className="panel-label">MIXER <span>{4 + tracks.length} CHANNELS → ONE MASTER (EQ · COMPRESSOR · REVERB · DELAY)</span></div>
    <div className="mixer-body" ref={mixRef}>
      <div className="mix-row mix-head"><span /><span>M / S</span><span>PAN</span><span>VOLUME</span><span>REVERB SEND</span><span>DELAY SEND</span><span>SIGNAL L / R</span></div>
      {channelGroups(tracks).flatMap(g => g.channels.map((name, idx) => ({ name, group: idx === 0 ? g.label : null, kind: g.kind }))).map(({ name, group, kind }) => {
        const c = channels[name] ?? defaultChannel(name, kind === 'drums' ? undefined : kind);
        const label = channelLabel(name, tracks);
        return <Fragment key={name}>{group && <div className="mix-group">{group}</div>}<div className={'mix-row' + (c.muted ? ' is-muted' : '')}>
          <div className="instrument-name"><span className={'inst-dot ' + (kind === 'drums' ? name : kind)} />{label}
            <button className={'fx-btn' + ((c.fx?.length ?? 0) > 0 ? ' has' : '') + (fxOpen[name] ? ' open' : '')} aria-expanded={!!fxOpen[name]} aria-label={`${label} effects`} title="Insert effects for this channel (chorus, phaser, distortion …)" onClick={() => setFxOpen(o => ({ ...o, [name]: !o[name] }))}>FX{(c.fx?.length ?? 0) > 0 ? ` ${c.fx!.length}` : ''}</button></div>
          <div className="seg small" role="group" aria-label={`${label} mute and solo`}>
            <button className={c.muted ? 'sel warn' : ''} aria-pressed={c.muted} aria-label={`${label} mixer ${c.muted ? 'muted' : 'on'}`} title="Mute" onClick={() => onChannel(name, { muted: !c.muted })}>M</button>
            <button className={c.solo ? 'sel' : ''} aria-pressed={c.solo} aria-label={`${label} solo`} title="Solo" onClick={() => onChannel(name, { solo: !c.solo })}>S</button>
          </div>
          <div className="fader knob-cell"><PanKnob label={`${label} pan`} value={c.pan} onChange={pan => onChannel(name, { pan })} /><b>{fmtPan(c.pan)}</b></div>
          <label className="fader"><input type="range" min={VOLUME_MIN_DB} max={VOLUME_MAX_DB} step={1} value={c.volumeDb} aria-label={`${label} volume`}
            onChange={e => onChannel(name, { volumeDb: Number(e.target.value) })} onDoubleClick={() => onChannel(name, { volumeDb: 0 })} /><b>{fmtDb(c.volumeDb)}</b></label>
          <label className="fader"><input type="range" min={0} max={100} step={1} value={Math.round(c.reverbSend * 100)} aria-label={`${label} reverb send`}
            onChange={e => onChannel(name, { reverbSend: Number(e.target.value) / 100 })} /><b>{Math.round(c.reverbSend * 100)}%</b></label>
          <label className="fader"><input type="range" min={0} max={100} step={1} value={Math.round(c.delaySend * 100)} aria-label={`${label} delay send`}
            onChange={e => onChannel(name, { delaySend: Number(e.target.value) / 100 })} /><b>{Math.round(c.delaySend * 100)}%</b></label>
          <div className="lvl" data-ch={name} role="img" aria-label={`${label} signal level, left and right`}>
            <div className="lvl-bar b0"><em>L</em><span><i /><u /></span></div>
            <div className="lvl-bar b1"><em>R</em><span><i /><u /></span></div>
          </div>
        </div>
          {fxOpen[name] && <div className="mix-fx" role="group" aria-label={`${label} effects`}>
            {(c.fx ?? []).length === 0 && <div className="fx-empty">No effects yet. Add one below (up to {MAX_FX}). They run in order, top to bottom, before pan and the reverb / delay sends.</div>}
            {(c.fx ?? []).map((f, i, all) => <div className={'fx-slot' + (f.on ? '' : ' off')} key={f.id}>
              <span className="fx-move"><button aria-label={`Move ${FX_TYPES[f.type].label} up`} disabled={i === 0} onClick={() => onChannel(name, { fx: moveFx(c.fx, f.id, -1) })}>▲</button><button aria-label={`Move ${FX_TYPES[f.type].label} down`} disabled={i === all.length - 1} onClick={() => onChannel(name, { fx: moveFx(c.fx, f.id, 1) })}>▼</button></span>
              <select aria-label={`${label} effect ${i + 1} type`} title={FX_TYPES[f.type].hint} value={f.type} onChange={e => isFxType(e.target.value) && onChannel(name, { fx: patchFx(c.fx, f.id, { type: e.target.value }) })}>
                {FX_IDS.map(t => <option key={t} value={t}>{FX_TYPES[t].label}</option>)}
              </select>
              <label className="fader"><input type="range" min={0} max={100} step={1} value={Math.round(f.amount * 100)} aria-label={`${label} effect ${i + 1} amount`} onChange={e => onChannel(name, { fx: patchFx(c.fx, f.id, { amount: Number(e.target.value) / 100 }) })} /><b>{Math.round(f.amount * 100)}%</b></label>
              <button className={'fx-on' + (f.on ? ' sel' : '')} aria-pressed={f.on} aria-label={`${label} effect ${i + 1} ${f.on ? 'on' : 'bypassed'}`} title="Switch this effect on or off" onClick={() => onChannel(name, { fx: patchFx(c.fx, f.id, { on: !f.on }) })}>{f.on ? 'ON' : 'OFF'}</button>
              <button className="fx-del" aria-label={`Remove ${FX_TYPES[f.type].label} from ${label}`} title="Remove this effect" onClick={() => onChannel(name, { fx: removeFx(c.fx, f.id) })}>✕</button>
            </div>)}
            <select className="fx-add" aria-label={`Add effect to ${label}`} value="" disabled={(c.fx?.length ?? 0) >= MAX_FX} onChange={e => { const t = e.target.value as FxType; if (isFxType(t)) onChannel(name, { fx: addFx(c.fx, t) }); }}>
              <option value="">{(c.fx?.length ?? 0) >= MAX_FX ? `Most ${MAX_FX} effects` : '＋ ADD EFFECT…'}</option>
              {FX_IDS.map(t => <option key={t} value={t}>{FX_TYPES[t].label} — {FX_TYPES[t].hint}</option>)}
            </select>
          </div>}
        </Fragment>;
      })}
    </div>

    <div className="master">
      <div className="master-title">MASTER <span>everything passes through here</span></div>
      <div className="master-grid">
        <label className="ctl">MASTER VOLUME
          <span className="fader"><input type="range" min={VOLUME_MIN_DB} max={VOLUME_MAX_DB} step={1} value={master.volumeDb} aria-label="Master volume"
            onChange={e => onMaster({ volumeDb: Number(e.target.value) })} onDoubleClick={() => onMaster({ volumeDb: 0 })} /><b>{fmtDb(master.volumeDb)}</b></span>
        </label>
        <label className="ctl">MASTER REVERB
          <span className="fader"><input type="range" min={0} max={100} step={1} value={Math.round(master.reverbMix * 100)} aria-label="Master reverb amount"
            onChange={e => onMaster({ reverbMix: Number(e.target.value) / 100 })} /><b>{Math.round(master.reverbMix * 100)}%</b></span>
        </label>
        <label className="ctl">REVERB SIZE
          <select value={master.reverbSize} aria-label="Master reverb size" onChange={e => onMaster({ reverbSize: e.target.value as ReverbSize })}>
            {(Object.keys(REVERB_SIZES) as ReverbSize[]).map(k => <option key={k} value={k}>{REVERB_SIZES[k].label}</option>)}
          </select>
        </label>
        <label className="ctl">DELAY TIME
          <select value={master.delayDivision} aria-label="Delay time" onChange={e => onMaster({ delayDivision: e.target.value as DelayDivision })}>
            {(Object.keys(DELAY_DIVISIONS) as DelayDivision[]).map(k => <option key={k} value={k}>{DELAY_DIVISIONS[k].label}</option>)}
          </select>
        </label>
        <label className="ctl">DELAY FEEDBACK
          <span className="fader"><input type="range" min={0} max={MAX_FEEDBACK * 100} step={1} value={Math.round(master.delayFeedback * 100)} aria-label="Delay feedback"
            onChange={e => onMaster({ delayFeedback: Number(e.target.value) / 100 })} /><b>{Math.round(master.delayFeedback * 100)}%</b></span>
        </label>
        <label className="ctl">EQ LOW (bass)
          <span className="fader"><input type="range" min={EQ_MIN_DB} max={EQ_MAX_DB} step={1} value={master.eqLow} aria-label="Master EQ low"
            onChange={e => onMaster({ eqLow: Number(e.target.value) })} onDoubleClick={() => onMaster({ eqLow: 0 })} /><b>{fmtDb(master.eqLow)}</b></span>
        </label>
        <label className="ctl">EQ MID
          <span className="fader"><input type="range" min={EQ_MIN_DB} max={EQ_MAX_DB} step={1} value={master.eqMid} aria-label="Master EQ mid"
            onChange={e => onMaster({ eqMid: Number(e.target.value) })} onDoubleClick={() => onMaster({ eqMid: 0 })} /><b>{fmtDb(master.eqMid)}</b></span>
        </label>
        <label className="ctl">EQ HIGH (treble)
          <span className="fader"><input type="range" min={EQ_MIN_DB} max={EQ_MAX_DB} step={1} value={master.eqHigh} aria-label="Master EQ high"
            onChange={e => onMaster({ eqHigh: Number(e.target.value) })} onDoubleClick={() => onMaster({ eqHigh: 0 })} /><b>{fmtDb(master.eqHigh)}</b></span>
        </label>
        <label className="ctl">COMPRESSOR (glue)
          <span className="fader"><input type="range" min={0} max={100} step={1} value={Math.round(master.compAmount * 100)} aria-label="Master compressor"
            onChange={e => onMaster({ compAmount: Number(e.target.value) / 100 })} /><b>{master.compAmount === 0 ? 'OFF' : `${Math.round(master.compAmount * 100)}%`}</b></span>
        </label>
        <div className="ctl">LEVEL
          <div className="meter" aria-label="Master level meter" role="img"><div className="meter-fill" ref={meterRef} /><span className="meter-peak" ref={peakRef} /></div>
        </div>
      </div>
    </div>
  </section>;
}
