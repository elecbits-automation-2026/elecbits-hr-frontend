/**
 * The separator a file uses: Excel saves with `;` or tabs in some locales, so
 * pick whichever of `,` `;` tab appears most in the first line (outside quotes).
 */
const detectSeparator = (text: string): string => {
  const firstLine = (text.split(/\r?\n/, 1)[0] ?? '').replace(/"[^"]*"/g, '');
  const count = (sep: string) => firstLine.split(sep).length - 1;
  return [',', ';', '\t'].reduce((best, sep) => (count(sep) > count(best) ? sep : best), ',');
};

/**
 * Minimal RFC-4180 parser: quoted fields, escaped quotes, separators and
 * newlines inside quotes. The separator (`,` `;` or tab) is detected.
 */
export const parseCsv = (text: string): string[][] => {
  const sep = detectSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
};

/** Hand the browser a file to save (this is the app itself, not a sandbox). */
export const downloadText = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Header cell -> lookup key: spaces, underscores, dashes and case don't matter. */
export const headerKey = (h: string) => h.toLowerCase().replace(/[\s_-]/g, '');
