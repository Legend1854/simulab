import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/data/defaultConfig';
import { EXAMPLE_CONFIG } from '../../src/data/exampleConfig';
import type { SimulationConfig, SpreadsheetImportResult } from '../../src/domain/types';
import { buildWorkbook, workbookBytes } from '../../src/services/spreadsheets/exportWorkbook';
import { importWorkbook } from '../../src/services/spreadsheets/importWorkbook';

/* Helpers: export a valid workbook, damage it in one place, import it. */

const toBytes = (wb: XLSX.WorkBook): Uint8Array => new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);

function columnOf(ws: XLSX.WorkSheet, header: string): number {
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let c = range.s.c; c <= range.e.c; c += 1) if (ws[XLSX.utils.encode_cell({ r: 0, c })]?.v === header) return c;
  throw new Error(`no column ${header}`);
}

/** Address of a cell by header and Excel row number (header row is 1). */
const cell = (wb: XLSX.WorkBook, sheet: string, header: string, row: number): string =>
  XLSX.utils.encode_cell({ r: row - 1, c: columnOf(wb.Sheets[sheet]!, header) });

function setSetting(wb: XLSX.WorkBook, key: string, value: XLSX.CellObject): void {
  const ws = wb.Sheets.Settings!;
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let r = 1; r <= range.e.r; r += 1) {
    if (ws[XLSX.utils.encode_cell({ r, c: columnOf(ws, 'Key') })]?.v === key) ws[XLSX.utils.encode_cell({ r, c: columnOf(ws, 'Value') })] = value;
  }
}

function importWith(mutate: (wb: XLSX.WorkBook) => void, config: SimulationConfig = DEFAULT_CONFIG): SpreadsheetImportResult {
  const wb = buildWorkbook(config);
  mutate(wb);
  return importWorkbook(toBytes(wb), 'test.xlsx');
}

function issues(result: SpreadsheetImportResult) {
  if (result.ok) throw new Error('expected the import to fail');
  return result.issues;
}
const codes = (result: SpreadsheetImportResult) => issues(result).map((i) => i.code);

describe('export and import round trip', () => {
  it('imports an exported default configuration unchanged, with no warnings', () => {
    const result = importWorkbook(workbookBytes(DEFAULT_CONFIG), 'default.xlsx');
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.config).toEqual(DEFAULT_CONFIG);
    expect(result.warnings).toEqual([]);
    expect(result.summary).toMatchObject({ assetCount: 4, scenarioCount: 5, riskProfileCount: 3 });
  });

  it('imports the example scenario pack unchanged', () => {
    const result = importWorkbook(workbookBytes(EXAMPLE_CONFIG), 'Example.XLSX');
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.config).toEqual(EXAMPLE_CONFIG);
  });

  it('writes the documented sheets in order, starting with Instructions', () => {
    expect(buildWorkbook(DEFAULT_CONFIG).SheetNames).toEqual(['Instructions', 'Settings', 'Assets', 'RiskProfiles', 'Scenarios', 'Returns']);
  });

  it('accepts sheet and column names with different case and surrounding spaces', () => {
    const result = importWith((wb) => {
      const ws = wb.Sheets.Assets!;
      ws[cell(wb, 'Assets', 'AssetId', 1)] = { t: 's', v: '  assetid ' };
      wb.SheetNames[wb.SheetNames.indexOf('Assets')] = ' ASSETS ';
      wb.Sheets[' ASSETS '] = ws;
      delete wb.Sheets.Assets;
    });
    expect(result.ok).toBe(true);
  });

  it('orders scenarios by the Round column, not by row order', () => {
    const result = importWith((wb) => {
      wb.Sheets.Scenarios![cell(wb, 'Scenarios', 'Round', 2)] = { t: 'n', v: 2 };
      wb.Sheets.Scenarios![cell(wb, 'Scenarios', 'Round', 3)] = { t: 'n', v: 1 };
    });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
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
    expect(importWorkbook(workbookBytes(DEFAULT_CONFIG).slice(0, 300), 'broken.xlsx').ok).toBe(false);
  });
  it('rejects a workbook that is missing required sheets', () => {
    const result = importWith((wb) => {
      delete wb.Sheets.Returns;
      wb.SheetNames = wb.SheetNames.filter((name) => name !== 'Returns');
    });
    expect(issues(result)).toEqual([expect.objectContaining({ code: 'missing_sheet', message: 'Required sheet "Returns" is missing.' })]);
  });
  it('rejects an unsupported format version', () => {
    expect(codes(importWith((wb) => setSetting(wb, 'SchemaVersion', { t: 'n', v: 2 })))).toEqual(['schema_version']);
  });
});

