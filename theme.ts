// Light / dark / follow-the-system theme. The choice is remembered in this browser (storage may be blocked, so every access is guarded).
export type ThemeChoice = 'auto' | 'dark' | 'light';
export const THEME_KEY = 'beatlab.theme';
export const THEME_ORDER: ThemeChoice[] = ['auto', 'dark', 'light'];
export const THEME_LABEL: Record<ThemeChoice, string> = { auto: '◐ AUTO', dark: '☾ DARK', light: '☀ LIGHT' };
export const isThemeChoice = (v: unknown): v is ThemeChoice => v === 'auto' || v === 'dark' || v === 'light';
export const nextTheme = (t: ThemeChoice): ThemeChoice => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): 'dark' | 'light' => choice === 'auto' ? (systemDark ? 'dark' : 'light') : choice;

export function loadTheme(): ThemeChoice {
  try { const v = localStorage.getItem(THEME_KEY); return isThemeChoice(v) ? v : 'auto'; } catch { return 'auto'; }
}
export function saveTheme(t: ThemeChoice): void { try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: the choice just is not remembered */ } }
export function systemPrefersDark(): boolean {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return true; }
}
export function applyTheme(choice: ThemeChoice): 'dark' | 'light' {
  const resolved = resolveTheme(choice, systemPrefersDark());
  document.documentElement.dataset.theme = resolved;
  return resolved;
}
