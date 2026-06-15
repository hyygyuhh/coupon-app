import { STORAGE_KEYS, THEME } from "./constants";

export type ThemeType = typeof THEME.LIGHT | typeof THEME.DARK;

export function getTheme(): ThemeType {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME);
  if (saved === THEME.DARK) return THEME.DARK;
  if (saved === THEME.LIGHT) return THEME.LIGHT;
  return window.matchMedia("(prefers-color-scheme: dark)").matches 
    ? THEME.DARK 
    : THEME.LIGHT;
}

export function setTheme(theme: ThemeType): void {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  applyTheme(theme);
}

export function applyTheme(theme: ThemeType): void {
  document.documentElement.classList.toggle("dark", theme === THEME.DARK);
}

export function toggleTheme(): ThemeType {
  const current = getTheme();
  const next = current === THEME.LIGHT ? THEME.DARK : THEME.LIGHT;
  setTheme(next);
  return next;
}

export function initTheme(): ThemeType {
  const theme = getTheme();
  applyTheme(theme);
  return theme;
}