describe('row-level validation with sheet, row and column', () => {
  it('reports a non-numeric return', () => {
    const issue = issues(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 4)] = { t: 's', v: 'eight' }; }))
      .find((i) => i.code === 'invalid_number');
    expect(issue?.location).toEqual({ sheet: 'Returns', row: 4, column: 'ReturnPct' });
    expect(issue?.message).toBe('"ReturnPct" must be a number, but it contains "eight".');
  });

  it('accepts numbers stored as text, including thousands separators', () => {
    const result = importWith((wb) => setSetting(wb, 'StartingBalance', { t: 's', v: '12,500' }));
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.config.startingBalance).toBe(12500);
  });

  it('reports a blank required cell', () => {
    const result = importWith((wb) => { delete wb.Sheets.Assets![cell(wb, 'Assets', 'Name', 2)]; });
    expect(issues(result).find((i) => i.code === 'required')?.location).toMatchObject({ sheet: 'Assets', row: 2, column: 'Name' });
  });

  it('rejects duplicate asset identifiers and names the first row', () => {
    const result = importWith((wb) => { wb.Sheets.Assets![cell(wb, 'Assets', 'AssetId', 3)] = { t: 's', v: 'cash' }; });
    expect(issues(result).find((i) => i.code === 'duplicate_id')?.message).toBe('Duplicate asset ID "cash" (already used on row 2).');
  });

  it('rejects returns that refer to unknown assets or scenarios', () => {
    expect(codes(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'AssetId', 2)] = { t: 's', v: 'gold' }; }))).toContain('unknown_asset');
    expect(codes(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ScenarioId', 2)] = { t: 's', v: 's99' }; }))).toContain('unknown_scenario');
  });

  it('rejects a missing scenario-by-asset return', () => {
    const result = importWith((wb) => {
      const ws = wb.Sheets.Returns!;
      const range = XLSX.utils.decode_range(ws['!ref']!);
      for (let c = range.s.c; c <= range.e.c; c += 1) delete ws[XLSX.utils.encode_cell({ r: range.e.r, c })];
    });
    expect(issues(result).find((i) => i.code === 'missing_return')?.message).toMatch(/scenario "s5" and asset "tech_equities"/);
  });

  it('rejects the same scenario and asset listed twice', () => {
    const result = importWith((wb) => {
      wb.Sheets.Returns![cell(wb, 'Returns', 'ScenarioId', 3)] = { t: 's', v: 's1' };
      wb.Sheets.Returns![cell(wb, 'Returns', 'AssetId', 3)] = { t: 's', v: 'cash' };
    });
    expect(codes(result)).toContain('duplicate_return');
  });

  it('rejects out-of-range returns using the shared model rules, pointing at the Returns sheet', () => {
    const issue = issues(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 2)] = { t: 'n', v: 900 }; }))
      .find((i) => i.code === 'out_of_range');
    expect(issue?.location?.sheet).toBe('Returns');
  });

  it('rejects score weights that do not total 100%, pointing at the Settings sheet', () => {
    const issue = issues(importWith((wb) => setSetting(wb, 'WeightPerformancePct', { t: 'n', v: 60 }))).find((i) => i.code === 'weights_total');
    expect(issue?.location?.sheet).toBe('Settings');
    expect(issue?.message).toMatch(/currently 110%/);
  });

  it('rejects round numbering with gaps or duplicates', () => {
    expect(codes(importWith((wb) => { wb.Sheets.Scenarios![cell(wb, 'Scenarios', 'Round', 6)] = { t: 'n', v: 7 }; }))).toContain('round_gap');
    expect(codes(importWith((wb) => { wb.Sheets.Scenarios![cell(wb, 'Scenarios', 'Round', 3)] = { t: 'n', v: 1 }; }))).toContain('duplicate_round');
    expect(codes(importWith((wb) => { wb.Sheets.Scenarios![cell(wb, 'Scenarios', 'Round', 3)] = { t: 'n', v: 2.5 }; }))).toContain('invalid_integer');
  });

  it('rejects a fee that could take a balance below zero', () => {
    expect(codes(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 5)] = { t: 'n', v: -100 }; }))).toContain('negative_balance');
  });

  it('reports a missing required column and a missing setting', () => {
    expect(codes(importWith((wb) => { wb.Sheets.Assets![cell(wb, 'Assets', 'RiskRating', 1)] = { t: 's', v: 'Risk' }; }))).toContain('missing_column');
    expect(codes(importWith((wb) => setSetting(wb, 'AnnualFeePct', { t: 's', v: '' })))).toContain('required');
  });

  it('is all-or-nothing: a failed import returns no configuration at all', () => {
    const result = importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 4)] = { t: 's', v: 'x' }; });
    expect(result.ok).toBe(false);
    expect('config' in result).toBe(false);
  });

  it('caps the number of reported problems', () => {
    const result = importWith((wb) => {
      for (let row = 2; row <= 21; row += 1) {
        wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', row)] = { t: 's', v: 'x' };
        wb.Sheets.Returns![cell(wb, 'Returns', 'AssetId', row)] = { t: 's', v: `zz${row}` };
        wb.Sheets.Returns![cell(wb, 'Returns', 'ScenarioId', row)] = { t: 's', v: `yy${row}` };
      }
    });
    expect(issues(result).length).toBeLessThanOrEqual(101);
  });
});

