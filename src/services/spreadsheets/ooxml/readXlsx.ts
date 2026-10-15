import { unzipSync, type UnzipFileInfo } from 'fflate';
import { parseCellRef } from './cellRef';
import { builtInFormat } from './numberFormats';
import { childElements, firstChild, parseXml, textContent, XmlError, type XmlElement } from './xml';

/**
 * Reads the values in an .xlsx workbook. An .xlsx file is a zip archive of XML "parts":
 *
 *   _rels/.rels                    -> points at the workbook part (usually xl/workbook.xml)
 *   xl/workbook.xml                -> sheet names, each with a relationship id
 *   xl/_rels/workbook.xml.rels     -> maps relationship ids to worksheet, styles and shared-string parts
 *   xl/sharedStrings.xml           -> text used by cells of type "s"
 *   xl/styles.xml                  -> number formats (needed to spot percentages and dates)
 *   xl/worksheets/sheetN.xml       -> the cells
 *
 * What this reader deliberately does NOT do: calculate formulas (it reports that a formula exists and
 * returns the value the spreadsheet application saved), run macros (macro parts are never even
 * decompressed), or read charts, images, comments or formatting beyond number formats.
 */

type CellBase = {
  /** True when the cell holds a formula. The formula itself is never evaluated. */
  hasFormula: boolean;
  /** Number format code from styles.xml, e.g. "General", "0%" or "dd/mm/yyyy". */
  format: string;
};

export type XlsxCell = CellBase &
  (
    | { kind: 'number'; value: number }
    | { kind: 'text'; value: string }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'error'; value: string }
    /** Cells of type "d" store an ISO 8601 date as text. */
    | { kind: 'date'; value: string }
    /** A formula with no saved result. Empty cells without a formula are not stored at all. */
    | { kind: 'empty'; value: null }
  );

export interface XlsxSheet {
  name: string;
  /** Cells that hold a value or a formula, keyed by `${row},${col}` (zero-based). */
  cells: Map<string, XlsxCell>;
  /** Bounds of the stored cells, or null when the sheet has none. Zero-based and inclusive. */
  bounds: { firstRow: number; lastRow: number; firstCol: number; lastCol: number } | null;
}

export interface XlsxWorkbook {
  /** Worksheets in workbook order. Chart sheets and other non-worksheet parts are skipped. */
  sheets: XlsxSheet[];
}

export interface ReadLimits {
  /** Maximum number of entries in the zip archive. */
  maxEntries: number;
  /** Maximum declared uncompressed size of any single XML part, in bytes. */
  maxPartBytes: number;
  /** Maximum declared uncompressed size of all XML parts together, in bytes. */
  maxTotalBytes: number;
}

export const DEFAULT_READ_LIMITS: ReadLimits = {
  maxEntries: 1000,
  maxPartBytes: 10 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
};

export type XlsxReadErrorCode = 'not_zip' | 'too_large' | 'corrupt';

export class XlsxReadError extends Error {
  constructor(
    readonly code: XlsxReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'XlsxReadError';
  }
}

export const cellKey = (row: number, col: number): string => `${row},${col}`;

/* ------------------------------------------------------------------ */
/* Archive                                                            */
/* ------------------------------------------------------------------ */

const isXmlPart = (name: string): boolean => /\.(xml|rels)$/i.test(name);

/**
 * Lists the archive first without decompressing anything, so the size limits are checked against the
 * sizes the archive declares. fflate allocates exactly the declared size, so an archive that lies
 * about its sizes produces truncated (and then unparseable) XML rather than unbounded memory use.
 */
function unzipXmlParts(bytes: Uint8Array, limits: ReadLimits): Map<string, Uint8Array> {
  const entries: UnzipFileInfo[] = [];
  try {
    unzipSync(bytes, {
      filter: (file) => {
        entries.push(file);
        return false;
      },
    });
  } catch {
    throw new XlsxReadError('not_zip', 'The file is not a readable zip archive.');
  }
  if (entries.length > limits.maxEntries) {
    throw new XlsxReadError('too_large', `The workbook contains ${entries.length} internal files; the limit is ${limits.maxEntries}.`);
  }
  let total = 0;
  for (const entry of entries) {
    if (!isXmlPart(entry.name)) continue;
    if (entry.originalSize > limits.maxPartBytes) {
      throw new XlsxReadError('too_large', `Part "${entry.name}" expands to ${formatMegabytes(entry.originalSize)}; the limit is ${formatMegabytes(limits.maxPartBytes)}.`);
    }
    total += entry.originalSize;
  }
  if (total > limits.maxTotalBytes) {
    throw new XlsxReadError('too_large', `The workbook expands to ${formatMegabytes(total)}; the limit is ${formatMegabytes(limits.maxTotalBytes)}.`);
  }
  try {
    const parts = unzipSync(bytes, { filter: (file) => isXmlPart(file.name) });
    return new Map(Object.entries(parts));
  } catch {
    throw new XlsxReadError('corrupt', 'The workbook archive is damaged and could not be decompressed.');
  }
}

const formatMegabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ------------------------------------------------------------------ */
/* Parts and relationships                                            */
/* ------------------------------------------------------------------ */

const decoder = new TextDecoder('utf-8');

function readPart(parts: Map<string, Uint8Array>, path: string): XmlElement | null {
  // Part names are case-insensitive in the packaging standard.
  const bytes = parts.get(path) ?? [...parts.entries()].find(([name]) => name.toLowerCase() === path.toLowerCase())?.[1];
  if (!bytes) return null;
  try {
    return parseXml(decoder.decode(bytes));
  } catch (caught) {
    const reason = caught instanceof XmlError ? caught.message : 'unreadable XML';
    throw new XlsxReadError('corrupt', `Part "${path}" could not be read: ${reason}`);
  }
}

/** Resolves a relationship target against the folder of the part that declared it. */
function resolveTarget(fromFolder: string, target: string): string {
  const segments = (target.startsWith('/') ? target.slice(1) : `${fromFolder}${target}`).split('/');
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') resolved.pop();
    else resolved.push(segment);
  }
  return resolved.join('/');
}

const folderOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');

interface Relationship {
  id: string;
  type: string;
  target: string;
}

function readRelationships(parts: Map<string, Uint8Array>, ownerPath: string): Relationship[] {
  const folder = folderOf(ownerPath);
  const file = ownerPath.slice(folder.length);
  const root = readPart(parts, `${folder}_rels/${file}.rels`);
  if (!root) return [];
  return childElements(root, 'Relationship')
    .filter((rel) => rel.attributes.TargetMode !== 'External')
    .map((rel) => ({ id: rel.attributes.Id ?? '', type: rel.attributes.Type ?? '', target: resolveTarget(folder, rel.attributes.Target ?? '') }));
}

/** Relationship types end with a fixed name in both the transitional and strict variants of the standard. */
const hasType = (rel: Relationship, name: string): boolean => rel.type.endsWith(`/${name}`);

/* ------------------------------------------------------------------ */
/* Shared strings and styles                                          */
/* ------------------------------------------------------------------ */

/** Text of a string item: either one <t>, or rich-text runs <r><t>…</t></r>. Phonetic hints (<rPh>) are skipped. */
function stringItemText(item: XmlElement): string {
  const plain = firstChild(item, 't');
  if (plain) return textContent(plain);
  return childElements(item, 'r')
    .map((run) => {
      const t = firstChild(run, 't');
      return t ? textContent(t) : '';
    })
    .join('');
}

function readSharedStrings(root: XmlElement | null): string[] {
  return root ? childElements(root, 'si').map(stringItemText) : [];
}

/** Number format code for each cell style index (the `s` attribute on a cell). */
function readStyleFormats(root: XmlElement | null): string[] {
  if (!root) return [];
  const custom = new Map<number, string>();
  const numFmts = firstChild(root, 'numFmts');
  if (numFmts) {
    for (const fmt of childElements(numFmts, 'numFmt')) {
      custom.set(Number(fmt.attributes.numFmtId), fmt.attributes.formatCode ?? 'General');
    }
  }
  const cellXfs = firstChild(root, 'cellXfs');
  if (!cellXfs) return [];
  return childElements(cellXfs, 'xf').map((xf) => {
    const id = Number(xf.attributes.numFmtId ?? 0);
    return custom.get(id) ?? builtInFormat(id);
  });
}

/* ------------------------------------------------------------------ */
/* Worksheets                                                         */
/* ------------------------------------------------------------------ */

