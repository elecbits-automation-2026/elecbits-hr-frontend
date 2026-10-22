export interface PageTab<K extends string> {
  key: K;
  label: string;
  /** Things waiting on the viewer in that tab; shown as a pill when > 0. */
  count?: number;
}

/**
 * The page-level tab bar (same look as the Recognition tabs). Used where one
 * page serves several hats — e.g. `Mine | My team` — so each hat's work sits
 * on its own tab instead of one long scroll.
 */
const PageTabs = <K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: PageTab<K>[];
  active: K;
  onChange: (key: K) => void;
}) => (
  <div className='flex flex-wrap gap-2'>
    {tabs.map((t) => (
      <button
        key={t.key}
        type='button'
        onClick={() => onChange(t.key)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          active === t.key
            ? 'bg-brand-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        {t.label}
        {(t.count ?? 0) > 0 && (
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              active === t.key ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {t.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

export default PageTabs;
