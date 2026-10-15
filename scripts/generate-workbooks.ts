/**
 * Generates the sample workbooks in samples/ from the same exporter the app uses:
 *   SimuLab_Template.xlsx            the default configuration, ready to edit
 *   SimuLab_Example_RateCycle.xlsx   a fictional six-round scenario pack
 *   SimuLab_Invalid_Example.xlsx     the example with deliberate mistakes, to demonstrate error reporting
 * Run with: npm run gen:workbooks
 *
 * A fixed timestamp is written into the files so that regenerating them gives byte-identical output
 * (and no noise in version control) unless the content really changed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_CONFIG } from '../src/data/defaultConfig';
import { EXAMPLE_CONFIG } from '../src/data/exampleConfig';
import { buildWorkbookSheets } from '../src/services/spreadsheets/exportWorkbook';
import { importWorkbook } from '../src/services/spreadsheets/importWorkbook';
import { appendRow, setCell } from '../src/services/spreadsheets/ooxml/sheetEdits';
import { writeXlsx, type SheetInput } from '../src/services/spreadsheets/ooxml/writeXlsx';

const SAMPLE_TIMESTAMP = new Date('2026-01-01T00:00:00Z');
const outDir = resolve(process.cwd(), 'samples');
mkdirSync(outDir, { recursive: true });

const write = (name: string, sheets: SheetInput[]): Uint8Array => {
  const bytes = writeXlsx(sheets, { modified: SAMPLE_TIMESTAMP });
  writeFileSync(resolve(outDir, name), bytes);
  return bytes;
};

const templateBytes = write('SimuLab_Template.xlsx', buildWorkbookSheets(DEFAULT_CONFIG));
const exampleBytes = write('SimuLab_Example_RateCycle.xlsx', buildWorkbookSheets(EXAMPLE_CONFIG));

// Deliberate mistakes, one of each common kind. Extra rows are appended so each mistake produces one message.
const invalid = buildWorkbookSheets(EXAMPLE_CONFIG);
setCell(invalid, 'Returns', 'ReturnPct', 3, 'five'); //           Returns row 3: non-numeric return
appendRow(invalid, 'Returns', ['soft_landing', 'gold', 3]); //    Returns row 26: unknown asset
appendRow(invalid, 'Assets', ['bonds', 'Bond ladder', '', 30]); // Assets row 6: duplicate id
setCell(invalid, 'Scenarios', 'Title', 4, undefined); //          Scenarios row 4: missing title
const invalidBytes = write('SimuLab_Invalid_Example.xlsx', invalid);

// Sanity check: the valid samples import cleanly and the invalid one does not.
for (const [name, bytes] of [['SimuLab_Template.xlsx', templateBytes], ['SimuLab_Example_RateCycle.xlsx', exampleBytes]] as const) {
  const result = importWorkbook(bytes, name);
  if (!result.ok) throw new Error(`${name} failed to import: ${JSON.stringify(result.issues)}`);
}
const invalidResult = importWorkbook(invalidBytes, 'SimuLab_Invalid_Example.xlsx');
if (invalidResult.ok) throw new Error('The invalid example unexpectedly imported.');
console.log(`Wrote 3 workbooks to ${outDir}. The invalid example reports ${invalidResult.issues.length} problems:`);
for (const item of invalidResult.issues) {
  const where = [item.location?.sheet, item.location?.row ? `row ${item.location.row}` : '', item.location?.column].filter(Boolean).join(', ');
  console.log(`  - ${where}: ${item.message}`);
}
