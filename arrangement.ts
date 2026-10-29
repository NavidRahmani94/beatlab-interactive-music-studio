// Arranging the song: moving and copying playlist slots, named sections (Intro, Verse, Chorus …) and ready-made song structures.
// Pure functions on plain data, so everything is easy to test and works with undo.
import { MAX_BARS, Playlist } from './song';

export type Section = { name: string; start: number; length: number };   // positions are playlist slots (0-based)
export const MAX_SECTIONS = 16;
export const MAX_SECTION_NAME = 20;

// ---------- slots ----------
const inRange = (pl: Playlist, i: number) => Number.isInteger(i) && i >= 0 && i < pl.length;
/** Moves what is in slot `from` to slot `to` (an occupied target swaps places). */
export function moveSlot(pl: Playlist, from: number, to: number): Playlist {
  if (!inRange(pl, from) || !inRange(pl, to) || from === to) return pl;
  const next = [...pl]; [next[from], next[to]] = [pl[to], pl[from]];
  return next;
}
/** Copies the content of slot `from` into slot `to`. */
export function copySlot(pl: Playlist, from: number, to: number): Playlist {
  if (!inRange(pl, from) || !inRange(pl, to) || from === to) return pl;
  const next = [...pl]; next[to] = pl[from];
  return next;
}
export function clearSlot(pl: Playlist, at: number): Playlist {
  if (!inRange(pl, at) || pl[at] === null) return pl;
  const next = [...pl]; next[at] = null;
  return next;
}
/** Adds an empty slot before `at`; everything after it moves one slot later. */
export function insertSlot(pl: Playlist, at: number): Playlist {
  if (pl.length >= MAX_BARS || !Number.isInteger(at) || at < 0 || at > pl.length) return pl;
  return [...pl.slice(0, at), null, ...pl.slice(at)];
}
/** Removes slot `at`; everything after it moves one slot earlier. */
export function removeSlot(pl: Playlist, at: number): Playlist {
  if (pl.length <= 1 || !inRange(pl, at)) return pl;
  return [...pl.slice(0, at), ...pl.slice(at + 1)];
}

// ---------- sections ----------
export const cleanSectionName = (name: string, fallback = 'Section'): string => name.replace(/\s+/g, ' ').trim().slice(0, MAX_SECTION_NAME) || fallback;

/** Keeps sections inside the playlist: later ones are dropped, ones that run past the end are shortened. */
export function clampSections(sections: Section[], bars: number): Section[] {
  return sections.filter(s => s.start < bars).map(s => (s.start + s.length > bars ? { ...s, length: bars - s.start } : s));
}
export function addSection(sections: Section[], start: number, length: number, name: string, bars: number): Section[] {
  if (sections.length >= MAX_SECTIONS || !Number.isInteger(start) || start < 0 || start >= bars) return sections;
  const len = Math.max(1, Math.min(Math.round(length) || 1, bars - start));
  return [...sections, { name: cleanSectionName(name), start, length: len }];
}
export const removeSection = (sections: Section[], index: number): Section[] => sections.filter((_, i) => i !== index);
export function updateSection(sections: Section[], index: number, patch: Partial<Section>, bars: number): Section[] {
  return clampSections(sections.map((s, i) => {
    if (i !== index) return s;
    const start = Math.max(0, Math.min(Math.round(patch.start ?? s.start), bars - 1));
    const length = Math.max(1, Math.round(patch.length ?? s.length));
    return { name: patch.name === undefined ? s.name : patch.name.slice(0, MAX_SECTION_NAME), start, length };
  }), bars);
}
/** The section that begins at this slot (for the label drawn on the slot), and the one that contains it (for its colour band). */
export const sectionStartingAt = (sections: Section[], bar: number): Section | undefined => sections.find(s => s.start === bar);
export const sectionIndexAt = (sections: Section[], bar: number): number => sections.findIndex(s => bar >= s.start && bar < s.start + s.length);

