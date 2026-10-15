import { strToU8, zipSync, type Zippable } from 'fflate';
import { cellRef, columnLetters } from './cellRef';
import { builtInFormatId } from './numberFormats';
import { escapeXmlAttribute, escapeXmlText } from './xml';

/**
 * Writes a minimal, standards-conforming .xlsx workbook: inline strings, numbers, booleans, error
 * values and formulas (optionally with a saved result), bold text, number formats, column widths and
 * a frozen header row. That is everything SimuLab's template needs, plus the unusual cells the tests
 * need to build deliberately awkward workbooks.
 */

/** A cell to write. Plain values cover most cells; the object forms add formatting or special types. */
export type CellInput =
  | string
  | number
  | boolean
  | null
  | undefined
  | { text: string; bold?: boolean; wrap?: boolean }
  | { number: number; format?: string; bold?: boolean }
  | { formula: string; result?: number | string | boolean; format?: string }
  | { error: string }
  | { date: Date; format?: string };

export interface SheetInput {
  name: string;
  rows: CellInput[][];
  /** Column widths in characters, by column index. */
  columnWidths?: number[];
  /** Bold the first row and keep it visible while scrolling. */
  headerRow?: boolean;
}

export interface WriteOptions {
  /** Timestamp stored in the document properties and zip entries. Fixed values give byte-identical files. */
  modified?: Date;
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Excel's maximum sheet-name length and forbidden characters. */
const SHEET_NAME = /^[^[\]:*?/\\]{1,31}$/;

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

interface StyleKey {
  bold: boolean;
  wrap: boolean;
  format: string;
}

/** Collects the distinct cell styles used and writes styles.xml for them. Style 0 is the default. */
class StyleTable {
  private readonly keys: string[] = ['0|0|General'];
  private readonly customFormats = new Map<string, number>();

  index(style: StyleKey): number {
    const key = `${style.bold ? 1 : 0}|${style.wrap ? 1 : 0}|${style.format}`;
    const existing = this.keys.indexOf(key);
    if (existing !== -1) return existing;
    if (builtInFormatId(style.format) === undefined && !this.customFormats.has(style.format)) {
      this.customFormats.set(style.format, 164 + this.customFormats.size); // ids below 164 are reserved
    }
    this.keys.push(key);
    return this.keys.length - 1;
  }

