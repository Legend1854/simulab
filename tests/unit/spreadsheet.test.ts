import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/data/defaultConfig';
import { EXAMPLE_CONFIG } from '../../src/data/exampleConfig';
import type { SimulationConfig, SpreadsheetImportResult } from '../../src/domain/types';
import { buildWorkbookSheets, workbookBytes } from '../../src/services/spreadsheets/exportWorkbook';
import { importWorkbook, isDateFormat } from '../../src/services/spreadsheets/importWorkbook';
import { appendRow, clearRow, removeSheet, setCell, setSetting, sheetNamed } from '../../src/services/spreadsheets/ooxml/sheetEdits';
import { writeXlsx, type SheetInput } from '../../src/services/spreadsheets/ooxml/writeXlsx';

/* Helpers: build a valid workbook as data, damage it in one place, write it, import it. */

function importWith(mutate: (sheets: SheetInput[]) => SheetInput[] | void, config: SimulationConfig = DEFAULT_CONFIG): SpreadsheetImportResult {
  const sheets = buildWorkbookSheets(config);
  const edited = mutate(sheets) ?? sheets;
  return importWorkbook(writeXlsx(edited), 'test.xlsx');
}

function issues(result: SpreadsheetImportResult) {
  if (result.ok) throw new Error('expected the import to fail');
  return result.issues;
}
const codes = (result: SpreadsheetImportResult) => issues(result).map((i) => i.code);

function expectOk(result: SpreadsheetImportResult) {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}

describe('export and import round trip', () => {
  it('imports an exported default configuration unchanged, with no warnings', () => {
    const result = expectOk(importWorkbook(workbookBytes(DEFAULT_CONFIG), 'default.xlsx'));
    expect(result.config).toEqual(DEFAULT_CONFIG);
    expect(result.warnings).toEqual([]);
    expect(result.summary).toMatchObject({ assetCount: 4, scenarioCount: 5, riskProfileCount: 3 });
  });

  it('imports the example scenario pack unchanged', () => {
    expect(expectOk(importWorkbook(workbookBytes(EXAMPLE_CONFIG), 'Example.XLSX')).config).toEqual(EXAMPLE_CONFIG);
  });

  it('writes the documented sheets in order, starting with Instructions', () => {
    expect(buildWorkbookSheets(DEFAULT_CONFIG).map((sheet) => sheet.name)).toEqual(['Instructions', 'Settings', 'Assets', 'RiskProfiles', 'Scenarios', 'Returns']);
  });

  it('writes byte-identical files for the same configuration and timestamp', () => {
    const modified = new Date('2026-01-01T00:00:00Z');
    expect(workbookBytes(DEFAULT_CONFIG, { modified })).toEqual(workbookBytes(DEFAULT_CONFIG, { modified }));
  });

  it('accepts sheet and column names with different case and surrounding spaces', () => {
    const result = importWith((sheets) => {
      setCell(sheets, 'Assets', 'AssetId', 1, '  assetid ');
      sheetNamed(sheets, 'Assets').name = ' ASSETS ';
    });
    expect(result.ok).toBe(true);
  });

  it('orders scenarios by the Round column, not by row order', () => {
    const result = expectOk(
      importWith((sheets) => {
        setCell(sheets, 'Scenarios', 'Round', 2, 2);
        setCell(sheets, 'Scenarios', 'Round', 3, 1);
      }),
    );
    expect(result.config.scenarios.map((s) => s.id)).toEqual(['s2', 's1', 's3', 's4', 's5']);
  });
});

