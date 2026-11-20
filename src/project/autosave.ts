// Automatic copy of the unsaved project in the browser (localStorage), so a crash or a closed tab does not lose work.
// Everything is wrapped in try/catch: private windows or blocked storage must never break the app.
export const AUTOSAVE_KEY = 'beatlab.autosave.v1';
export type AutosaveStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Autosave = { json: string; savedAt: number };

const defaultStore = (): AutosaveStore | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function saveAutosave(json: string, now: number = Date.now(), store: AutosaveStore | null = defaultStore()): boolean {
  if (!store) return false;
  try { store.setItem(AUTOSAVE_KEY, JSON.stringify({ json, savedAt: now })); return true; } catch { return false; }
}
export function readAutosave(store: AutosaveStore | null = defaultStore()): Autosave | null {
  if (!store) return null;
  try {
    const raw = store.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { json, savedAt } = v as Record<string, unknown>;
    return typeof json === 'string' && typeof savedAt === 'number' && Number.isFinite(savedAt) ? { json, savedAt } : null;
  } catch { return null; }
}
export function clearAutosave(store: AutosaveStore | null = defaultStore()): void {
  if (!store) return;
  try { store.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}
