// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/data/defaultConfig';
import { importWorkbook } from '../../../src/services/spreadsheets/importWorkbook';
import { cellRef, columnIndex, columnLetters, parseCellRef } from '../../../src/services/spreadsheets/ooxml/cellRef';
import { builtInFormat, builtInFormatId, isDateFormat, isPercentFormat } from '../../../src/services/spreadsheets/ooxml/numberFormats';
import { cellKey, readXlsx, XlsxReadError, type XlsxSheet } from '../../../src/services/spreadsheets/ooxml/readXlsx';
import { writeXlsx } from '../../../src/services/spreadsheets/ooxml/writeXlsx';

const fixture = (name: string) => new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures/crosscheck', name)));
const at = (sheet: XlsxSheet | undefined, ref: string) => {
  const parsed = parseCellRef(ref);
  if (!sheet || !parsed) throw new Error(`no ${ref}`);
  return sheet.cells.get(cellKey(parsed.row, parsed.col));
};

/** A hand-written workbook, for structures SimuLab's own writer never produces. */
function packageOf(sheetXml: string, extras: Record<string, string> = {}): Uint8Array {
  return zipSync({
    'xl/workbook.xml': strToU8('<workbook xmlns:r="r"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://x/relationships/worksheet" Target="/xl/worksheets/data.xml"/></Relationships>'),
    'xl/worksheets/data.xml': strToU8(`<worksheet><sheetData>${sheetXml}</sheetData></worksheet>`),
    ...Object.fromEntries(Object.entries(extras).map(([path, xml]) => [path, strToU8(xml)])),
  });
}

