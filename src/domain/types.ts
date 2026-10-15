/**
 * Typed domain model for SimuLab.
 *
 * Units convention (used everywhere in this codebase):
 *  - Fields ending in `Pct` are percentage POINTS (8 means 8%).
 *  - `grossReturn`, `netReturn` and `feeRate` are decimal FRACTIONS (0.08 means 8%).
 *  - Scores are on a 0-100 scale.
 */

export type AssetId = string;

export interface Asset {
  id: AssetId;
  name: string;
  description: string;
  /** Illustrative risk rating on a 0-100 scale (0 = no modelled risk, 100 = highest). */
  riskRating: number;
}

export interface RiskProfile {
  id: string;
  name: string;
  description: string;
  /** Target portfolio risk on the same 0-100 scale as Asset.riskRating. */
  targetRisk: number;
}

export interface ScoreWeights {
  performancePct: number;
  riskFitPct: number;
  diversificationPct: number;
}

export interface ScoringConfig {
  weights: ScoreWeights;
  /** Performance score when net return is exactly 0%. */
  performanceBaseScore: number;
  /** Performance score points gained per percentage point of net return. */
  performancePointsPerReturnPct: number;
  /** Risk-fit points lost per point of distance between portfolio risk and target risk. */
  riskFitPenaltyPerRiskPoint: number;
}

/** A market scenario. Its position in SimulationConfig.scenarios is its round. */
export interface Scenario {
  id: string;
  title: string;
  phase: string;
  description: string;
  lesson: string;
  /** Return for each asset in this scenario, in percentage points. */
  returnsPct: Record<AssetId, number>;
}

export interface SimulationConfig {
  schemaVersion: number;
  name: string;
  startingBalance: number;
  /** Annual management fee, as percentage points of the starting balance of each round. */
  annualFeePct: number;
  assets: Asset[];
  riskProfiles: RiskProfile[];
  /** Order of this array is the round order: scenarios[0] is round 1. */
  scenarios: Scenario[];
  scoring: ScoringConfig;
}

/** A round of the simulation: its 1-based number and the scenario played in it. */
export interface RoundConfig {
  round: number;
  scenario: Scenario;
}

export type AllocationPct = Record<AssetId, number>;

export interface StudentDecision {
  /** 1-based round number the decision is for. */
  round: number;
  allocationPct: AllocationPct;
  riskProfileId: string;
}

export interface ScoreSet {
  performance: number;
  riskFit: number;
  diversification: number;
  overall: number;
}

export type ScoreComponents = Omit<ScoreSet, 'overall'>;

export interface AssetContribution {
  assetId: AssetId;
  /** Decimal weight (0.25 means 25%). */
  weight: number;
  returnPct: number;
  /** weight x return, in percentage points of portfolio return. */
  contributionPct: number;
}

/** Outcome of evaluating one decision. Pure data, produced by evaluateRound(). */
export interface RoundOutcome {
  round: number;
  scenarioId: string;
  scenarioTitle: string;
  decision: StudentDecision;
  startingBalance: number;
  grossReturn: number;
  feeRate: number;
  netReturn: number;
  endingBalance: number;
  change: number;
  contributions: AssetContribution[];
  portfolioRisk: number;
  targetRisk: number;
  hhi: number;
  scores: ScoreSet;
}

/** Immutable record of one submitted decision and its outcome. */
export interface RoundResult extends RoundOutcome {
  submittedAt: string;
}

export type SessionStatus = 'in_progress' | 'complete' | 'abandoned';

export interface SimulationSession {
  id: string;
  /** Optional nickname chosen by the participant. Not an identity: the UI asks people not to use real names. */
  participantLabel: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  /** Snapshot of the configuration the session started with, so its results stay reproducible. */
  config: SimulationConfig;
  results: RoundResult[];
}

export type IssueSeverity = 'error' | 'warning';

export interface IssueLocation {
  sheet?: string;
  /** Spreadsheet row number as shown in Excel (the header row is row 1). */
  row?: number;
  column?: string;
  /** A1-style cell reference on that sheet, e.g. "C4", when the column could be located. */
  cell?: string;
  /** Dotted path into the typed model, e.g. `scenarios[1].returnsPct.cash`. */
  path?: string;
}

/** A validation problem found in a configuration, a workbook or a decision. */
export interface ValidationIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  location?: IssueLocation;
}

export interface ImportSummary {
  configName: string;
  assetCount: number;
  scenarioCount: number;
  riskProfileCount: number;
  startingBalance: number;
  annualFeePct: number;
}

export type SpreadsheetImportResult =
  | { ok: true; config: SimulationConfig; warnings: ValidationIssue[]; summary: ImportSummary }
  | { ok: false; issues: ValidationIssue[] };

export interface SessionStats {
  roundsCompleted: number;
  totalRounds: number;
  currentBalance: number;
  /** Total return as a decimal fraction of the starting balance. */
  totalReturn: number;
  averageScore: number | null;
  averageComponents: ScoreComponents | null;
  rating: string | null;
}
