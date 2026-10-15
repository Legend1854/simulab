import * as XLSX from 'xlsx';
import { SCHEMA_VERSION } from '../../domain/constants';
import type { Asset, ImportSummary, RiskProfile, Scenario, SimulationConfig, SpreadsheetImportResult, ValidationIssue } from '../../domain/types';
import { validateConfig } from '../../domain/validation';
import { COLUMNS, FILE_LIMITS, REQUIRED_SHEETS, SETTINGS, SHEET_NAMES, type ColumnSpec } from './schema';

/**
 * Explicit mapping from the documented workbook format (schema.ts) to the typed SimulationConfig.
 *
 * - SheetJS only parses the file. Formulas are NEVER executed: for a formula cell, the value Excel
 *   last saved is read and a warning is shown. Macros are not loaded.
 * - Nothing here touches application state. The caller receives either a complete, valid
 *   configuration or a list of problems, never a partial result.
 */

interface CellData {
  value: string | number | null;
  hasFormula: boolean;
  isPercentFormat: boolean;
  isError: boolean;
  isOtherType: boolean;
}

interface TableRow {
  /** Row number as shown in Excel (header is row 1). */
  rowNumber: number;
  cells: Map<string, CellData>;
}

interface Table {
  sheet: string;
  rows: TableRow[];
}

class IssueLog {
  private readonly items: ValidationIssue[] = [];
  private overflow = 0;

  add(severity: ValidationIssue['severity'], code: string, message: string, sheet?: string, row?: number, column?: string): void {
    if (this.items.length >= FILE_LIMITS.maxReportedIssues) {
      this.overflow += 1;
      return;
    }
    const location = { ...(sheet ? { sheet } : {}), ...(row ? { row } : {}), ...(column ? { column } : {}) };
    this.items.push({ code, severity, message, location });
  }
  error(code: string, message: string, sheet?: string, row?: number, column?: string): void {
    this.add('error', code, message, sheet, row, column);
  }
  warn(code: string, message: string, sheet?: string, row?: number, column?: string): void {
    this.add('warning', code, message, sheet, row, column);
  }
  get hasErrors(): boolean {
    return this.overflow > 0 || this.items.some((item) => item.severity === 'error');
  }
  get errors(): ValidationIssue[] {
    const list = this.items.filter((item) => item.severity === 'error');
    if (this.overflow > 0) {
      list.push({ code: 'too_many_issues', severity: 'error', message: `${this.overflow} more problems were not listed. Fix the problems above and import again.` });
    }
    return list;
  }
  get warnings(): ValidationIssue[] {
    return this.items.filter((item) => item.severity === 'warning');
  }
}

const normalise = (text: string): string => text.trim().toLowerCase();

function findSheet(workbook: XLSX.WorkBook, wanted: string): XLSX.WorkSheet | undefined {
  const match = workbook.SheetNames.find((name) => normalise(name) === normalise(wanted));
  return match === undefined ? undefined : workbook.Sheets[match];
}

/**
 * True when a number format displays a date or time. Excel stores dates as serial numbers, so the
 * format is the only signal. Quoted literals, [bracketed] sections and escaped characters are ignored.
 * (SheetJS has SSF.is_date, but its ESM build does not export SSF in every environment.)
 */
export function isDateFormat(format: string): boolean {
  const stripped = format.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[dmyhs]/i.test(stripped);
}

const EMPTY_CELL: CellData = { value: null, hasFormula: false, isPercentFormat: false, isError: false, isOtherType: false };

function readCell(sheet: XLSX.WorkSheet, row: number, col: number): CellData {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as XLSX.CellObject | undefined;
  if (!cell) return EMPTY_CELL;
  const flags = {
    hasFormula: typeof cell.f === 'string' && cell.f.length > 0,
    isPercentFormat: typeof cell.z === 'string' && cell.z.includes('%'),
  };
  if (cell.t === 'e') return { ...EMPTY_CELL, ...flags, isError: true };
  // Excel stores dates as numbers with a date format; treat them as unsupported rather than as a number.
  if (cell.t === 'n' && typeof cell.z === 'string' && isDateFormat(cell.z)) return { ...EMPTY_CELL, ...flags, isOtherType: true };
  if (cell.t === 'n' && typeof cell.v === 'number') return { ...EMPTY_CELL, ...flags, value: Number.isFinite(cell.v) ? cell.v : null };
  if (cell.t === 's' && typeof cell.v === 'string') {
    const trimmed = cell.v.trim();
    return { ...EMPTY_CELL, ...flags, value: trimmed.length === 0 ? null : trimmed };
  }
  // Type 'z' is a stub: SheetJS reports a formula with no saved value as a stub whose v is a fake 0,
  // so stubs are always treated as "no value".
  if (cell.t === 'z' || cell.v === undefined || cell.v === null) return { ...EMPTY_CELL, ...flags };
  return { ...EMPTY_CELL, ...flags, isOtherType: true }; // booleans and dates
}