describe('cell references', () => {
  it('converts between column letters and indexes', () => {
    expect([0, 25, 26, 51, 701, 702, 16383].map(columnLetters)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA', 'XFD']);
    expect(['A', 'z', 'AA', 'XFD', 'XFE', 'A1', ''].map(columnIndex)).toEqual([0, 25, 26, 16383, null, null, null]);
    expect(parseCellRef('$B$12')).toEqual({ row: 11, col: 1 });
    expect(parseCellRef('B0')).toBeNull();
    expect(cellRef(0, 27)).toBe('AB1');
    expect(() => columnLetters(-1)).toThrow(RangeError);
  });
});

describe('number formats', () => {
  it('maps built-in format ids both ways', () => {
    expect(builtInFormat(9)).toBe('0%');
    expect(builtInFormat(14)).toBe('mm-dd-yy');
    expect(builtInFormat(31)).toBe('yyyy-mm-dd'); // East Asian date ids have no fixed code
    expect(builtInFormat(999)).toBe('General');
    expect(builtInFormatId('0.00%')).toBe(10);
    expect(builtInFormatId('0.0"%"')).toBeUndefined();
  });

  it('treats only a scaling percent sign as a percentage format', () => {
    expect(['0%', '0.00%', '[Red]0.0%', '#,##0.0%;-0.0%'].map(isPercentFormat)).toEqual([true, true, true, true]);
    expect(['0.0"%"', '0.0\\%', 'General', '"Return %"0.0'].map(isPercentFormat)).toEqual([false, false, false, false]);
    expect(isDateFormat('dd/mm/yyyy')).toBe(true);
    expect(isDateFormat('General')).toBe(false);
  });
});

describe('writeXlsx -> readXlsx round trip', () => {
  const bytes = writeXlsx([
    {
      name: 'Kinds',
      headerRow: true,
      columnWidths: [12, 20],
      rows: [
        ['Label', 'Value'],
        ['text', '  keep spaces  '],
        ['number', 0.1 + 0.2],
        ['negative', -1.5e-7],
        ['boolean', false],
        ['percent', { number: 0.08, format: '0%' }],
        ['custom format', { number: 7.5, format: '0.0"%"' }],
        ['date', { date: new Date(Date.UTC(2026, 0, 1)) }],
        ['formula with result', { formula: '=B3*2', result: 0.6 }],
        ['formula text result', { formula: 'UPPER("a")', result: 'A' }],
        ['formula, no result', { formula: 'B3*2' }],
        ['error', { error: '#N/A' }],
        ['markup', 'A & B <c> "d"'],
        ['control chars', 'a\u0007b'],
        ['blank next', null],
        [],
        ['after gap', { text: 'wrapped', wrap: true, bold: true }],
      ],
    },
    { name: 'Second & "quoted"', rows: [['x']] },
  ]);
  const workbook = readXlsx(bytes);
  const sheet = workbook.sheets[0];

  it('keeps sheet names and order', () => {
    expect(workbook.sheets.map((s) => s.name)).toEqual(['Kinds', 'Second & "quoted"']);
  });

  it('reads back every kind of cell exactly', () => {
    expect(at(sheet, 'B2')).toMatchObject({ kind: 'text', value: '  keep spaces  ', hasFormula: false });
    expect(at(sheet, 'B3')).toMatchObject({ kind: 'number', value: 0.1 + 0.2 }); // shortest round-trip form, no precision loss
    expect(at(sheet, 'B4')).toMatchObject({ kind: 'number', value: -1.5e-7 });
    expect(at(sheet, 'B5')).toMatchObject({ kind: 'boolean', value: false });
    expect(at(sheet, 'B6')).toMatchObject({ kind: 'number', value: 0.08, format: '0%' });
    expect(at(sheet, 'B7')).toMatchObject({ kind: 'number', value: 7.5, format: '0.0"%"' });
    expect(at(sheet, 'B8')).toMatchObject({ kind: 'number', value: 46023, format: 'yyyy-mm-dd' });
    expect(at(sheet, 'B9')).toMatchObject({ kind: 'number', value: 0.6, hasFormula: true });
    expect(at(sheet, 'B10')).toMatchObject({ kind: 'text', value: 'A', hasFormula: true });
    expect(at(sheet, 'B11')).toMatchObject({ kind: 'empty', value: null, hasFormula: true });
    expect(at(sheet, 'B12')).toMatchObject({ kind: 'error', value: '#N/A' });
    expect(at(sheet, 'B13')).toMatchObject({ kind: 'text', value: 'A & B <c> "d"' });
    expect(at(sheet, 'B14')).toMatchObject({ kind: 'text', value: 'ab' }); // unrepresentable characters are dropped
    expect(at(sheet, 'B15')).toBeUndefined(); // blank cells are not stored
    expect(at(sheet, 'B17')).toMatchObject({ kind: 'text', value: 'wrapped' });
    expect(sheet?.bounds).toEqual({ firstRow: 0, lastRow: 16, firstCol: 0, lastCol: 1 });
  });

  it('refuses sheet names Excel would reject, duplicate names and non-finite numbers', () => {
    expect(() => writeXlsx([{ name: 'a/b', rows: [] }])).toThrow(/not a valid sheet name/);
    expect(() => writeXlsx([{ name: 'x'.repeat(32), rows: [] }])).toThrow(/not a valid sheet name/);
    expect(() => writeXlsx([{ name: 'A', rows: [] }, { name: 'a', rows: [] }])).toThrow(/Duplicate sheet name/);
    expect(() => writeXlsx([{ name: 'A', rows: [[Number.NaN]] }])).toThrow(/non-finite/);
    expect(() => writeXlsx([])).toThrow(/at least one sheet/);
  });
});

describe('readXlsx on structures from other writers', () => {
  it('follows absolute relationship targets and works without a root _rels/.rels part', () => {
    const workbook = readXlsx(packageOf('<row r="1"><c r="A1"><v>1</v></c></row>'));
    expect(at(workbook.sheets[0], 'A1')).toMatchObject({ kind: 'number', value: 1 });
  });

  it('places cells and rows that omit their references by position', () => {
    const workbook = readXlsx(packageOf('<row><c><v>1</v></c><c><v>2</v></c></row><row><c r="C2"><v>3</v></c><c><v>4</v></c></row>'));
    const sheet = workbook.sheets[0];
    expect([at(sheet, 'A1'), at(sheet, 'B1'), at(sheet, 'C2'), at(sheet, 'D2')].map((c) => c?.value)).toEqual([1, 2, 3, 4]);
  });

  it('reads shared strings, rich-text runs (ignoring phonetic hints), formula strings and ISO dates', () => {
    const sharedStrings = '<sst><si><t>plain</t></si><si><r><t>Bo</t></r><r><t xml:space="preserve">ld </t></r><rPh><t>skip</t></rPh></si></sst>';
    const workbook = readXlsx(
      packageOf('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="str"><f>A1</f><v>plain</v></c><c r="D1" t="d"><v>2026-01-01T00:00:00</v></c></row>', {
        'xl/sharedStrings.xml': sharedStrings,
      }),
    );
    const sheet = workbook.sheets[0];
    expect(at(sheet, 'A1')).toMatchObject({ kind: 'text', value: 'plain' });
    expect(at(sheet, 'B1')).toMatchObject({ kind: 'text', value: 'Bold ' });
    expect(at(sheet, 'C1')).toMatchObject({ kind: 'text', value: 'plain', hasFormula: true });
    expect(at(sheet, 'D1')).toMatchObject({ kind: 'date', value: '2026-01-01T00:00:00' });
  });

  it('marks dependents of a shared formula as formulas', () => {
    const workbook = readXlsx(packageOf('<row r="1"><c r="A1"><f t="shared" ref="A1:A2" si="0">1+1</f><v>2</v></c></row><row r="2"><c r="A2"><f t="shared" si="0"/><v>2</v></c></row>'));
    expect(at(workbook.sheets[0], 'A2')).toMatchObject({ kind: 'number', value: 2, hasFormula: true });
  });

  it('reports a damaged workbook with a specific reason', () => {
    const missingString = packageOf('<row r="1"><c r="A1" t="s"><v>7</v></c></row>');
    expect(() => readXlsx(missingString)).toThrow(/shared string 7, which does not exist/);
    expect(() => readXlsx(packageOf('<row r="1"><c r="A1"><v>abc</v></c></row>'))).toThrow(/invalid number "abc"/);
    expect(() => readXlsx(packageOf('<row r="1"><c r="1A"><v>1</v></c></row>'))).toThrow(/invalid cell reference "1A"/);
    expect(() => readXlsx(packageOf('<row r="1"><c r="A1" t="q"><v>1</v></c></row>'))).toThrow(/unknown type "q"/);
    try {
      readXlsx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
      expect.unreachable();
    } catch (caught) {
      expect(caught).toBeInstanceOf(XlsxReadError);
    }
  });

  it('skips chart sheets and other parts that are not worksheets', () => {
    const bytes = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Chart" sheetId="1" id="rId9"/><sheet name="Data" sheetId="2" id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/a.xml"/><Relationship Id="rId9" Type="x/chartsheet" Target="chartsheets/c.xml"/></Relationships>'),
      'xl/worksheets/a.xml': strToU8('<worksheet><sheetData/></worksheet>'),
    });
    expect(readXlsx(bytes).sheets.map((s) => s.name)).toEqual(['Data']);
  });
});

