import { MAX_BARS, MAX_PATTERNS, PatternData, PlayMode, Playlist } from './song';

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
};

const COLORS = ['#7cf0c2', '#9db4ff', '#ffb86b', '#ff8fb1', '#d9ff71', '#c8a1ff', '#89d7ff', '#ffd36b'];
export const patternColor = (i: number): string => COLORS[i % COLORS.length];

/** Patterns (32 steps each) + the playlist that places them in slots so a song can be as long as you like. */
export default function PlaylistPanel(p: Props) {
  const song = p.mode === 'song';
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
              <button className={'chip' + (i === p.current ? ' sel' : '')} aria-pressed={i === p.current} aria-label={`Select pattern ${pat.name}`} onClick={() => p.onSelect(i)}><i />{pat.name}</button>
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
          return <button key={bar} aria-label={`Playlist slot ${bar + 1}${slot === null ? ' empty' : ` ${p.patterns[slot]?.name ?? ''}`}`}
            className={'slot' + (slot === null ? ' empty' : '') + (active ? ' playing' : '')} style={slot === null ? undefined : { ['--c' as string]: patternColor(slot) }}
            title={slot === null ? `Slot ${bar + 1}: click to place “${p.patterns[p.current]?.name}”` : `Slot ${bar + 1}: ${p.patterns[slot]?.name} (click again with the same pattern selected to clear)`}
            onClick={() => p.onSlot(bar)}>
            <b>{bar + 1}</b><span>{slot === null ? '—' : p.patterns[slot]?.name}</span>
            {active && <em className="progress" />}
          </button>;
        })}
      </div>
      <div className="seg" role="group" aria-label="Playlist length">
        <button aria-label="Remove slot" disabled={p.playlist.length <= 1} onClick={() => p.onBars(p.playlist.length - 1)}>− SLOT</button>
        <button aria-label="Add slot" disabled={p.playlist.length >= MAX_BARS} onClick={() => p.onBars(p.playlist.length + 1)}>+ SLOT</button>
        <button aria-label="Clear playlist" onClick={p.onClearBars}>CLEAR</button>
      </div>
    </div>
    <div className="grid-footer"><span>▶ NEXT TO A PATTERN = LISTEN TO IT ALONE · SELECT A PATTERN, THEN CLICK SLOTS TO PLACE IT · CLICK AGAIN TO CLEAR · PRESS SONG, THEN PLAY</span><span>{p.patterns.length}/{MAX_PATTERNS} PATTERNS · {MAX_BARS} SLOTS MAX · EACH SLOT = ONE 32-STEP PATTERN</span></div>
  </section>;
}
