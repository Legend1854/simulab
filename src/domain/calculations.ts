import { ALLOCATION_TOTAL_PCT, FLOAT_TOLERANCE } from './constants';
import { diversificationScore, overallScore, performanceScore, riskFitScore } from './scoring';
import type {
  AllocationPct, Asset, AssetContribution, RoundConfig, RoundOutcome, Scenario, SimulationConfig, StudentDecision,
} from './types';
import { validateAllocation } from './validation';

export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationError';
  }
}

export const percentToFraction = (pct: number): number => pct / 100;

/** The rounds of a configuration: scenarios in order, numbered from 1. */
export function getRounds(config: SimulationConfig): RoundConfig[] {
  return config.scenarios.map((scenario, index) => ({ round: index + 1, scenario }));
}

/**
 * Default allocation: an equal whole-number split, with any remainder given to the first assets
 * (4 assets -> 25/25/25/25; 3 assets -> 34/33/33).
 */
export function equalSplitAllocation(assets: ReadonlyArray<Pick<Asset, 'id'>>): AllocationPct {
  const base = Math.floor(ALLOCATION_TOTAL_PCT / assets.length);
  const remainder = ALLOCATION_TOTAL_PCT - base * assets.length;
  return Object.fromEntries(assets.map((asset, index) => [asset.id, base + (index < remainder ? 1 : 0)]));
}

/** Per-asset contributions and the gross portfolio return: grossReturn = sum(w_i x r_i), both as fractions. */
export function weightedReturn(
  allocationPct: AllocationPct,
  scenario: Scenario,
  assets: ReadonlyArray<Asset>,
): { grossReturn: number; contributions: AssetContribution[] } {
  const contributions: AssetContribution[] = assets.map((asset) => {
    const weight = percentToFraction(allocationPct[asset.id] ?? 0);
    const returnPct = scenario.returnsPct[asset.id];
    if (typeof returnPct !== 'number' || !Number.isFinite(returnPct)) {
      throw new SimulationError(`Scenario "${scenario.title}" has no valid return for ${asset.name}.`);
    }
    return { assetId: asset.id, weight, returnPct, contributionPct: weight * returnPct };
  });
  const grossReturn = contributions.reduce((sum, item) => sum + item.weight * percentToFraction(item.returnPct), 0);
  return { grossReturn, contributions };
}

/** netReturn = grossReturn - annualFeeRate (the fee is a percentage of the round's starting balance). */
export const netReturnAfterFee = (grossReturn: number, annualFeePct: number): number =>
  grossReturn - percentToFraction(annualFeePct);

/** endingBalance = startingBalance x (1 + netReturn). */
export const endingBalanceFor = (startingBalance: number, netReturn: number): number => startingBalance * (1 + netReturn);

/** Weighted portfolio risk on the 0-100 risk-rating scale: sum(w_i x riskRating_i). */
export function portfolioRiskFor(allocationPct: AllocationPct, assets: ReadonlyArray<Asset>): number {
  return assets.reduce((sum, asset) => sum + percentToFraction(allocationPct[asset.id] ?? 0) * asset.riskRating, 0);
}

/** Herfindahl-Hirschman Index: sum(w_i^2). 1 means everything is in one asset. */
export function herfindahlIndex(allocationPct: AllocationPct, assets: ReadonlyArray<Asset>): number {
  return assets.reduce((sum, asset) => sum + percentToFraction(allocationPct[asset.id] ?? 0) ** 2, 0);
}

/**
 * Evaluates one round. Pure and deterministic: no UI, storage, clock or randomness.
 * Nothing is rounded here; rounding happens only when numbers are displayed or exported.
 */
export function evaluateRound(
  config: SimulationConfig,
  roundIndex: number,
  startingBalance: number,
  decision: StudentDecision,
): RoundOutcome {
  const scenario = config.scenarios[roundIndex];
  if (!scenario) throw new SimulationError(`There is no scenario for round ${roundIndex + 1}.`);
  if (!Number.isFinite(startingBalance) || startingBalance < 0) {
    throw new SimulationError('Starting balance must be a non-negative number.');
  }
  const profile = config.riskProfiles.find((candidate) => candidate.id === decision.riskProfileId);
  if (!profile) throw new SimulationError('Unknown risk profile.');
  const check = validateAllocation(decision.allocationPct, config.assets);
  if (!check.valid) throw new SimulationError(check.message);

  const { grossReturn, contributions } = weightedReturn(decision.allocationPct, scenario, config.assets);
  const netReturn = netReturnAfterFee(grossReturn, config.annualFeePct);
  let endingBalance = endingBalanceFor(startingBalance, netReturn);
  if (endingBalance < -FLOAT_TOLERANCE * Math.max(1, startingBalance)) {
    throw new SimulationError('These assumptions would produce a negative balance.');
  }
  if (endingBalance < 0) endingBalance = 0; // floating-point dust around a total loss

  const portfolioRisk = portfolioRiskFor(decision.allocationPct, config.assets);
  const hhi = herfindahlIndex(decision.allocationPct, config.assets);
  const components = {
    performance: performanceScore(netReturn, config.scoring),
    riskFit: riskFitScore(portfolioRisk, profile.targetRisk, config.scoring),
    diversification: diversificationScore(hhi, config.assets.length),
  };

  return {
    round: roundIndex + 1,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    decision: { round: decision.round, riskProfileId: decision.riskProfileId, allocationPct: { ...decision.allocationPct } },
    startingBalance,
    grossReturn,
    feeRate: percentToFraction(config.annualFeePct),
    netReturn,
    endingBalance,
    change: endingBalance - startingBalance,
    contributions,
    portfolioRisk,
    targetRisk: profile.targetRisk,
    hhi,
    scores: { ...components, overall: overallScore(components, config.scoring.weights) },
  };
}
