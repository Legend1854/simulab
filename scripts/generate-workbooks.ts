/**
 * Generates the sample workbooks in samples/ from the same exporter the app uses:
 *   SimuLab_Template.xlsx            the default configuration, ready to edit
 *   SimuLab_Example_RateCycle.xlsx   a fictional six-round scenario pack
 *   SimuLab_Invalid_Example.xlsx     the example with deliberate mistakes, to demonstrate error reporting
 * Run with: npm run gen:workbooks
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { DEFAULT_CONFIG } from '../src/data/defaultConfig';
import { EXAMPLE_CONFIG } from '../src/data/exampleConfig';
import { buildWorkbook } from '../src/services/spreadsheets/exportWorkbook';
import { importWorkbook } from '../src/services/spreadsheets/importWorkbook';

const outDir = resolve(process.cwd(), 'samples');
mkdirSync(outDir, { recursive: true });

const write = (name: string, wb: XLSX.WorkBook): Uint8Array => {
  const bytes = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
  writeFileSync(resolve(outDir, name), bytes);
  return bytes;
};

write('SimuLab_Template.xlsx', buildWorkbook(DEFAULT_CONFIG));
write('SimuLab_Example_RateCycle.xlsx', buildWorkbook(EXAMPLE_CONFIG));

// Deliberate mistakes, one of each common kind. Extra rows are appended so each mistake produces one message.
const invalid = buildWorkbook(EXAMPLE_CONFIG);
invalid.Sheets.Returns!.C3 = { t: 's', v: 'five' };                                    // Returns row 3: non-numeric return
XLSX.utils.sheet_add_aoa(invalid.Sheets.Returns!, [['soft_landing', 'gold', 3]], { origin: -1 }); // Returns row 26: unknown asset
XLSX.utils.sheet_add_aoa(invalid.Sheets.Assets!, [['bonds', 'Bond ladder', '', 30]], { origin: -1 }); // Assets row 6: duplicate id
delete invalid.Sheets.Scenarios!.C4;                                                   // Scenarios row 4: missing title
const invalidBytes = write('SimuLab_Invalid_Example.xlsx', invalid);

// Sanity check: the valid samples import cleanly and the invalid one does not.
for (const name of ['SimuLab_Template.xlsx', 'SimuLab_Example_RateCycle.xlsx']) {
  const wb = buildWorkbook(name.includes('Example') ? EXAMPLE_CONFIG : DEFAULT_CONFIG);
  const result = importWorkbook(new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer), name);
  if (!result.ok) throw new Error(`${name} failed to import: ${JSON.stringify(result.issues)}`);
}
const invalidResult = importWorkbook(invalidBytes, 'SimuLab_Invalid_Example.xlsx');
if (invalidResult.ok) throw new Error('The invalid example unexpectedly imported.');
console.log(`Wrote 3 workbooks to ${outDir}. The invalid example reports ${invalidResult.issues.length} problems:`);
for (const item of invalidResult.issues) {
  const where = [item.location?.sheet, item.location?.row ? `row ${item.location.row}` : '', item.location?.column].filter(Boolean).join(', ');
  console.log(`  - ${where}: ${item.message}`);
}