/** Reads a sheet into rows keyed by (normalised) header name, checking the header row against the schema. */
function readTable(sheet: XLSX.WorkSheet, sheetName: string, expected: ReadonlyArray<ColumnSpec>, log: IssueLog): Table | null {
  const ref = sheet['!ref'];
  if (!ref) {
    log.error('empty_sheet', `Sheet "${sheetName}" is empty.`, sheetName);
    return null;
  }
  const range = XLSX.utils.decode_range(ref);
  if (range.e.r - range.s.r + 1 > FILE_LIMITS.maxRows || range.e.c - range.s.c + 1 > FILE_LIMITS.maxColumns) {
    log.error('sheet_too_large', `Sheet "${sheetName}" is larger than the supported ${FILE_LIMITS.maxRows} rows by ${FILE_LIMITS.maxColumns} columns.`, sheetName);
    return null;
  }

  const headerByIndex = new Map<number, string>();
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const header = readCell(sheet, range.s.r, c);
    if (typeof header.value === 'string') headerByIndex.set(c, header.value);
  }
  const headerRow = range.s.r + 1;
  const seen = new Set<string>();
  for (const header of headerByIndex.values()) {
    if (seen.has(normalise(header))) log.error('duplicate_column', `Column "${header}" appears more than once.`, sheetName, headerRow, header);
    seen.add(normalise(header));
  }
  for (const spec of expected) {
    if (spec.required && !seen.has(normalise(spec.name))) {
      log.error('missing_column', `Required column "${spec.name}" is missing from the header row.`, sheetName, headerRow, spec.name);
    }
  }
  const known = new Set(expected.map((spec) => normalise(spec.name)));
  for (const header of headerByIndex.values()) {
    if (!known.has(normalise(header))) log.warn('unknown_column', `Column "${header}" is not part of the format and was ignored.`, sheetName, headerRow, header);
  }

  const rows: TableRow[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
    const cells = new Map<string, CellData>();
    let blank = true;
    for (const [c, header] of headerByIndex) {
      const data = readCell(sheet, r, c);
      cells.set(normalise(header), data);
      if (data.value !== null || data.isError || data.isOtherType || data.hasFormula) blank = false;
    }
    if (!blank) rows.push({ rowNumber: r + 1, cells });
  }
  return { sheet: sheetName, rows };
}

/* Typed cell accessors. Every error carries the sheet, row and column. */

function warnIfFormula(data: CellData, log: IssueLog, table: Table, row: TableRow, column: string): void {
  if (data.hasFormula) {
    log.warn(
      'formula_not_evaluated',
      `This cell holds a formula. SimuLab does not calculate formulas; it used the value last saved in the file (${String(data.value)}).`,
      table.sheet, row.rowNumber, column,
    );
  }
}