describe('percent formats, formulas and unsupported cell types', () => {
  it('rejects a percent-formatted number, because 0.08 shown as 8% is ambiguous', () => {
    const result = importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 2)] = { t: 'n', v: 0.02, z: '0%' }; });
    expect(issues(result).find((i) => i.code === 'percent_format')?.message).toMatch(/percentage points/);
  });

  it('never evaluates formulas: it uses the saved value and warns', () => {
    const result = importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 2)] = { t: 'n', v: 2, f: '1+1' }; });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.warnings.map((w) => w.code)).toEqual(['formula_not_evaluated']);
    expect(result.config.scenarios[0]?.returnsPct.cash).toBe(2);
  });

  it('rejects a formula with no saved value instead of guessing', () => {
    const result = importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 2)] = { t: 'n', f: '1+1' } as XLSX.CellObject; });
    expect(codes(result)).toContain('formula_no_value');
  });

  it('rejects spreadsheet error values, booleans and dates', () => {
    expect(codes(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 2)] = { t: 'e', v: 7 }; }))).toContain('cell_error');
    expect(codes(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 2)] = { t: 'b', v: true }; }))).toContain('invalid_number');
    expect(codes(importWith((wb) => { wb.Sheets.Returns![cell(wb, 'Returns', 'ReturnPct', 2)] = { t: 'd', v: new Date(2026, 0, 1) }; }))).toContain('invalid_number');
  });

  it('ignores unknown columns with a warning', () => {
    const result = importWith((wb) => {
      const ws = wb.Sheets.Assets!;
      ws.E1 = { t: 's', v: 'Extra' };
      ws.E2 = { t: 's', v: 'ignored' };
      ws['!ref'] = 'A1:E5';
    });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.warnings.map((w) => w.code)).toContain('unknown_column');
  });

  it('keeps hostile text as plain data (React renders it as text, never as HTML)', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const result = importWith((wb) => { wb.Sheets.Assets![cell(wb, 'Assets', 'Name', 2)] = { t: 's', v: payload }; });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.config.assets[0]?.name).toBe(payload);
  });

  it('rejects over-long text', () => {
    expect(codes(importWith((wb) => { wb.Sheets.Assets![cell(wb, 'Assets', 'Name', 2)] = { t: 's', v: 'x'.repeat(200) }; }))).toContain('too_long');
  });
});

describe('isDateFormat', () => {
  it('recognises date and time formats and ignores number formats', async () => {
    const { isDateFormat } = await import('../../src/services/spreadsheets/importWorkbook');
    for (const format of ['m/d/yy', 'yyyy-mm-dd', '[$-409]mmmm d, yyyy', 'h:mm AM/PM', 'dd/mm/yyyy hh:mm']) expect(isDateFormat(format), format).toBe(true);
    for (const format of ['General', '0', '0.00', '#,##0', '0%', '0.00E+00', '"$"#,##0.00', '_($* #,##0.00_)']) expect(isDateFormat(format), format).toBe(false);
  });
});

describe('errors do not cascade across sheets', () => {
  it('a scenario with a missing title is reported once, and its returns are not reported as unknown', () => {
    const result = importWith((wb) => { delete wb.Sheets.Scenarios![cell(wb, 'Scenarios', 'Title', 3)]; });
    expect(issues(result)).toEqual([expect.objectContaining({ code: 'required', location: { sheet: 'Scenarios', row: 3, column: 'Title' } })]);
  });
  it('an asset with an invalid risk rating is reported once', () => {
    const result = importWith((wb) => { wb.Sheets.Assets![cell(wb, 'Assets', 'RiskRating', 2)] = { t: 's', v: 'low' }; });
    expect(codes(result)).toEqual(['invalid_number']);
  });
});
