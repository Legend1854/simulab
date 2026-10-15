import { ALLOCATION_TOTAL_PCT, FLOAT_TOLERANCE, ID_PATTERN, LIMITS, SCHEMA_VERSION } from './constants';
import type { Asset, SimulationConfig, StudentDecision, ValidationIssue } from './types';

/* ------------------------------------------------------------------ */
/* Allocation validation                                              */
/* ------------------------------------------------------------------ */

export interface AllocationValidation {
  valid: boolean;
  /** Sum of the numeric values entered so far (non-numbers count as 0). */
  total: number;
  /** Error text keyed by asset id, shown next to the relevant control. */
  fieldErrors: Record<string, string>;
  /** Summary message about the allocation as a whole. */
  message: string;
}

/**
 * An allocation is valid when every asset has a whole-number percentage between 0 and 100
 * and the total is exactly 100. Requiring whole numbers keeps the total exact, so no
 * floating-point tolerance is needed (documented in MODEL_SPEC.md).
 */
export function validateAllocation(
  allocationPct: unknown,
  assets: ReadonlyArray<Pick<Asset, 'id' | 'name'>>,
): AllocationValidation {
  const fieldErrors: Record<string, string> = {};
  if (typeof allocationPct !== 'object' || allocationPct === null) {
    return { valid: false, total: 0, fieldErrors, message: 'Enter an allocation for each asset.' };
  }
  const record = allocationPct as Record<string, unknown>;
  let total = 0;
  for (const asset of assets) {
    const value = Object.hasOwn(record, asset.id) ? record[asset.id] : undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fieldErrors[asset.id] = `Enter a percentage for ${asset.name}.`;
      continue;
    }
    total += value;
    if (!Number.isInteger(value)) fieldErrors[asset.id] = `${asset.name} must be a whole number.`;
    else if (value < 0 || value > ALLOCATION_TOTAL_PCT) fieldErrors[asset.id] = `${asset.name} must be between 0% and 100%.`;
  }
  const knownIds = new Set(assets.map((asset) => asset.id));
  const unknown = Object.keys(record).filter((key) => !knownIds.has(key));
  if (unknown.length > 0) {
    return { valid: false, total, fieldErrors, message: `Unknown asset in allocation: ${unknown.join(', ')}.` };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, total, fieldErrors, message: 'Fix the highlighted allocations.' };
  }
  if (total !== ALLOCATION_TOTAL_PCT) {
    const gap = Math.abs(ALLOCATION_TOTAL_PCT - total);
    const direction = total < ALLOCATION_TOTAL_PCT ? 'left to allocate' : 'over the limit';
    return { valid: false, total, fieldErrors, message: `Allocations must total 100%. You have ${gap}% ${direction}.` };
  }
  return { valid: true, total, fieldErrors, message: 'Allocation totals 100% and is ready to submit.' };
}

/** Returns a problem description, or null when the decision can be submitted for `expectedRound`. */
export function validateDecision(decision: StudentDecision, config: SimulationConfig, expectedRound: number): string | null {
  if (decision.round !== expectedRound) {
    return `This decision is for round ${decision.round}, but round ${expectedRound} is next.`;
  }
  if (!config.riskProfiles.some((profile) => profile.id === decision.riskProfileId)) {
    return 'Choose a risk profile.';
  }
  const check = validateAllocation(decision.allocationPct, config.assets);
  return check.valid ? null : check.message;
}

/* ------------------------------------------------------------------ */
/* Configuration validation (the boundary check for untrusted input)  */
/* ------------------------------------------------------------------ */

export type ConfigValidation = { ok: true; config: SimulationConfig } | { ok: false; issues: ValidationIssue[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const issue = (code: string, message: string, path: string): ValidationIssue => ({
  code,
  severity: 'error',
  message,
  location: { path },
});

class Checker {
  readonly issues: ValidationIssue[] = [];

  number(value: unknown, path: string, label: string, min: number, max: number, exclusiveMin = false): value is number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.issues.push(issue('not_a_number', `${label} must be a number.`, path));
      return false;
    }
    const belowMin = exclusiveMin ? value <= min : value < min;
    if (belowMin || value > max) {
      const lower = exclusiveMin ? `greater than ${min}` : `at least ${min}`;
      this.issues.push(issue('out_of_range', `${label} must be ${lower} and no more than ${max}.`, path));
      return false;
    }
    return true;
  }

  text(value: unknown, path: string, label: string, maxLength: number, required: boolean): value is string {
    if (typeof value !== 'string') {
      this.issues.push(issue('not_text', `${label} must be text.`, path));
      return false;
    }
    if (required && value.trim().length === 0) {
      this.issues.push(issue('required', `${label} is required.`, path));
      return false;
    }
    if (value.length > maxLength) {
      this.issues.push(issue('too_long', `${label} must be ${maxLength} characters or fewer.`, path));
      return false;
    }
    return true;
  }

  id(value: unknown, path: string, label: string, seen: Set<string>): value is string {
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
      this.issues.push(
        issue('invalid_id', `${label} must start with a lower-case letter and use only a-z, 0-9 and _ (max 32 characters).`, path),
      );
      return false;
    }
    if (seen.has(value)) {
      this.issues.push(issue('duplicate_id', `Duplicate ${label.toLowerCase()} "${value}".`, path));
      return false;
    }
    seen.add(value);
    return true;
  }
}