function readText(table: Table, row: TableRow, column: string, log: IssueLog, required: boolean): string | undefined {
  const data = row.cells.get(normalise(column)) ?? EMPTY_CELL;
  if (data.hasFormula && data.value === null && !data.isError) {
    log.error('formula_no_value', `"${column}" has a formula with no saved value. Open the file in Excel, save it, and import again.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  if (data.isError || data.isOtherType) {
    log.error('invalid_cell', `"${column}" contains an error value or an unsupported type. Enter plain text.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  if (data.value === null) {
    if (required) log.error('required', `"${column}" is required.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  warnIfFormula(data, log, table, row, column);
  return String(data.value);
}

function readNumber(table: Table, row: TableRow, column: string, log: IssueLog, integer = false): number | undefined {
  const data = row.cells.get(normalise(column)) ?? EMPTY_CELL;
  if (data.hasFormula && data.value === null && !data.isError) {
    log.error('formula_no_value', `"${column}" has a formula with no saved value. Open the file in Excel, save it, and import again.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  if (data.isError) {
    log.error('cell_error', `"${column}" contains a spreadsheet error value (such as #DIV/0!). Replace it with a number.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  if (data.isOtherType) {
    log.error('invalid_number', `"${column}" must be a number. Dates and TRUE/FALSE values are not supported.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  if (data.value === null) {
    log.error('required', `"${column}" is required.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  if (data.isPercentFormat) {
    log.error(
      'percent_format',
      `"${column}" is formatted as a percentage. Use plain numbers in percentage points (type 8 for 8%) with the General or Number format.`,
      table.sheet, row.rowNumber, column,
    );
    return undefined;
  }
  let value: number;
  if (typeof data.value === 'number') {
    value = data.value;
  } else {
    const text = data.value.replaceAll(',', '');
    value = /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isFinite(value)) {
      log.error('invalid_number', `"${column}" must be a number, but it contains "${data.value}".`, table.sheet, row.rowNumber, column);
      return undefined;
    }
  }
  if (integer && !Number.isInteger(value)) {
    log.error('invalid_integer', `"${column}" must be a whole number, but it contains ${value}.`, table.sheet, row.rowNumber, column);
    return undefined;
  }
  warnIfFormula(data, log, table, row, column);
  return value;
}

interface IdentifiedRows<T> {
  /** Rows whose fields were all valid, keyed by id. */
  items: Map<string, { item: T; row: number }>;
  /** Every unique id seen, including rows with other invalid fields. Used for cross-sheet references,
   *  so one bad cell does not cascade into "not listed" errors on other sheets. */
  ids: Set<string>;
}

/** Reads rows that have a unique identifier column, reporting duplicates against the first row that used the id. */
function readIdentifiedRows<T>(
  table: Table, log: IssueLog, idColumn: string, label: string, build: (row: TableRow, id: string) => T | undefined,
): IdentifiedRows<T> {
  const items = new Map<string, { item: T; row: number }>();
  const firstRow = new Map<string, number>();
  for (const row of table.rows) {
    const id = readText(table, row, idColumn, log, true);
    if (id === undefined) continue;
    const earlier = firstRow.get(id);
    if (earlier !== undefined) {
      log.error('duplicate_id', `Duplicate ${label} "${id}" (already used on row ${earlier}).`, table.sheet, row.rowNumber, idColumn);
      continue;
    }
    firstRow.set(id, row.rowNumber);
    const item = build(row, id);
    if (item !== undefined) items.set(id, { item, row: row.rowNumber });
  }
  return { items, ids: new Set(firstRow.keys()) };
}

function readSettings(table: Table, log: IssueLog): Map<string, number | string> {
  const values = new Map<string, number | string>();
  const specs = new Map(SETTINGS.map((spec) => [normalise(spec.key), spec]));
  const seen = new Set<string>();
  for (const row of table.rows) {
    const key = readText(table, row, 'Key', log, true);
    if (key === undefined) continue;
    const spec = specs.get(normalise(key));
    if (!spec) {
      log.warn('unknown_setting', `Setting "${key}" is not recognised and was ignored.`, table.sheet, row.rowNumber, 'Key');
      continue;
    }
    if (seen.has(spec.key)) {
      log.error('duplicate_setting', `Setting "${spec.key}" appears more than once.`, table.sheet, row.rowNumber, 'Key');
      continue;
    }
    seen.add(spec.key);
    const value = spec.type === 'text' ? readText(table, row, 'Value', log, true) : readNumber(table, row, 'Value', log, spec.type === 'integer');
    if (value !== undefined) values.set(spec.key, value);
  }
  for (const spec of SETTINGS) {
    if (!seen.has(spec.key)) log.error('missing_setting', `Required setting "${spec.key}" is missing.`, table.sheet, undefined, 'Key');
  }
  return values;
}

/** Which sheet a model path from validateConfig() belongs to, so shared-rule errors point at the right place. */
function sheetForPath(path: string): string {
  if (path.startsWith('assets')) return SHEET_NAMES.assets;
  if (path.startsWith('riskProfiles')) return SHEET_NAMES.riskProfiles;
  if (path.includes('returnsPct')) return SHEET_NAMES.returns;
  if (path.startsWith('scenarios')) return SHEET_NAMES.scenarios;
  return SHEET_NAMES.settings;
}

const fail = (code: string, message: string): SpreadsheetImportResult => ({ ok: false, issues: [{ code, severity: 'error', message }] });

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

export function importWorkbook(bytes: Uint8Array, fileName: string): SpreadsheetImportResult {
  /* 1. File-level checks before parsing anything. */
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    return fail('wrong_extension', 'Only .xlsx workbooks are supported. In Excel, use Save As > Excel Workbook (.xlsx) and try again.');
  }
  if (bytes.byteLength === 0) return fail('empty_file', 'The file is empty.');
  if (bytes.byteLength > FILE_LIMITS.maxFileBytes) {
    return fail('file_too_large', `The file is ${(bytes.byteLength / (1024 * 1024)).toFixed(1)} MB; the limit is ${FILE_LIMITS.maxFileBytes / (1024 * 1024)} MB.`);
  }
  if (!ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return fail('not_xlsx', 'This file is not a valid .xlsx workbook. It may be corrupted, renamed from another format, or saved in an older Excel format.');
  }

  /* 2. Parse safely: values and formula text only; no macros, no styles. */
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: 'array', cellFormula: true, cellNF: true, cellHTML: false, cellStyles: false, cellDates: false,
      bookVBA: false, sheetStubs: true, sheetRows: FILE_LIMITS.maxRows + 1,
    });
  } catch {
    return fail('unreadable', 'The workbook could not be read. It may be corrupted or use features SimuLab does not support.');
  }

  /* 3. Structure: required sheets and header rows. */
  const log = new IssueLog();
  const sheets = new Map<string, XLSX.WorkSheet>();
  for (const name of REQUIRED_SHEETS) {
    const sheet = findSheet(workbook, name);
    if (sheet) sheets.set(name, sheet);
    else log.error('missing_sheet', `Required sheet "${name}" is missing.`, name);
  }
  if (log.hasErrors) return { ok: false, issues: log.errors };

  const table = (name: string, columns: ReadonlyArray<ColumnSpec>): Table | null => {
    const sheet = sheets.get(name);
    return sheet ? readTable(sheet, name, columns, log) : null;
  };
  const settingsTable = table(SHEET_NAMES.settings, COLUMNS.settings);
  const assetsTable = table(SHEET_NAMES.assets, COLUMNS.assets);
  const profilesTable = table(SHEET_NAMES.riskProfiles, COLUMNS.riskProfiles);
  const scenariosTable = table(SHEET_NAMES.scenarios, COLUMNS.scenarios);
  const returnsTable = table(SHEET_NAMES.returns, COLUMNS.returns);
  if (!settingsTable || !assetsTable || !profilesTable || !scenariosTable || !returnsTable || log.hasErrors) {
    return { ok: false, issues: log.errors };
  }

  /* 4. Every required field, row by row. */
  const settings = readSettings(settingsTable, log);
  const assets = readIdentifiedRows<Asset>(assetsTable, log, 'AssetId', 'asset ID', (row, id) => {
    const name = readText(assetsTable, row, 'Name', log, true);
    const description = readText(assetsTable, row, 'Description', log, false) ?? '';
    const riskRating = readNumber(assetsTable, row, 'RiskRating', log);
    return name === undefined || riskRating === undefined ? undefined : { id, name, description, riskRating };
  });
  const profiles = readIdentifiedRows<RiskProfile>(profilesTable, log, 'ProfileId', 'risk profile ID', (row, id) => {
    const name = readText(profilesTable, row, 'Name', log, true);
    const description = readText(profilesTable, row, 'Description', log, false) ?? '';
    const targetRisk = readNumber(profilesTable, row, 'TargetRisk', log);
    return name === undefined || targetRisk === undefined ? undefined : { id, name, description, targetRisk };
  });
  // Round numbers are collected from every row with a valid id and round, even if another field on the
  // row is invalid, so a missing title does not also show up as a gap in the round numbering.
  const roundEntries: Array<{ round: number; row: number }> = [];
  const scenarioRows = readIdentifiedRows<Omit<Scenario, 'returnsPct'> & { round: number }>(scenariosTable, log, 'ScenarioId', 'scenario ID', (row, id) => {
    const round = readNumber(scenariosTable, row, 'Round', log, true);
    if (round !== undefined) roundEntries.push({ round, row: row.rowNumber });
    const title = readText(scenariosTable, row, 'Title', log, true);
    const phase = readText(scenariosTable, row, 'Phase', log, false) ?? '';
    const description = readText(scenariosTable, row, 'Description', log, false) ?? '';
    const lesson = readText(scenariosTable, row, 'Lesson', log, false) ?? '';
    return round === undefined || title === undefined ? undefined : { id, round, title, phase, description, lesson };
  });

  /* 5. Round numbering: whole numbers, unique, 1..n with no gaps. */
  const roundCounts = new Map<number, number>();
  for (const { round } of roundEntries) roundCounts.set(round, (roundCounts.get(round) ?? 0) + 1);
  let duplicateRounds = false;
  for (const { round, row } of roundEntries) {
    if ((roundCounts.get(round) ?? 0) > 1) {
      duplicateRounds = true;
      log.error('duplicate_round', `Round ${round} is used by more than one scenario.`, SHEET_NAMES.scenarios, row, 'Round');
    }
  }
  const rounds = [...roundCounts.keys()].sort((a, b) => a - b);
  if (!duplicateRounds && roundEntries.length > 0 && !rounds.every((value, index) => value === index + 1)) {
    log.error('round_gap', `Rounds must be numbered 1 to ${roundEntries.length} with no gaps (found ${rounds.join(', ')}).`, SHEET_NAMES.scenarios, undefined, 'Round');
  }

  /* 6. Returns: cross-sheet references, duplicates and completeness. */
  const returns = new Map<string, number>();
  const pairRow = new Map<string, number>();
  for (const row of returnsTable.rows) {
    const scenarioId = readText(returnsTable, row, 'ScenarioId', log, true);
    const assetId = readText(returnsTable, row, 'AssetId', log, true);
    const returnPct = readNumber(returnsTable, row, 'ReturnPct', log);
    if (scenarioId === undefined || assetId === undefined) continue;
    let references = true;
    if (!scenarioRows.ids.has(scenarioId)) {
      references = false;
      log.error('unknown_scenario', `Scenario "${scenarioId}" is not listed on the Scenarios sheet.`, SHEET_NAMES.returns, row.rowNumber, 'ScenarioId');
    }
    if (!assets.ids.has(assetId)) {
      references = false;
      log.error('unknown_asset', `Asset "${assetId}" is not listed on the Assets sheet.`, SHEET_NAMES.returns, row.rowNumber, 'AssetId');
    }
    const pair = `${scenarioId}|${assetId}`;
    const earlier = pairRow.get(pair);
    if (earlier !== undefined) {
      log.error('duplicate_return', `Scenario "${scenarioId}" and asset "${assetId}" already have a return on row ${earlier}.`, SHEET_NAMES.returns, row.rowNumber, 'ReturnPct');
      continue;
    }
    pairRow.set(pair, row.rowNumber);
    if (references && returnPct !== undefined) returns.set(pair, returnPct);
  }
  for (const scenarioId of scenarioRows.ids) {
    for (const assetId of assets.ids) {
      if (!pairRow.has(`${scenarioId}|${assetId}`)) {
        log.error('missing_return', `No return is listed for scenario "${scenarioId}" and asset "${assetId}". Add a row to the Returns sheet.`, SHEET_NAMES.returns, undefined, 'ReturnPct');
      }
    }
  }

  if (log.hasErrors) return { ok: false, issues: log.errors };

  if (settings.get('SchemaVersion') !== SCHEMA_VERSION) {
    return fail('schema_version', `This workbook uses format version ${String(settings.get('SchemaVersion'))}; SimuLab reads version ${SCHEMA_VERSION}.`);
  }

  /* 7. Map to the typed model. */
  const num = (key: string): number => Number(settings.get(key));
  const config: SimulationConfig = {
    schemaVersion: SCHEMA_VERSION,
    name: String(settings.get('ConfigName')),
    startingBalance: num('StartingBalance'),
    annualFeePct: num('AnnualFeePct'),
    assets: [...assets.items.values()].map(({ item }) => item),
    riskProfiles: [...profiles.items.values()].map(({ item }) => item),
    scenarios: [...scenarioRows.items.values()]
      .map(({ item }) => item)
      .sort((a, b) => a.round - b.round)
      .map(({ round: _round, ...scenario }) => ({
        ...scenario,
        returnsPct: Object.fromEntries([...assets.items.keys()].map((assetId) => [assetId, returns.get(`${scenario.id}|${assetId}`) ?? Number.NaN])),
      })),
    scoring: {
      weights: { performancePct: num('WeightPerformancePct'), riskFitPct: num('WeightRiskFitPct'), diversificationPct: num('WeightDiversificationPct') },
      performanceBaseScore: num('PerformanceBaseScore'),
      performancePointsPerReturnPct: num('PerformancePointsPerReturnPct'),
      riskFitPenaltyPerRiskPoint: num('RiskFitPenaltyPerRiskPoint'),
    },
  };

  /* 8. The shared model rules (ranges, weights total, negative-balance guard), mapped back to sheets. */
  const check = validateConfig(config);
  if (!check.ok) {
    return {
      ok: false,
      issues: check.issues.map((item) => ({ ...item, location: { sheet: sheetForPath(item.location?.path ?? ''), ...(item.location?.path ? { path: item.location.path } : {}) } })),
    };
  }

  const summary: ImportSummary = {
    configName: config.name,
    assetCount: config.assets.length,
    scenarioCount: config.scenarios.length,
    riskProfileCount: config.riskProfiles.length,
    startingBalance: config.startingBalance,
    annualFeePct: config.annualFeePct,
  };
  return { ok: true, config: check.config, warnings: log.warnings, summary };
}
