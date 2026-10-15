/** Conversions between A1-style cell references and zero-based row and column indexes. */

const MAX_COLUMNS = 16_384; // Excel's limit: column XFD

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function columnLetters(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_COLUMNS) throw new RangeError(`Column index ${index} is out of range.`);
  let letters = '';
  let remaining = index + 1;
  while (remaining > 0) {
    const digit = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + digit) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

/** "A" -> 0, "AA" -> 26. Returns null for anything that is not 1-3 letters within Excel's limit. */
export function columnIndex(letters: string): number | null {
  if (!/^[A-Za-z]{1,3}$/.test(letters)) return null;
  let value = 0;
  for (const char of letters.toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
  return value <= MAX_COLUMNS ? value - 1 : null;
}

/** "B12" -> { row: 11, col: 1 }. Absolute markers ("$B$12") are accepted. */
export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(ref);
  if (!match) return null;
  const col = columnIndex(match[1] ?? '');
  const row = Number(match[2]) - 1;
  return col === null || row < 0 ? null : { row, col };
}

export const cellRef = (row: number, col: number): string => `${columnLetters(col)}${row + 1}`;