  toXml(): string {
    const numFmts = [...this.customFormats.entries()]
      .map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escapeXmlAttribute(code)}"/>`)
      .join('');
    const xfs = this.keys
      .map((key) => {
        const [bold, wrap, ...formatParts] = key.split('|');
        const format = formatParts.join('|');
        const numFmtId = builtInFormatId(format) ?? this.customFormats.get(format) ?? 0;
        const attrs = [`numFmtId="${numFmtId}"`, `fontId="${bold === '1' ? 1 : 0}"`, 'fillId="0"', 'borderId="0"', 'xfId="0"'];
        if (numFmtId !== 0) attrs.push('applyNumberFormat="1"');
        if (bold === '1') attrs.push('applyFont="1"');
        return wrap === '1' ? `<xf ${attrs.join(' ')} applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>` : `<xf ${attrs.join(' ')}/>`;
      })
      .join('');
    return (
      `${XML_DECLARATION}<styleSheet xmlns="${NS_MAIN}">` +
      (numFmts ? `<numFmts count="${this.customFormats.size}">${numFmts}</numFmts>` : '') +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.keys.length}">${xfs}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
}

/* ------------------------------------------------------------------ */
/* Cells                                                              */
/* ------------------------------------------------------------------ */

/** Excel's 1900 date system: days since 30 December 1899 (valid for dates after 1 March 1900). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const toExcelSerial = (date: Date): number => (date.getTime() - EXCEL_EPOCH_MS) / 86_400_000;

function numberText(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Cannot write the non-finite number ${value} to a workbook.`);
  return String(value);
}

function inlineString(text: string): string {
  const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : '';
  return `<is><t${preserve}>${escapeXmlText(text)}</t></is>`;
}

function cellXml(ref: string, input: CellInput, headerBold: boolean, table: StyleTable): string {
  if (input === null || input === undefined || input === '') return '';
  const style = (key: Partial<StyleKey>) => {
    const index = table.index({ bold: key.bold ?? headerBold, wrap: key.wrap ?? false, format: key.format ?? 'General' });
    return index === 0 ? '' : ` s="${index}"`;
  };
  if (typeof input === 'string') return `<c r="${ref}" t="inlineStr"${style({})}>${inlineString(input)}</c>`;
  if (typeof input === 'number') return `<c r="${ref}"${style({})}><v>${numberText(input)}</v></c>`;
  if (typeof input === 'boolean') return `<c r="${ref}" t="b"${style({})}><v>${input ? 1 : 0}</v></c>`;
  if ('text' in input) return `<c r="${ref}" t="inlineStr"${style({ bold: input.bold, wrap: input.wrap })}>${inlineString(input.text)}</c>`;
  if ('number' in input) return `<c r="${ref}"${style({ bold: input.bold, format: input.format })}><v>${numberText(input.number)}</v></c>`;
  if ('error' in input) return `<c r="${ref}" t="e"${style({})}><v>${escapeXmlText(input.error)}</v></c>`;
  if ('date' in input) return `<c r="${ref}"${style({ format: input.format ?? 'yyyy-mm-dd' })}><v>${numberText(toExcelSerial(input.date))}</v></c>`;
  // Formula: the text is stored as-is; a saved result is optional (Excel recalculates on open).
  const formula = `<f>${escapeXmlText(input.formula.replace(/^=/, ''))}</f>`;
  const result = input.result;
  const attrs = style({ format: input.format });
  if (result === undefined) return `<c r="${ref}"${attrs}>${formula}</c>`;
  if (typeof result === 'string') return `<c r="${ref}" t="str"${attrs}>${formula}<v>${escapeXmlText(result)}</v></c>`;
  if (typeof result === 'boolean') return `<c r="${ref}" t="b"${attrs}>${formula}<v>${result ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${attrs}>${formula}<v>${numberText(result)}</v></c>`;
}

function worksheetXml(sheet: SheetInput, table: StyleTable, selected: boolean): string {
  const width = Math.max(1, ...sheet.rows.map((row) => row.length));
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row.map((input, c) => cellXml(cellRef(r, c), input, Boolean(sheet.headerRow) && r === 0, table)).join('');
      return cells ? `<row r="${r + 1}">${cells}</row>` : '';
    })
    .join('');
  const dimension = sheet.rows.length > 0 ? `A1:${columnLetters(width - 1)}${sheet.rows.length}` : 'A1';
  const pane = sheet.headerRow
    ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
    : '';
  const cols = (sheet.columnWidths ?? [])
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  return (
    `${XML_DECLARATION}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${dimension}"/>` +
    `<sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${rows}</sheetData>` +
    '</worksheet>'
  );
}

/* ------------------------------------------------------------------ */
/* Package                                                            */
/* ------------------------------------------------------------------ */

export function writeXlsx(sheets: SheetInput[], options: WriteOptions = {}): Uint8Array {
  if (sheets.length === 0) throw new Error('A workbook needs at least one sheet.');
  const names = new Set<string>();
  for (const sheet of sheets) {
    if (!SHEET_NAME.test(sheet.name)) throw new Error(`"${sheet.name}" is not a valid sheet name.`);
    if (names.has(sheet.name.toLowerCase())) throw new Error(`Duplicate sheet name "${sheet.name}".`);
    names.add(sheet.name.toLowerCase());
  }
  const modified = options.modified ?? new Date();
  const timestamp = `${modified.toISOString().slice(0, 19)}Z`;
  const styles = new StyleTable();
  const worksheets = sheets.map((sheet, index) => worksheetXml(sheet, styles, index === 0));

  const sheetOverrides = sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');
  const files: Record<string, string> = {
    '[Content_Types].xml':
      `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheetOverrides +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>',
    '_rels/.rels':
      `${XML_DECLARATION}<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${REL_BASE}/officeDocument" Target="xl/workbook.xml"/>` +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      `<Relationship Id="rId3" Type="${REL_BASE}/extended-properties" Target="docProps/app.xml"/>` +
      '</Relationships>',
    'docProps/core.xml':
      `${XML_DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>SimuLab configuration</dc:title><dc:creator>SimuLab</dc:creator>' +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>` +
      `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>` +
      '</cp:coreProperties>',
    'docProps/app.xml':
      `${XML_DECLARATION}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SimuLab</Application></Properties>`,
    'xl/workbook.xml':
      `${XML_DECLARATION}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
      sheets.map((sheet, i) => `<sheet name="${escapeXmlAttribute(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      `${XML_DECLARATION}<Relationships xmlns="${NS_PKG_REL}">` +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_BASE}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="${REL_BASE}/styles" Target="styles.xml"/>` +
      '</Relationships>',
    'xl/styles.xml': styles.toXml(),
  };
  worksheets.forEach((xml, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = xml;
  });

  const zippable: Zippable = {};
  for (const [path, xml] of Object.entries(files)) zippable[path] = [strToU8(xml), { level: 6, mtime: modified }];
  return zipSync(zippable);
}
