/**
 * Chart series colours, in fixed order (never cycled): slot 1 blue, slot 2
 * orange, as CSS variables so the dark theme re-steps them (index.css).
 * Validated with the dataviz palette checker on both surfaces: light
 * #2a78d6 / #eb6834 (ΔE 24.7), dark #3987e5 / #d95926 (ΔE 26.8), contrast ≥ 3:1.
 * Text never wears these; they mark identity next to a text label.
 */
export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)'] as const;

/** ₹ in Indian short form: 12,40,000 → ₹12.4L, 2,30,00,000 → ₹2.3Cr. */
export const inrShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
};

export const inrFull = (n: number): string =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