function readCell(c: XmlElement, sharedStrings: string[], formats: string[]): XlsxCell | null {
  const type = c.attributes.t ?? 'n';
  const styleIndex = Number(c.attributes.s ?? 0);
  const format = formats[styleIndex] ?? 'General';
  const hasFormula = firstChild(c, 'f') !== undefined;
  const v = firstChild(c, 'v');
  const raw = v ? textContent(v) : undefined;
  const base = { hasFormula, format };

  switch (type) {
    case 'inlineStr': {
      const is = firstChild(c, 'is');
      return is ? { ...base, kind: 'text', value: stringItemText(is) } : hasFormula ? { ...base, kind: 'empty', value: null } : null;
    }
    case 's': {
      if (raw === undefined) return hasFormula ? { ...base, kind: 'empty', value: null } : null;
      const index = Number(raw);
      const text = sharedStrings[index];
      if (!Number.isInteger(index) || text === undefined) {
        throw new XlsxReadError('corrupt', `Cell ${c.attributes.r ?? ''} refers to shared string ${raw}, which does not exist.`);
      }
      return { ...base, kind: 'text', value: text };
    }
    case 'str':
      return raw === undefined ? (hasFormula ? { ...base, kind: 'empty', value: null } : null) : { ...base, kind: 'text', value: raw };
    case 'b':
      return raw === undefined ? (hasFormula ? { ...base, kind: 'empty', value: null } : null) : { ...base, kind: 'boolean', value: raw.trim() === '1' };
    case 'e':
      return { ...base, kind: 'error', value: raw ?? '#N/A' };
    case 'd':
      return raw === undefined ? (hasFormula ? { ...base, kind: 'empty', value: null } : null) : { ...base, kind: 'date', value: raw };
    case 'n': {
      if (raw === undefined || raw.trim() === '') return hasFormula ? { ...base, kind: 'empty', value: null } : null;
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new XlsxReadError('corrupt', `Cell ${c.attributes.r ?? ''} has an invalid number "${raw}".`);
      return { ...base, kind: 'number', value };
    }
    default:
      throw new XlsxReadError('corrupt', `Cell ${c.attributes.r ?? ''} has an unknown type "${type}".`);
  }
}

function readWorksheet(name: string, root: XmlElement, sharedStrings: string[], formats: string[]): XlsxSheet {
  const cells = new Map<string, XlsxCell>();
  let bounds: XlsxSheet['bounds'] = null;
  const sheetData = firstChild(root, 'sheetData');
  let rowIndex = -1;
  for (const row of sheetData ? childElements(sheetData, 'row') : []) {
    // Row and cell references are optional in the standard; when missing, position follows the previous one.
    const declaredRow = Number(row.attributes.r);
    rowIndex = Number.isInteger(declaredRow) && declaredRow > 0 ? declaredRow - 1 : rowIndex + 1;
    let colIndex = -1;
    for (const c of childElements(row, 'c')) {
      const ref = c.attributes.r ? parseCellRef(c.attributes.r) : null;
      if (c.attributes.r && !ref) throw new XlsxReadError('corrupt', `Sheet "${name}" has an invalid cell reference "${c.attributes.r}".`);
      colIndex = ref ? ref.col : colIndex + 1;
      const cellRow = ref ? ref.row : rowIndex;
      const cell = readCell(c, sharedStrings, formats);
      if (!cell) continue;
      cells.set(cellKey(cellRow, colIndex), cell);
      bounds = bounds
        ? {
            firstRow: Math.min(bounds.firstRow, cellRow),
            lastRow: Math.max(bounds.lastRow, cellRow),
            firstCol: Math.min(bounds.firstCol, colIndex),
            lastCol: Math.max(bounds.lastCol, colIndex),
          }
        : { firstRow: cellRow, lastRow: cellRow, firstCol: colIndex, lastCol: colIndex };
    }
  }
  return { name, cells, bounds };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

export function readXlsx(bytes: Uint8Array, limits: ReadLimits = DEFAULT_READ_LIMITS): XlsxWorkbook {
  const parts = unzipXmlParts(bytes, limits);

  const officeDocument = readRelationships(parts, '').find((rel) => hasType(rel, 'officeDocument'));
  const workbookPath = officeDocument?.target ?? 'xl/workbook.xml';
  const workbook = readPart(parts, workbookPath);
  if (!workbook || workbook.name !== 'workbook') {
    throw new XlsxReadError('corrupt', 'The archive has no spreadsheet workbook part. It may be a different kind of document.');
  }

  const relationships = readRelationships(parts, workbookPath);
  const byId = new Map(relationships.map((rel) => [rel.id, rel]));
  const folder = folderOf(workbookPath);
  const sharedStringsPath = relationships.find((rel) => hasType(rel, 'sharedStrings'))?.target ?? `${folder}sharedStrings.xml`;
  const stylesPath = relationships.find((rel) => hasType(rel, 'styles'))?.target ?? `${folder}styles.xml`;
  const sharedStrings = readSharedStrings(readPart(parts, sharedStringsPath));
  const formats = readStyleFormats(readPart(parts, stylesPath));

  const sheetsElement = firstChild(workbook, 'sheets');
  const sheets: XlsxSheet[] = [];
  for (const sheet of sheetsElement ? childElements(sheetsElement, 'sheet') : []) {
    const name = sheet.attributes.name ?? '';
    const rel = byId.get(sheet.attributes.id ?? '');
    if (!rel || !hasType(rel, 'worksheet')) continue; // chart sheets, dialog sheets, macro sheets
    const root = readPart(parts, rel.target);
    if (!root) throw new XlsxReadError('corrupt', `Sheet "${name}" is listed but its part "${rel.target}" is missing.`);
    sheets.push(readWorksheet(name, root, sharedStrings, formats));
  }
  return { sheets };
}
