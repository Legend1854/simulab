import { LIMITS, SCHEMA_VERSION } from '../../domain/constants';

/**
 * SimuLab workbook format, version 1. This file is the single source of truth for the format:
 * the importer reads it, the exporter writes the Instructions sheet from it, and docs/MODEL_SPEC.md
 * describes it.
 */

export const SHEET_NAMES = {
  instructions: 'Instructions',
  settings: 'Settings',
  assets: 'Assets',
  riskProfiles: 'RiskProfiles',
  scenarios: 'Scenarios',
  returns: 'Returns',
} as const;

/** Sheets the importer requires. Instructions is optional and ignored on import. */
export const REQUIRED_SHEETS = [SHEET_NAMES.settings, SHEET_NAMES.assets, SHEET_NAMES.riskProfiles, SHEET_NAMES.scenarios, SHEET_NAMES.returns] as const;

export const FILE_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024,
  maxRows: 500,
  maxColumns: 20,
  maxReportedIssues: 100,
} as const;

export type ColumnType = 'text' | 'number' | 'integer';

export interface ColumnSpec {
  name: string;
  required: boolean;
  type: ColumnType;
  description: string;
  range: string;
}

const ID_RULE = 'a-z, 0-9 and _ only; starts with a letter; max 32 characters';

export const COLUMNS = {
  settings: [
    { name: 'Key', required: true, type: 'text', description: 'Setting name (see the Settings keys table).', range: 'one of the documented keys' },
    { name: 'Value', required: true, type: 'text', description: 'Setting value.', range: 'depends on the key' },
    { name: 'Notes', required: false, type: 'text', description: 'Free-text notes, ignored on import.', range: 'any text' },
  ],
  assets: [
    { name: 'AssetId', required: true, type: 'text', description: 'Unique identifier, referenced by the Returns sheet.', range: ID_RULE },
    { name: 'Name', required: true, type: 'text', description: 'Name shown to students.', range: `max ${LIMITS.maxNameLength} characters` },
    { name: 'Description', required: false, type: 'text', description: 'Short helper text beside the allocation control.', range: `max ${LIMITS.maxTextLength} characters` },
    { name: 'RiskRating', required: true, type: 'number', description: 'Illustrative risk rating of the asset.', range: '0 to 100' },
  ],
  riskProfiles: [
    { name: 'ProfileId', required: true, type: 'text', description: 'Unique identifier.', range: ID_RULE },
    { name: 'Name', required: true, type: 'text', description: 'Name shown to students.', range: `max ${LIMITS.maxNameLength} characters` },
    { name: 'Description', required: false, type: 'text', description: 'Short helper text.', range: `max ${LIMITS.maxTextLength} characters` },
    { name: 'TargetRisk', required: true, type: 'number', description: 'Target weighted portfolio risk for this profile.', range: '0 to 100' },
  ],
  scenarios: [
    { name: 'ScenarioId', required: true, type: 'text', description: 'Unique identifier, referenced by the Returns sheet.', range: ID_RULE },
    { name: 'Round', required: true, type: 'integer', description: 'Round in which the scenario is played.', range: `1 to ${LIMITS.maxRounds}; unique; no gaps` },
    { name: 'Title', required: true, type: 'text', description: 'Scenario title.', range: `max ${LIMITS.maxTitleLength} characters` },
    { name: 'Phase', required: false, type: 'text', description: 'Short phase label, e.g. "Market shock".', range: `max ${LIMITS.maxTitleLength} characters` },
    { name: 'Description', required: false, type: 'text', description: 'What happens in the market.', range: `max ${LIMITS.maxTextLength} characters` },
    { name: 'Lesson', required: false, type: 'text', description: 'Learning focus shown with the scenario.', range: `max ${LIMITS.maxTextLength} characters` },
  ],
  returns: [
    { name: 'ScenarioId', required: true, type: 'text', description: 'Must exist on the Scenarios sheet.', range: 'an existing ScenarioId' },
    { name: 'AssetId', required: true, type: 'text', description: 'Must exist on the Assets sheet.', range: 'an existing AssetId' },
    { name: 'ReturnPct', required: true, type: 'number', description: 'Asset return in that scenario, in percentage POINTS (8 means 8%).', range: `${LIMITS.minReturnPct} to ${LIMITS.maxReturnPct}` },
  ],
} as const satisfies Record<string, ReadonlyArray<ColumnSpec>>;

export interface SettingSpec {
  key: string;
  type: ColumnType;
  description: string;
  range: string;
}

export const SETTINGS: ReadonlyArray<SettingSpec> = [
  { key: 'SchemaVersion', type: 'integer', description: 'Workbook format version.', range: `must be ${SCHEMA_VERSION}` },
  { key: 'ConfigName', type: 'text', description: 'Name of this configuration.', range: `max ${LIMITS.maxNameLength} characters` },
  { key: 'StartingBalance', type: 'number', description: 'Starting portfolio value in AUD.', range: `greater than 0, up to ${LIMITS.maxStartingBalance}` },
  { key: 'AnnualFeePct', type: 'number', description: 'Annual management fee in percentage points of each round\'s starting balance.', range: `0 to ${LIMITS.maxFeePct}` },
  { key: 'WeightPerformancePct', type: 'number', description: 'Weight of the performance score.', range: '0 to 100; the three weights total 100' },
  { key: 'WeightRiskFitPct', type: 'number', description: 'Weight of the risk-fit score.', range: '0 to 100; the three weights total 100' },
  { key: 'WeightDiversificationPct', type: 'number', description: 'Weight of the diversification score.', range: '0 to 100; the three weights total 100' },
  { key: 'PerformanceBaseScore', type: 'number', description: 'Performance score at a 0% net return.', range: '0 to 100' },
  { key: 'PerformancePointsPerReturnPct', type: 'number', description: 'Performance points per percentage point of net return.', range: `greater than 0, up to ${LIMITS.maxPerformancePointsPerPct}` },
  { key: 'RiskFitPenaltyPerRiskPoint', type: 'number', description: 'Risk-fit points lost per point of distance from the target risk.', range: `greater than 0, up to ${LIMITS.maxRiskFitPenalty}` },
];
