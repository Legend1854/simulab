import type { CellInput, SheetInput } from './writeXlsx';

/**
 * Small editing helpers for workbook data before it is written. The sample-workbook generator uses
 * them to plant deliberate mistakes, and the tests use them to damage a valid workbook in one place.
 * Rows are addressed by the row number a person sees in Excel (the header row is row 1).
 */

const cellText = (input: CellInput | undefined): string | undefined => {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && 'text' in input) return input.text;
  return undefined;
};

export function sheetNamed(sheets: SheetInput[], name: string): SheetInput {
  const sheet = sheets.find((candidate) => candidate.name === name);
  if (!sheet) throw new Error(`No sheet named "${name}".`);
  return sheet;
}

export function columnOf(sheet: SheetInput, header: string): number {
  const index = (sheet.rows[0] ?? []).findIndex((cell) => cellText(cell) === header);
  if (index === -1) throw new Error(`Sheet "${sheet.name}" has no column "${header}".`);
  return index;
}

/** Sets one cell by column header and Excel row number. `undefined` clears the cell. */
export function setCell(sheets: SheetInput[], sheetName: string, header: string, rowNumber: number, value: CellInput): void {
  const sheet = sheetNamed(sheets, sheetName);
  const col = columnOf(sheet, header);
  const row = (sheet.rows[rowNumber - 1] ??= []);
  row[col] = value;
}

/** Sets the Value cell of a row on the Settings sheet, found by its Key. */
export function setSetting(sheets: SheetInput[], key: string, value: CellInput): void {
  const settings = sheetNamed(sheets, 'Settings');
  const keyCol = columnOf(settings, 'Key');
  const rowIndex = settings.rows.findIndex((row) => cellText(row[keyCol]) === key);
  if (rowIndex === -1) throw new Error(`No setting "${key}".`);
  setCell(sheets, 'Settings', 'Value', rowIndex + 1, value);
}

export function appendRow(sheets: SheetInput[], sheetName: string, row: CellInput[]): number {
  const sheet = sheetNamed(sheets, sheetName);
  sheet.rows.push(row);
  return sheet.rows.length;
}

export function clearRow(sheets: SheetInput[], sheetName: string, rowNumber: number): void {
  sheetNamed(sheets, sheetName).rows[rowNumber - 1] = [];
}

export function removeSheet(sheets: SheetInput[], name: string): SheetInput[] {
  return sheets.filter((sheet) => sheet.name !== name);
}
