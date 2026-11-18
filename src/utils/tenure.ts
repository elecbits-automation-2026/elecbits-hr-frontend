const DAY_MS = 86_400_000;

/** "2y 3m" / "5m" / "under a month" from a joining date; "—" when unknown. */
export const tenureOf = (doj: string | null): string => {
  if (!doj) return '—';
  const months = tenureMonths(doj);
  if (months < 1) return 'under a month';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y}y ${m}m` : `${m}m`;
};

/** Whole months since joining (for sorting / comparing tenure). */
export const tenureMonths = (doj: string): number =>
  Math.max(0, Math.floor((Date.now() - Date.parse(doj)) / DAY_MS / 30.44));