describe('file-level rejection (corrupted or unsupported workbooks)', () => {
  it('rejects a non-.xlsx extension', () => {
    expect(codes(importWorkbook(workbookBytes(DEFAULT_CONFIG), 'config.csv'))).toEqual(['wrong_extension']);
  });
  it('rejects an empty file', () => {
    expect(codes(importWorkbook(new Uint8Array(), 'a.xlsx'))).toEqual(['empty_file']);
  });
  it('rejects an oversized file before parsing it', () => {
    expect(codes(importWorkbook(new Uint8Array(3 * 1024 * 1024), 'a.xlsx'))).toEqual(['file_too_large']);
  });
  it('rejects a text file renamed to .xlsx with a readable message', () => {
    const [first] = issues(importWorkbook(new TextEncoder().encode('name,value\nhello,1'), 'fake.xlsx'));
    expect(first?.code).toBe('not_xlsx');
    expect(first?.message).toMatch(/not a valid \.xlsx workbook/);
  });
  it('rejects a truncated (corrupted) zip container', () => {
    expect(codes(importWorkbook(workbookBytes(DEFAULT_CONFIG).slice(0, 300), 'broken.xlsx'))).toEqual(['unreadable']);
  });
  it('rejects a zip archive that is not a spreadsheet (for example a renamed .docx)', () => {
    const docxLike = zipSync({ 'word/document.xml': strToU8('<document/>'), '[Content_Types].xml': strToU8('<Types/>') });
    const [first] = issues(importWorkbook(docxLike, 'letter.xlsx'));
    expect(first?.code).toBe('unreadable');
    expect(first?.message).toMatch(/no spreadsheet workbook part/);
  });
  it('rejects damaged XML inside the archive', () => {
    const bytes = zipSync({ 'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="A"></workbook>') });
    expect(codes(importWorkbook(bytes, 'bad.xlsx'))).toEqual(['unreadable']);
  });
  it('rejects a small file that would expand to a huge amount of XML (zip bomb) before decompressing it', () => {
    const bomb = zipSync({ 'xl/workbook.xml': strToU8('<workbook/>'), 'xl/worksheets/sheet1.xml': new Uint8Array(11 * 1024 * 1024) }, { level: 9 });
    expect(bomb.byteLength).toBeLessThan(100_000);
    const [first] = issues(importWorkbook(bomb, 'bomb.xlsx'));
    expect(first?.code).toBe('file_too_large');
    expect(first?.message).toMatch(/expands to 11\.0 MB; the limit is 10\.0 MB/);
  });
  it('rejects an archive with too many internal files', () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 1001; i += 1) files[`junk/${i}.bin`] = new Uint8Array(1);
    expect(codes(importWorkbook(zipSync(files), 'many.xlsx'))).toEqual(['file_too_large']);
  });
  it('rejects a workbook that is missing required sheets', () => {
    const result = importWith((sheets) => removeSheet(sheets, 'Returns'));
    expect(issues(result)).toEqual([expect.objectContaining({ code: 'missing_sheet', message: 'Required sheet "Returns" is missing.' })]);
  });
  it('rejects an unsupported format version', () => {
    expect(codes(importWith((sheets) => setSetting(sheets, 'SchemaVersion', 2)))).toEqual(['schema_version']);
  });
});

describe('row-level validation with sheet, row and column', () => {
  it('reports a non-numeric return', () => {
    const issue = issues(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 4, 'eight'))).find((i) => i.code === 'invalid_number');
    expect(issue?.location).toEqual({ sheet: 'Returns', row: 4, column: 'ReturnPct', cell: 'C4' });
    expect(issue?.message).toBe('"ReturnPct" must be a number, but it contains "eight".');
  });

  it('accepts numbers stored as text, including thousands separators', () => {
    expect(expectOk(importWith((sheets) => setSetting(sheets, 'StartingBalance', '12,500'))).config.startingBalance).toBe(12500);
  });

  it('reports a blank required cell', () => {
    const result = importWith((sheets) => setCell(sheets, 'Assets', 'Name', 2, undefined));
    expect(issues(result).find((i) => i.code === 'required')?.location).toMatchObject({ sheet: 'Assets', row: 2, column: 'Name' });
  });

  it('rejects duplicate asset identifiers and names the first row', () => {
    const result = importWith((sheets) => setCell(sheets, 'Assets', 'AssetId', 3, 'cash'));
    expect(issues(result).find((i) => i.code === 'duplicate_id')?.message).toBe('Duplicate asset ID "cash" (already used on row 2).');
  });

  it('rejects returns that refer to unknown assets or scenarios', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Returns', 'AssetId', 2, 'gold')))).toContain('unknown_asset');
    expect(codes(importWith((sheets) => setCell(sheets, 'Returns', 'ScenarioId', 2, 's99')))).toContain('unknown_scenario');
  });

  it('rejects a missing scenario-by-asset return', () => {
    const result = importWith((sheets) => clearRow(sheets, 'Returns', sheetNamed(sheets, 'Returns').rows.length));
    expect(issues(result).find((i) => i.code === 'missing_return')?.message).toMatch(/scenario "s5" and asset "tech_equities"/);
  });

  it('rejects the same scenario and asset listed twice', () => {
    const result = importWith((sheets) => {
      setCell(sheets, 'Returns', 'ScenarioId', 3, 's1');
      setCell(sheets, 'Returns', 'AssetId', 3, 'cash');
    });
    expect(codes(result)).toContain('duplicate_return');
  });

  it('rejects out-of-range returns using the shared model rules, pointing at the Returns sheet', () => {
    const issue = issues(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, 900))).find((i) => i.code === 'out_of_range');
    expect(issue?.location?.sheet).toBe('Returns');
  });

  it('rejects score weights that do not total 100%, pointing at the Settings sheet', () => {
    const issue = issues(importWith((sheets) => setSetting(sheets, 'WeightPerformancePct', 60))).find((i) => i.code === 'weights_total');
    expect(issue?.location?.sheet).toBe('Settings');
    expect(issue?.message).toMatch(/currently 110%/);
  });

  it('rejects round numbering with gaps or duplicates', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Scenarios', 'Round', 6, 7)))).toContain('round_gap');
    expect(codes(importWith((sheets) => setCell(sheets, 'Scenarios', 'Round', 3, 1)))).toContain('duplicate_round');
    expect(codes(importWith((sheets) => setCell(sheets, 'Scenarios', 'Round', 3, 2.5)))).toContain('invalid_integer');
  });

  it('rejects a fee that could take a balance below zero', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 5, -100)))).toContain('negative_balance');
  });

  it('reports a missing required column and a missing setting', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Assets', 'RiskRating', 1, 'Risk')))).toContain('missing_column');
    expect(codes(importWith((sheets) => setSetting(sheets, 'AnnualFeePct', '')))).toContain('required');
  });

  it('is all-or-nothing: a failed import returns no configuration at all', () => {
    const result = importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 4, 'x'));
    expect(result.ok).toBe(false);
    expect('config' in result).toBe(false);
  });

  it('caps the number of reported problems', () => {
    const result = importWith((sheets) => {
      for (let row = 2; row <= 21; row += 1) {
        setCell(sheets, 'Returns', 'ReturnPct', row, 'x');
        setCell(sheets, 'Returns', 'AssetId', row, `zz${row}`);
        setCell(sheets, 'Returns', 'ScenarioId', row, `yy${row}`);
      }
    });
    expect(issues(result).length).toBeLessThanOrEqual(101);
  });
});

