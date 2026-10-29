import { useRef } from 'react';
import { SAMPLE_PROJECTS } from './project';
import { EXPORT_FORMATS, ExportFormat, isExportFormat } from './exporter';

type Props = {
  name: string;
  onName: (name: string) => void;
  dirty: boolean;
  exporting: boolean;
  loops: number;
  unit: string;
  format: ExportFormat;
  onFormat: (format: ExportFormat) => void;
  onLoops: (loops: number) => void;
  onNew: () => void;
  onOpenFile: (file: File) => void;
  onSave: () => void;
  onSample: (name: string) => void;
  onExport: () => void;
};

export default function ProjectBar(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  return <section className="panel projectbar">
    <div className="panel-label">PROJECT <span>{p.dirty ? '● UNSAVED CHANGES' : 'ALL CHANGES SAVED'}</span></div>
    <div className="project-controls">
      <label className="ctl grow">NAME
        <input className="name-input" value={p.name} maxLength={80} aria-label="Project name" onChange={e => p.onName(e.target.value)} />
      </label>
      <div className="seg" role="group" aria-label="Project actions">
        <button onClick={p.onNew}>NEW</button>
        <button onClick={() => fileRef.current?.click()}>OPEN</button>
        <button onClick={p.onSave}>SAVE</button>
      </div>
      <input ref={fileRef} type="file" accept=".json,.beatlab.json,application/json" hidden aria-label="Open project file"
        onChange={e => { const f = e.target.files?.[0]; if (f) p.onOpenFile(f); e.target.value = ''; }} />
      <label className="ctl">SAMPLE
        <select value="" aria-label="Load sample project" onChange={e => { if (e.target.value) p.onSample(e.target.value); }}>
          <option value="">Load sample…</option>
          {Object.keys(SAMPLE_PROJECTS).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="ctl">EXPORT LENGTH
        <select value={p.loops} aria-label="Export length" onChange={e => p.onLoops(Number(e.target.value))}>
          {[1, 2, 4, 8].map(n => <option key={n} value={n}>{n} {p.unit}{n > 1 ? 's' : ''}</option>)}
        </select>
      </label>
 <label className="ctl">FORMAT
        <select value={p.format} aria-label="Export format" onChange={e => { if (isExportFormat(e.target.value)) p.onFormat(e.target.value); }}>
          {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map(f => <option key={f} value={f}>{EXPORT_FORMATS[f].label}</option>)}
        </select>
      </label>
      <button className="export-btn" disabled={p.exporting} onClick={p.onExport}>{p.exporting ? 'RENDERING…' : `⬇ EXPORT ${EXPORT_FORMATS[p.format].ext.toUpperCase()}`}</button>
    </div>
  </section>;
}