describe('cross-check with independent spreadsheet tools (fixtures built by scripts/crosscheck/build-fixtures.sh)', () => {
  it('reads every awkward cell kind written by openpyxl', () => {
    const sheet = readXlsx(fixture('edge-cells-openpyxl.xlsx')).sheets[0];
    expect(at(sheet, 'B1')).toMatchObject({ kind: 'number', value: 8 });
    expect(at(sheet, 'B2')).toMatchObject({ kind: 'number', value: 0.08, format: '0%' });
    expect(at(sheet, 'B3')).toMatchObject({ kind: 'number', value: 7.5, format: '0.0"%"' });
    expect(at(sheet, 'B4')).toMatchObject({ kind: 'number', format: 'dd/mm/yyyy' });
    expect(at(sheet, 'B5')).toMatchObject({ kind: 'boolean', value: true });
    expect(at(sheet, 'B6')).toMatchObject({ kind: 'error', value: '#DIV/0!' });
    expect(at(sheet, 'B7')).toMatchObject({ kind: 'empty', hasFormula: true }); // openpyxl never calculates formulas
    expect(at(sheet, 'B8')).toMatchObject({ kind: 'text', value: '  spaced  ' });
    expect(at(sheet, 'B9')).toMatchObject({ kind: 'text', value: 'Bold and plain' });
    expect(at(sheet, 'B10')).toMatchObject({ kind: 'text', value: 'A & B <c>' });
  });

  it('reads the same workbook after LibreOffice re-saved it with calculated formula results', () => {
    const sheet = readXlsx(fixture('edge-cells-resaved-by-libreoffice.xlsx')).sheets[0];
    expect(at(sheet, 'B3')).toMatchObject({ kind: 'number', value: 7.5, format: '0.0\\%' }); // LibreOffice escapes the literal %
    expect(isPercentFormat(at(sheet, 'B3')?.format ?? '')).toBe(false);
    expect(at(sheet, 'B7')).toMatchObject({ kind: 'number', value: 0.16, hasFormula: true });
    expect(at(sheet, 'B9')).toMatchObject({ kind: 'text', value: 'Bold and plain' });
  });

  it('imports SimuLab\'s template unchanged after LibreOffice re-saved it in its own .xlsx style', () => {
    const result = importWorkbook(fixture('template-resaved-by-libreoffice.xlsx'), 'template.xlsx');
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.config).toEqual(DEFAULT_CONFIG);
    expect(result.warnings).toEqual([]);
  });
});
