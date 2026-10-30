import { useState } from 'react';
import { MAX_BARS, MAX_PATTERNS, PatternData, PlayMode, Playlist } from './song';
import { MAX_SECTIONS, MAX_SECTION_NAME, ROLES, ROLE_LABEL, Role, STRUCTURES, Section, addSection, autoSections, buildStructure, guessRoles, removeSection, sectionIndexAt, sectionStartingAt, updateSection } from './arrangement';

type Props = {
  patterns: PatternData[];
  playlist: Playlist;
  current: number;
  mode: PlayMode;
  playing: boolean;
  playBar: number;          // bar being played (SONG mode), -1 when stopped
  playPattern: number | null;
  onSelect: (index: number) => void;
  onAudition: (index: number) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onSlot: (bar: number) => void;
  onBars: (bars: number) => void;
  onClearBars: () => void;
  onMode: (mode: PlayMode) => void;
  sections: Section[];
  onSections: (sections: Section[]) => void;
  onBuild: (playlist: Playlist, sections: Section[]) => void;
  onDropPattern: (bar: number, pattern: number) => void;
  onMoveSlot: (from: number, to: number, copy: boolean) => void;
  onClearSlot: (bar: number) => void;
  onInsertSlot: (at: number) => void;
  onRemoveSlot: (at: number) => void;
};

const COLORS = ['#7cf0c2', '#9db4ff', '#ffb86b', '#ff8fb1', '#d9ff71', '#c8a1ff', '#89d7ff', '#ffd36b'];
export const patternColor = (i: number): string => COLORS[i % COLORS.length];

