import * as XLSX from 'xlsx';
import type { SimulationConfig } from '../../domain/types';
import { COLUMNS, SETTINGS, SHEET_NAMES, type ColumnSpec } from './schema';

type Row = Array<string | number>;

function columnTable(title: string, specs: ReadonlyArray<ColumnSpec>): Row[] {
  return [
    [title],
    ['Column', 'Required', 'Type', 'Valid values', 'Meaning'],
    ...specs.map((spec): Row => [spec.name, spec.required ? 'Yes' : 'No', spec.type, spec.range, spec.description]),
    [],
  ];
}

/** Help sheet written into every exported workbook. Generated from schema.ts; ignored on import. */
function instructionsRows(): Row[] {
  return [
    ['SimuLab configuration workbook (format version 1)'],
    ['Defines the assets, risk profiles, scenarios and scoring rules of the SimuLab educational investment simulation.'],
    ['All figures are illustrative and hypothetical. Nothing in this workbook is financial advice.'],
    [],
    ['How to use this workbook'],
    ['1. Edit the Settings, Assets, RiskProfiles, Scenarios and Returns sheets. Keep the sheet names and column headings.'],
    ['2. In SimuLab open Instructor, then Spreadsheet, choose this file and review the preview.'],
    ['3. Nothing changes until you select "Apply configuration" after a successful validation.'],
    [],
    ['Rules'],
    ['Returns and fees are percentage POINTS: type 8 for 8%. Do not apply a percentage cell format.'],
    ['SimuLab does not calculate formulas. For a formula cell it reads the value last saved in the file, so paste values where you can.'],
    ['AssetId, ProfileId and ScenarioId use lower-case letters, digits and underscores, start with a letter and must be unique.'],
    ['The Returns sheet needs exactly one row for every scenario and asset combination.'],
    ['Only .xlsx files up to 2 MB are accepted. Macros, charts, images and extra sheets are ignored.'],
    [],
    ...columnTable('Settings keys (Settings sheet columns: Key, Value, Notes)', SETTINGS.map((s): ColumnSpec => ({ name: s.key, required: true, type: s.type, description: s.description, range: s.range }))),
    ...columnTable('Assets sheet', COLUMNS.assets),
    ...columnTable('RiskProfiles sheet', COLUMNS.riskProfiles),
    ...columnTable('Scenarios sheet', COLUMNS.scenarios),
    ...columnTable('Returns sheet', COLUMNS.returns),
  ];
}

export function buildWorkbook(config: SimulationConfig): XLSX.WorkBook {
  const settingValues: Record<string, string | number> = {
    SchemaVersion: config.schemaVersion,
    ConfigName: config.name,
    StartingBalance: config.startingBalance,
    AnnualFeePct: config.annualFeePct,
    WeightPerformancePct: config.scoring.weights.performancePct,
    WeightRiskFitPct: config.scoring.weights.riskFitPct,
    WeightDiversificationPct: config.scoring.weights.diversificationPct,
    PerformanceBaseScore: config.scoring.performanceBaseScore,
    PerformancePointsPerReturnPct: config.scoring.performancePointsPerReturnPct,
    RiskFitPenaltyPerRiskPoint: config.scoring.riskFitPenaltyPerRiskPoint,
  };
  const headers = (specs: ReadonlyArray<ColumnSpec>): Row => specs.map((spec) => spec.name);
  const sheets: Array<[string, Row[], number[]]> = [
    [SHEET_NAMES.instructions, instructionsRows(), [34, 10, 10, 44, 70]],
    [
      SHEET_NAMES.settings,
      [headers(COLUMNS.settings), ...SETTINGS.map((s): Row => [s.key, settingValues[s.key] ?? '', `${s.description} Valid: ${s.range}.`])],
      [32, 40, 96],
    ],
    [SHEET_NAMES.assets, [headers(COLUMNS.assets), ...config.assets.map((a): Row => [a.id, a.name, a.description, a.riskRating])], [20, 32, 50, 12]],
    [SHEET_NAMES.riskProfiles, [headers(COLUMNS.riskProfiles), ...config.riskProfiles.map((p): Row => [p.id, p.name, p.description, p.targetRisk])], [18, 18, 40, 12]],
    [
      SHEET_NAMES.scenarios,
      [headers(COLUMNS.scenarios), ...config.scenarios.map((s, index): Row => [s.id, index + 1, s.title, s.phase, s.description, s.lesson])],
      [18, 8, 26, 16, 70, 70],
    ],
    [
      SHEET_NAMES.returns,
      [headers(COLUMNS.returns), ...config.scenarios.flatMap((s) => config.assets.map((a): Row => [s.id, a.id, s.returnsPct[a.id] ?? '']))],
      [18, 20, 12],
    ],
  ];
  const workbook = XLSX.utils.book_new();
  for (const [name, rows, widths] of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return workbook;
}

export function workbookBytes(config: SimulationConfig): Uint8Array {
  return new Uint8Array(XLSX.write(buildWorkbook(config), { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}
