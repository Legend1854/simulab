/**
 * Number formats. In an .xlsx file a cell stores a number and a style index; the style points at a
 * number format, which decides whether 0.08 is displayed as "0.08", "8%" or a date. SimuLab reads
 * formats only to detect two ambiguous cases (percentages and dates); it never applies them.
 */

/** Built-in formats that have no formatCode in styles.xml (ECMA-376 Part 1, section 18.8.30). */
const BUILT_IN_FORMATS: Readonly<Record<number, string>> = {
  0: 'General',
  1: '0',
  2: '0.00',
  3: '#,##0',
  4: '#,##0.00',
  9: '0%',
  10: '0.00%',
  11: '0.00E+00',
  12: '# ?/?',
  13: '# ??/??',
  14: 'mm-dd-yy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM',
  20: 'h:mm',
  21: 'h:mm:ss',
  22: 'm/d/yy h:mm',
  37: '#,##0 ;(#,##0)',
  38: '#,##0 ;[Red](#,##0)',
  39: '#,##0.00;(#,##0.00)',
  40: '#,##0.00;[Red](#,##0.00)',
  45: 'mm:ss',
  46: '[h]:mm:ss',
  47: 'mmss.0',
  48: '##0.0E+0',
  49: '@',
};

/** Ids 27-36 and 50-58 are locale-specific East Asian date formats with no fixed code. */
const isEastAsianDateId = (id: number): boolean => (id >= 27 && id <= 36) || (id >= 50 && id <= 58);

/** The format code for a built-in id, or "General" when the id is unknown. */
export function builtInFormat(id: number): string {
  if (isEastAsianDateId(id)) return 'yyyy-mm-dd';
  return BUILT_IN_FORMATS[id] ?? 'General';
}

/** The built-in id for a format code, if there is one (used when writing, to avoid custom formats). */
export function builtInFormatId(code: string): number | undefined {
  for (const [id, builtIn] of Object.entries(BUILT_IN_FORMATS)) if (builtIn === code) return Number(id);
  return undefined;
}

/** Removes quoted literals ("%"), escaped characters (\%) and, optionally, [bracketed] sections. */
function literalFree(format: string, dropBrackets: boolean): string {
  const withoutLiterals = format.replace(/"[^"]*"/g, '').replace(/\\./g, '');
  return dropBrackets ? withoutLiterals.replace(/\[[^\]]*\]/g, '') : withoutLiterals;
}

/**
 * True when a format multiplies by 100 and shows a percent sign. A quoted or escaped "%" is plain
 * text and does not count: `0.0"%"` displays 7.5 as "7.5%" without scaling, which is safe to read.
 */
export function isPercentFormat(format: string): boolean {
  return literalFree(format, false).includes('%');
}

/**
 * True when a format displays a date or time. Excel stores dates as serial numbers, so the format is
 * the only signal. Literals, escaped characters and [bracketed] colour or locale sections are ignored.
 */
export function isDateFormat(format: string): boolean {
  if (format.trim().toLowerCase() === 'general') return false;
  return /[dmyhs]/i.test(literalFree(format, true));
}