describe('percent formats, formulas and unsupported cell types', () => {
  it('rejects a percent-formatted number, because 0.08 shown as 8% is ambiguous', () => {
    const result = importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, { number: 0.02, format: '0%' }));
    expect(issues(result).find((i) => i.code === 'percent_format')?.message).toMatch(/percentage points/);
  });

  it('accepts a quoted percent sign, which only adds text and does not scale the number', () => {
    const result = expectOk(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, { number: 2, format: '0.0"%"' })));
    expect(result.config.scenarios[0]?.returnsPct.cash).toBe(2);
  });

  it('never evaluates formulas: it uses the saved value and warns', () => {
    const result = expectOk(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, { formula: '1+1', result: 2 })));
    expect(result.warnings.map((w) => w.code)).toEqual(['formula_not_evaluated']);
    expect(result.config.scenarios[0]?.returnsPct.cash).toBe(2);
  });

  it('uses the saved value even when it disagrees with the formula, because the formula is never run', () => {
    const result = expectOk(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, { formula: '1+1', result: 3 })));
    expect(result.config.scenarios[0]?.returnsPct.cash).toBe(3);
  });

  it('rejects a formula with no saved value instead of guessing', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, { formula: '1+1' })))).toContain('formula_no_value');
  });

  it('rejects spreadsheet error values, booleans and dates', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, { error: '#DIV/0!' })))).toContain('cell_error');
    expect(codes(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, true)))).toContain('invalid_number');
    expect(codes(importWith((sheets) => setCell(sheets, 'Returns', 'ReturnPct', 2, { date: new Date(Date.UTC(2026, 0, 1)) })))).toContain('invalid_number');
  });

  it('ignores unknown columns with a warning', () => {
    const result = expectOk(
      importWith((sheets) => {
        const assets = sheetNamed(sheets, 'Assets');
        assets.rows[0]?.push('Extra');
        assets.rows[1]?.push('ignored');
      }),
    );
    expect(result.warnings.map((w) => w.code)).toContain('unknown_column');
  });

  it('keeps hostile text as plain data (React renders it as text, never as HTML)', () => {
    const payload = '<img src=x onerror=alert(1)> & "quotes"';
    expect(expectOk(importWith((sheets) => setCell(sheets, 'Assets', 'Name', 2, payload))).config.assets[0]?.name).toBe(payload);
  });

  it('rejects over-long text', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Assets', 'Name', 2, 'x'.repeat(200))))).toContain('too_long');
  });

  it('reads extra rows appended after the generated data', () => {
    const result = importWith((sheets) => {
      appendRow(sheets, 'Returns', ['s1', 'cash', 5]);
    });
    expect(codes(result)).toContain('duplicate_return');
  });
});

describe('isDateFormat', () => {
  it('recognises date and time formats and ignores number formats', () => {
    for (const format of ['m/d/yy', 'yyyy-mm-dd', '[$-409]mmmm d, yyyy', 'h:mm AM/PM', 'dd/mm/yyyy hh:mm', '[h]:mm:ss']) expect(isDateFormat(format), format).toBe(true);
    for (const format of ['General', '0', '0.00', '#,##0', '0%', '0.00E+00', '"$"#,##0.00', '_($* #,##0.00_)', '0.0"%"']) expect(isDateFormat(format), format).toBe(false);
  });
});

describe('errors do not cascade across sheets', () => {
  it('a scenario with a missing title is reported once, and its returns are not reported as unknown', () => {
    const result = importWith((sheets) => setCell(sheets, 'Scenarios', 'Title', 3, undefined));
    expect(issues(result)).toEqual([expect.objectContaining({ code: 'required', location: { sheet: 'Scenarios', row: 3, column: 'Title', cell: 'C3' } })]);
  });
  it('an asset with an invalid risk rating is reported once', () => {
    expect(codes(importWith((sheets) => setCell(sheets, 'Assets', 'RiskRating', 2, 'low')))).toEqual(['invalid_number']);
  });
});