/** Patterns (32 steps each) + the playlist that places them in slots so a song can be as long as you like. */
export default function PlaylistPanel(p: Props) {
  const song = p.mode === 'song';
  const [cursor, setCursor] = useState(0);
  const [over, setOver] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [structure, setStructure] = useState(STRUCTURES[0].id);
  const [roles, setRoles] = useState<Record<Role, number | null> | null>(null);
  const bars = p.playlist.length;
  const at = Math.min(cursor, bars - 1);
  const tpl = STRUCTURES.find(x => x.id === structure) ?? STRUCTURES[0];
  const used = ROLES.filter(r => tpl.parts.some(x => x.role === r));
  const assign: Record<Role, number | null> = roles ?? guessRoles(p.patterns);
  const SECTION_COLORS = ['#7cf0c2', '#9db4ff', '#ffb86b', '#ff8fb1', '#c8a1ff', '#89d7ff'];
  return <section className="panel playlist" aria-label="Patterns and playlist">
    <div className="panel-label">PATTERNS &amp; PLAYLIST <span>{p.playlist.length} SLOT{p.playlist.length > 1 ? 'S' : ''} · {song ? 'PLAYING THE WHOLE SONG' : 'LOOPING ONE PATTERN'}</span></div>
    <div className="melody-controls">
      <div className="ctl">PLAY
        <div className="seg" role="group" aria-label="Play mode">
          <button aria-pressed={!song} className={!song ? 'sel' : ''} title="Loop only the selected pattern" onClick={() => p.onMode('pattern')}>PATTERN</button>
          <button aria-pressed={song} className={song ? 'sel' : ''} title="Play the playlist from bar 1 to the end, then loop" onClick={() => p.onMode('song')}>SONG</button>
        </div>
      </div>
      <div className="ctl grow">PATTERNS (click to edit — the editor above shows the selected one)
        <div className="chips" role="group" aria-label="Patterns">
          {p.patterns.map((pat, i) => {
            const auditioning = p.playing && !song && i === p.current;
            return <span key={i} className={'chip-group' + (i === p.current ? ' sel' : '')} style={{ ['--c' as string]: patternColor(i) }}>
              <button className={'chip' + (i === p.current ? ' sel' : '')} aria-pressed={i === p.current} aria-label={`Select pattern ${pat.name}`} draggable title="Drag onto a playlist slot to place it" onDragStart={e => { e.dataTransfer.setData('text/beatlab-pattern', String(i)); e.dataTransfer.effectAllowed = 'copy'; setDragging(true); }} onDragEnd={() => { setDragging(false); setOver(null); }} onClick={() => p.onSelect(i)}><i />{pat.name}</button>
              <button className={'chip-play' + (auditioning ? ' on' : '')} aria-label={`${auditioning ? 'Stop' : 'Play'} pattern ${pat.name} alone`} title={auditioning ? 'Stop' : 'Listen to this pattern alone (loops it)'} onClick={() => p.onAudition(i)}>{auditioning ? '■' : '▶'}</button>
            </span>;
          })}
        </div>
      </div>
      <label className="ctl">NAME
        <input className="name-input short" aria-label="Pattern name" value={p.patterns[p.current]?.name ?? ''} maxLength={24} onChange={e => p.onRename(e.target.value)} />
      </label>
      <div className="seg" role="group" aria-label="Pattern actions">
        <button aria-label="New pattern" disabled={p.patterns.length >= MAX_PATTERNS} onClick={p.onNew}>+ NEW</button>
        <button aria-label="Duplicate pattern" disabled={p.patterns.length >= MAX_PATTERNS} onClick={p.onDuplicate}>DUPLICATE</button>
        <button aria-label="Delete pattern" disabled={p.patterns.length <= 1} onClick={p.onDelete}>DELETE</button>
      </div>
    </div>
    <div className="playlist-body">
      <div className="slots" role="group" aria-label="Playlist slots">
        {p.playlist.map((slot, bar) => {
          const active = p.playing && song && p.playBar === bar;
          const sec = sectionStartingAt(p.sections, bar); const si = sectionIndexAt(p.sections, bar);
          return <button key={bar} aria-label={`Playlist slot ${bar + 1}${slot === null ? ' empty' : ` ${p.patterns[slot]?.name ?? ''}`}`}
            className={'slot' + (slot === null ? ' empty' : '') + (active ? ' playing' : '') + (over === bar ? ' over' : '') + (bar === at ? ' cursor' : '') + (si >= 0 ? ' in-section' : '')}
            style={{ ...(slot === null ? {} : { ['--c' as string]: patternColor(slot) }), ...(si >= 0 ? { ['--sec' as string]: SECTION_COLORS[si % SECTION_COLORS.length] } : {}) }}
            draggable={slot !== null} onDragStart={e => { e.dataTransfer.setData('text/beatlab-slot', String(bar)); e.dataTransfer.effectAllowed = 'copyMove'; setDragging(true); }} onDragEnd={() => { setDragging(false); setOver(null); }}
            onDragOver={e => { if (dragging) { e.preventDefault(); setOver(bar); } }} onDragLeave={() => setOver(o => (o === bar ? null : o))}
            onDrop={e => {
              e.preventDefault(); setOver(null); setDragging(false);
              const pat = e.dataTransfer.getData('text/beatlab-pattern'); const from = e.dataTransfer.getData('text/beatlab-slot');
              if (pat !== '') p.onDropPattern(bar, Number(pat)); else if (from !== '') p.onMoveSlot(Number(from), bar, e.altKey || e.ctrlKey);
              setCursor(bar);
            }}
            title={slot === null ? `Slot ${bar + 1}: click to place “${p.patterns[p.current]?.name}”` : `Slot ${bar + 1}: ${p.patterns[slot]?.name} (click again with the same pattern selected to clear)`}
            onClick={() => { setCursor(bar); p.onSlot(bar); }}>
            {sec && <small className="sec-tag">{sec.name}</small>}<b>{bar + 1}</b><span>{slot === null ? '—' : p.patterns[slot]?.name}</span>
          </button>;
        })}
      </div>
      <div className="seg" role="group" aria-label="Playlist length">
        <button aria-label="Remove slot" disabled={p.playlist.length <= 1} onClick={() => p.onBars(p.playlist.length - 1)}>− SLOT</button>
        <button aria-label="Add slot" disabled={p.playlist.length >= MAX_BARS} onClick={() => p.onBars(p.playlist.length + 1)}>+ SLOT</button>
        <button aria-label="Clear playlist" onClick={p.onClearBars}>CLEAR</button>
      </div>
      <div className="seg" role="group" aria-label="Slot tools">
        <button aria-label="Insert slot" disabled={bars >= MAX_BARS} title={`Add an empty slot before slot ${at + 1}; the rest moves later`} onClick={() => p.onInsertSlot(at)}>⏎ INSERT BEFORE {at + 1}</button>
        <button aria-label="Delete slot" disabled={bars <= 1} title={`Remove slot ${at + 1}; the rest moves earlier`} onClick={() => p.onRemoveSlot(at)}>✂ REMOVE {at + 1}</button>
      </div>
      <span className={'bin' + (dragging ? ' show' : '')} onDragOver={e => { if (dragging) e.preventDefault(); }} onDrop={e => { e.preventDefault(); setDragging(false); const from = e.dataTransfer.getData('text/beatlab-slot'); if (from !== '') p.onClearSlot(Number(from)); }}>🗑 DROP A SLOT HERE TO CLEAR IT</span>
    </div>
    <div className="structure">
      <button className="auto-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'} 🎼 SONG STRUCTURE &amp; SECTIONS</button>
      {open && <div className="structure-body">
        <div className="melody-controls">
          <label className="ctl">STRUCTURE
            <select aria-label="Song structure" value={structure} onChange={e => setStructure(e.target.value)}>{STRUCTURES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          </label>
          {used.map(r => <label key={r} className="ctl">{ROLE_LABEL[r]}
            <select aria-label={`Pattern for ${r}`} value={assign[r] ?? ''} onChange={e => setRoles({ ...assign, [r]: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">(empty)</option>{p.patterns.map((pat, i) => <option key={i} value={i}>{pat.name}</option>)}
            </select>
          </label>)}
          <button className="auto-btn" aria-label="Build arrangement" title="Replaces the playlist and the section names (Undo brings the old one back)" onClick={() => { const r = buildStructure(structure, assign); if (r) p.onBuild(r.playlist, r.sections); }}>BUILD ARRANGEMENT</button>
        </div>
        <div className="melody-controls second" role="group" aria-label="Sections">
          {p.sections.length === 0 && <span className="hint">No sections yet. They are only labels on the slots (Intro, Verse, Chorus …).</span>}
          {p.sections.map((s, i) => <span key={i} className="section-edit">
            <input className="name-input short" aria-label={`Section ${i + 1} name`} value={s.name} maxLength={MAX_SECTION_NAME} onChange={e => p.onSections(updateSection(p.sections, i, { name: e.target.value }, bars))} />
            <select aria-label={`Section ${i + 1} start`} value={s.start} onChange={e => p.onSections(updateSection(p.sections, i, { start: Number(e.target.value) }, bars))}>{Array.from({ length: bars }, (_, k) => <option key={k} value={k}>from {k + 1}</option>)}</select>
            <select aria-label={`Section ${i + 1} length`} value={s.length} onChange={e => p.onSections(updateSection(p.sections, i, { length: Number(e.target.value) }, bars))}>{Array.from({ length: bars - s.start }, (_, k) => <option key={k} value={k + 1}>{k + 1} slot{k ? 's' : ''}</option>)}</select>
            <button className="chip-play" aria-label={`Remove section ${s.name}`} onClick={() => p.onSections(removeSection(p.sections, i))}>×</button>
          </span>)}
          <button className="auto-btn" disabled={p.sections.length >= MAX_SECTIONS} onClick={() => p.onSections(addSection(p.sections, at, 1, 'Section', bars))}>＋ SECTION AT {at + 1}</button>
          <button className="auto-btn" title="One section per run of the same pattern, named after it" onClick={() => p.onSections(autoSections(p.patterns, p.playlist))}>NAME FROM PATTERNS</button>
        </div>
      </div>}
    </div>
    <div className="grid-footer"><span>▶ NEXT TO A PATTERN = LISTEN TO IT ALONE · DRAG A PATTERN ONTO A SLOT (ALT = COPY WHEN DRAGGING A SLOT) · OR SELECT A PATTERN AND CLICK SLOTS · CLICK AGAIN TO CLEAR · PRESS SONG, THEN PLAY</span><span>{p.patterns.length}/{MAX_PATTERNS} PATTERNS · {MAX_BARS} SLOTS MAX · EACH SLOT = ONE 32-STEP PATTERN</span></div>
  </section>;
}
