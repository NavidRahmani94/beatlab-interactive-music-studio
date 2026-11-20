// FILE: Plain helpers for the Inspect mode: read the file and line from an element, name the folders, split the event handlers. No page code here, so it can be tested.
export type FileNode = { lines: number; desc: string; imports: string[]; usedBy: string[]; tests: string[]; libs: string[] };
export type Graph = { files: Record<string, FileNode> };

/** What each folder of src/ is for (same words as the table in the README). */
export const FOLDER_INFO: Record<string, string> = {
  '': 'The main page. It holds the whole project state and connects all the parts.',
  audio: 'Sound: the two sound engines, instruments, effects and the mixer.',
  music: 'Music logic: chords, melodies, arpeggiator, drum patterns, groove, tuning.',
  project: 'The project itself: tracks, song, timeline, undo, autosave, MIDI files.',
  input: 'Input: computer keyboard, MIDI keyboard and hand tracking.',
  export: 'Saving a song as WAV, MP3 or MIDI.',
  shape: 'The Shape Lab: shapes that make music.',
  ui: 'Screens and panels: piano roll, mixer, drums, timeline, theme.',
  styles: 'Colours, fonts and page style.',
};

/** "ui/PianoRoll.tsx:120" -> { file: 'ui/PianoRoll.tsx', line: 120 } */
export function parseSrc(v: string | null | undefined): { file: string; line: number } | null {
  if (!v) return null;
  const i = v.lastIndexOf(':');
  if (i < 1) return null;
  const line = Number(v.slice(i + 1));
  return Number.isFinite(line) ? { file: v.slice(0, i), line } : null;
}

/** Folder name of a file inside src/ ('' for the files that sit directly in src/). */
export function folderOf(file: string): string { const i = file.lastIndexOf('/'); return i < 0 ? '' : file.slice(0, i); }
export function folderInfo(file: string): string { return FOLDER_INFO[folderOf(file)] ?? ''; }
export const fullPath = (file: string): string => 'src/' + file;
export const fileName = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

/** "onClick={play} | onChange={...}" -> ['onClick={play}', 'onChange={...}'] */
export function splitHandlers(v: string | null | undefined): string[] { return v ? v.split(' | ').map(s => s.trim()).filter(Boolean) : []; }

/** Short name of what was clicked: aria-label, title or the visible text. */
export function labelOf(el: { tagName: string; getAttribute(n: string): string | null; textContent: string | null }): string {
  const t = el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').trim().replace(/\s+/g, ' ');
  return (el.tagName.toLowerCase() + (t ? ' "' + t.slice(0, 40) + '"' : ''));
}
