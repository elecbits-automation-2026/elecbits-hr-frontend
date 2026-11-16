/**
 * Light / dark theme (learner, 2026-11-16). The choice is per browser:
 * 'system' follows the OS setting (and keeps following it), 'light' and
 * 'dark' pin it. index.html applies it before the first paint so a dark page
 * never flashes white; index.css holds the colours.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'elecbits-theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export const readTheme = (): ThemeChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

const apply = (choice: ThemeChoice) => {
  const dark = choice === 'dark' || (choice === 'system' && media().matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

export const setTheme = (choice: ThemeChoice) => {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked (private window): the choice lasts for this page only.
  }
  apply(choice);
};

/** Keep 'system' in step when the OS switches between light and dark. */
export const watchSystemTheme = () =>
  media().addEventListener('change', () => {
    if (readTheme() === 'system') apply('system');
  });
