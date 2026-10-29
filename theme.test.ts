import { describe, expect, it } from 'vitest';
import { THEME_ORDER, isThemeChoice, nextTheme, resolveTheme } from './theme';

describe('theme', () => {
  it('cycles auto -> dark -> light -> auto', () => {
    expect(THEME_ORDER.map((_, i) => THEME_ORDER[i])).toEqual(['auto', 'dark', 'light']);
    expect(nextTheme('auto')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('auto');
  });
  it('auto follows the system, the others do not', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
  it('only accepts the three known values', () => {
    expect(isThemeChoice('light') && isThemeChoice('dark') && isThemeChoice('auto')).toBe(true);
    expect(isThemeChoice('blue')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});