/** One section per run of the same pattern, named after the pattern (a quick way to label an existing arrangement). */
export function autoSections(patterns: { name: string }[], playlist: Playlist): Section[] {
  const out: Section[] = [];
  let i = 0;
  while (i < playlist.length && out.length < MAX_SECTIONS) {
    const p = playlist[i];
    let j = i + 1;
    while (j < playlist.length && playlist[j] === p) j++;
    if (p !== null && patterns[p]) out.push({ name: cleanSectionName(patterns[p].name), start: i, length: j - i });
    i = j;
  }
  return out;
}

// ---------- song structures ----------
export type Role = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
export const ROLES: Role[] = ['intro', 'verse', 'chorus', 'bridge', 'outro'];
export const ROLE_LABEL: Record<Role, string> = { intro: 'INTRO', verse: 'VERSE', chorus: 'CHORUS / HOOK', bridge: 'BRIDGE / BREAK', outro: 'OUTRO' };
type Part = { name: string; role: Role; length: number };
export const STRUCTURES: { id: string; label: string; parts: Part[] }[] = [
  { id: 'pop', label: 'Pop song (20 slots)', parts: [
    { name: 'Intro', role: 'intro', length: 2 }, { name: 'Verse', role: 'verse', length: 4 }, { name: 'Chorus', role: 'chorus', length: 4 },
    { name: 'Verse', role: 'verse', length: 4 }, { name: 'Chorus', role: 'chorus', length: 4 }, { name: 'Outro', role: 'outro', length: 2 }] },
  { id: 'hiphop', label: 'Hip hop (16 slots)', parts: [
    { name: 'Intro', role: 'intro', length: 2 }, { name: 'Verse', role: 'verse', length: 4 }, { name: 'Hook', role: 'chorus', length: 2 },
    { name: 'Verse', role: 'verse', length: 4 }, { name: 'Hook', role: 'chorus', length: 2 }, { name: 'Break', role: 'bridge', length: 1 }, { name: 'Outro', role: 'outro', length: 1 }] },
  { id: 'edm', label: 'Dance / EDM (32 slots)', parts: [
    { name: 'Intro', role: 'intro', length: 4 }, { name: 'Build', role: 'verse', length: 4 }, { name: 'Drop', role: 'chorus', length: 8 },
    { name: 'Break', role: 'bridge', length: 4 }, { name: 'Drop', role: 'chorus', length: 8 }, { name: 'Outro', role: 'outro', length: 4 }] },
  { id: 'short', label: 'Short loop (6 slots)', parts: [
    { name: 'Intro', role: 'intro', length: 1 }, { name: 'Verse', role: 'verse', length: 2 }, { name: 'Chorus', role: 'chorus', length: 2 }, { name: 'Outro', role: 'outro', length: 1 }] }
];

const KEYWORDS: Record<Role, RegExp> = {
  intro: /intro|start|begin/i, verse: /verse|groove|main|build/i, chorus: /chorus|hook|drop|refrain/i, bridge: /bridge|break|middle|bridge/i, outro: /outro|end|fade/i
};
/** Which pattern plays which part: by the pattern's name when it says so, otherwise spread over the patterns in order. */
export function guessRoles(patterns: { name: string }[]): Record<Role, number> {
  const out = {} as Record<Role, number>;
  const used = new Set<number>();
  ROLES.forEach(r => { const i = patterns.findIndex((p, k) => !used.has(k) && KEYWORDS[r].test(p.name)); if (i >= 0) { out[r] = i; used.add(i); } });
  let next = 0;
  ROLES.forEach(r => { if (out[r] === undefined) { out[r] = patterns.length ? next % patterns.length : 0; next++; } });
  return out;
}
/** The playlist and the section labels of a structure, with the chosen pattern for each role (null = leave those slots empty). */
export function buildStructure(id: string, assign: Record<Role, number | null>): { playlist: Playlist; sections: Section[] } | null {
  const s = STRUCTURES.find(x => x.id === id);
  if (!s) return null;
  const playlist: Playlist = []; const sections: Section[] = [];
  for (const part of s.parts) {
    if (playlist.length + part.length > MAX_BARS) break;
    sections.push({ name: part.name, start: playlist.length, length: part.length });
    for (let i = 0; i < part.length; i++) playlist.push(assign[part.role] ?? null);
  }
  return { playlist, sections };
}