/**
 * Validates anything that claims to be a SimulationConfig. This is the single gate used by
 * browser storage, the instructor editor and the spreadsheet importer, so the same rules
 * apply wherever a configuration comes from. TypeScript types are not trusted at this boundary.
 */
export function validateConfig(input: unknown): ConfigValidation {
  const check = new Checker();
  if (!isRecord(input)) return { ok: false, issues: [issue('not_an_object', 'Configuration must be an object.', '')] };

  if (input.schemaVersion !== SCHEMA_VERSION) {
    check.issues.push(issue('schema_version', `Unsupported schema version (expected ${SCHEMA_VERSION}).`, 'schemaVersion'));
  }
  check.text(input.name, 'name', 'Simulation name', LIMITS.maxNameLength, true);
  check.number(input.startingBalance, 'startingBalance', 'Starting balance', 0, LIMITS.maxStartingBalance, true);
  const feeOk = check.number(input.annualFeePct, 'annualFeePct', 'Annual fee (%)', 0, LIMITS.maxFeePct);

  /* Assets */
  const assetIds: string[] = [];
  if (!Array.isArray(input.assets)) {
    check.issues.push(issue('not_a_list', 'Assets must be a list.', 'assets'));
  } else {
    if (input.assets.length < LIMITS.minAssets || input.assets.length > LIMITS.maxAssets) {
      check.issues.push(issue('asset_count', `There must be between ${LIMITS.minAssets} and ${LIMITS.maxAssets} assets.`, 'assets'));
    }
    const seen = new Set<string>();
    input.assets.forEach((raw: unknown, index: number) => {
      const path = `assets[${index}]`;
      if (!isRecord(raw)) {
        check.issues.push(issue('not_an_object', 'Asset must be an object.', path));
        return;
      }
      if (check.id(raw.id, `${path}.id`, 'Asset ID', seen)) assetIds.push(raw.id);
      check.text(raw.name, `${path}.name`, 'Asset name', LIMITS.maxNameLength, true);
      check.text(raw.description, `${path}.description`, 'Asset description', LIMITS.maxTextLength, false);
      check.number(raw.riskRating, `${path}.riskRating`, 'Risk rating', 0, 100);
    });
  }

  /* Risk profiles */
  if (!Array.isArray(input.riskProfiles)) {
    check.issues.push(issue('not_a_list', 'Risk profiles must be a list.', 'riskProfiles'));
  } else {
    if (input.riskProfiles.length < LIMITS.minRiskProfiles || input.riskProfiles.length > LIMITS.maxRiskProfiles) {
      check.issues.push(
        issue('profile_count', `There must be between ${LIMITS.minRiskProfiles} and ${LIMITS.maxRiskProfiles} risk profiles.`, 'riskProfiles'),
      );
    }
    const seen = new Set<string>();
    input.riskProfiles.forEach((raw: unknown, index: number) => {
      const path = `riskProfiles[${index}]`;
      if (!isRecord(raw)) {
        check.issues.push(issue('not_an_object', 'Risk profile must be an object.', path));
        return;
      }
      check.id(raw.id, `${path}.id`, 'Risk profile ID', seen);
      check.text(raw.name, `${path}.name`, 'Risk profile name', LIMITS.maxNameLength, true);
      check.text(raw.description, `${path}.description`, 'Risk profile description', LIMITS.maxTextLength, false);
      check.number(raw.targetRisk, `${path}.targetRisk`, 'Target risk', 0, 100);
    });
  }

  /* Scoring */
  if (!isRecord(input.scoring) || !isRecord(input.scoring.weights)) {
    check.issues.push(issue('missing_scoring', 'Scoring settings are required.', 'scoring'));
  } else {
    const { weights } = input.scoring;
    const a = check.number(weights.performancePct, 'scoring.weights.performancePct', 'Performance weight (%)', 0, 100);
    const b = check.number(weights.riskFitPct, 'scoring.weights.riskFitPct', 'Risk-fit weight (%)', 0, 100);
    const c = check.number(weights.diversificationPct, 'scoring.weights.diversificationPct', 'Diversification weight (%)', 0, 100);
    if (a && b && c) {
      const total = (weights.performancePct as number) + (weights.riskFitPct as number) + (weights.diversificationPct as number);
      if (Math.abs(total - 100) > FLOAT_TOLERANCE) {
        check.issues.push(
          issue('weights_total', `Score weights must total 100% (currently ${Number(total.toFixed(6))}%).`, 'scoring.weights'),
        );
      }
    }
    check.number(input.scoring.performanceBaseScore, 'scoring.performanceBaseScore', 'Performance base score', 0, 100);
    check.number(
      input.scoring.performancePointsPerReturnPct, 'scoring.performancePointsPerReturnPct',
      'Performance points per 1% return', 0, LIMITS.maxPerformancePointsPerPct, true,
    );
    check.number(
      input.scoring.riskFitPenaltyPerRiskPoint, 'scoring.riskFitPenaltyPerRiskPoint',
      'Risk-fit penalty per risk point', 0, LIMITS.maxRiskFitPenalty, true,
    );
  }

  /* Scenarios (one per round, in order) */
  if (!Array.isArray(input.scenarios)) {
    check.issues.push(issue('not_a_list', 'Scenarios must be a list.', 'scenarios'));
  } else {
    if (input.scenarios.length < LIMITS.minRounds || input.scenarios.length > LIMITS.maxRounds) {
      check.issues.push(
        issue('scenario_count', `There must be between ${LIMITS.minRounds} and ${LIMITS.maxRounds} scenarios (one per round).`, 'scenarios'),
      );
    }
    const seen = new Set<string>();
    input.scenarios.forEach((raw: unknown, index: number) => {
      const path = `scenarios[${index}]`;
      if (!isRecord(raw)) {
        check.issues.push(issue('not_an_object', 'Scenario must be an object.', path));
        return;
      }
      const label = typeof raw.title === 'string' && raw.title.trim() ? `Round ${index + 1} (${raw.title.trim()})` : `Round ${index + 1}`;
      check.id(raw.id, `${path}.id`, 'Scenario ID', seen);
      check.text(raw.title, `${path}.title`, `${label} title`, LIMITS.maxTitleLength, true);
      check.text(raw.phase, `${path}.phase`, `${label} phase`, LIMITS.maxTitleLength, false);
      check.text(raw.description, `${path}.description`, `${label} description`, LIMITS.maxTextLength, false);
      check.text(raw.lesson, `${path}.lesson`, `${label} learning focus`, LIMITS.maxTextLength, false);
      if (!isRecord(raw.returnsPct)) {
        check.issues.push(issue('missing_returns', `${label} needs a return for every asset.`, `${path}.returnsPct`));
        return;
      }
      const returns = raw.returnsPct;
      const validReturns: number[] = [];
      for (const assetId of assetIds) {
        const returnPath = `${path}.returnsPct.${assetId}`;
        if (!Object.hasOwn(returns, assetId)) {
          check.issues.push(issue('missing_return', `${label} has no return for asset "${assetId}".`, returnPath));
        } else if (check.number(returns[assetId], returnPath, `${label} return for "${assetId}"`, LIMITS.minReturnPct, LIMITS.maxReturnPct)) {
          validReturns.push(returns[assetId] as number);
        }
      }
      for (const key of Object.keys(returns)) {
        if (!assetIds.includes(key)) {
          check.issues.push(issue('unknown_asset', `${label} has a return for unknown asset "${key}".`, `${path}.returnsPct.${key}`));
        }
      }
      // The balance must never go negative: a 100% allocation to the worst asset, minus the fee, must stay >= -100%.
      if (feeOk && validReturns.length > 0) {
        const worst = Math.min(...validReturns);
        const fee = input.annualFeePct as number;
        if (worst - fee < -100 - FLOAT_TOLERANCE) {
          check.issues.push(
            issue(
              'negative_balance',
              `${label}: a worst-case return of ${worst}% with a ${fee}% fee would take the balance below zero.`,
              `${path}.returnsPct`,
            ),
          );
        }
      }
    });
  }

  return check.issues.length > 0 ? { ok: false, issues: check.issues } : { ok: true, config: input as unknown as SimulationConfig };
}

/** Field-level messages keyed by model path, for forms that show errors next to inputs. */
export function issuesByPath(issues: ReadonlyArray<ValidationIssue>): Record<string, string> {
  const byPath: Record<string, string> = {};
  for (const item of issues) {
    const path = item.location?.path;
    if (path !== undefined && !(path in byPath)) byPath[path] = item.message;
  }
  return byPath;
}
