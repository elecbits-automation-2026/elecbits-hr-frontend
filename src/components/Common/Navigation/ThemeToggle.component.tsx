import { useState } from 'react';

import { readTheme, setTheme, type ThemeChoice } from '@utils/theme';

const OPTIONS: Array<{ key: ThemeChoice; label: string; icon: string }> = [
  { key: 'system', label: 'System', icon: '◐' },
  { key: 'light', label: 'Light', icon: '☀' },
  { key: 'dark', label: 'Dark', icon: '☾' },
];

/** System / Light / Dark — remembered in this browser. */
const ThemeToggle = () => {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  return (
    <div
      role='radiogroup'
      aria-label='Theme'
      className='mx-3 flex rounded-md border border-slate-200 p-0.5 text-xs'
    >
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type='button'
          role='radio'
          aria-checked={choice === o.key}
          onClick={() => {
            setTheme(o.key);
            setChoice(o.key);
          }}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 ${
            choice === o.key
              ? 'bg-slate-100 font-medium text-slate-800'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span aria-hidden>{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
