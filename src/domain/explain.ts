import { formatCurrency, formatNumber, formatPct, formatReturn, formatScore } from '../utils/format';
import type { RoundOutcome, SimulationConfig } from './types';

/**
 * Turns a calculated outcome into plain-language explanations. These functions only describe numbers
 * that the calculation engine has already produced; they never calculate anything new.
 */

/** Wraps a negative number in parentheses so "0.3 × -1%" reads as "0.3 × (-1%)". */
const term = (text: string, value: number): string => (value < 0 ? `(${text})` : text);

export interface CalculationStep {
  label: string;
  /** The general formula, as written in docs/MODEL_SPEC.md. */
  formula: string;
  /** The formula with the student's numbers substituted in. */
  expression: string;
  result: string;
}

export function calculationSteps(outcome: RoundOutcome, config: SimulationConfig): CalculationStep[] {
  const terms = outcome.contributions
    .filter((term) => term.weight > 0)
    .map((item) => `${formatNumber(item.weight, 4)} × ${term(formatPct(item.returnPct), item.returnPct)}`);
  return [
    {
      label: 'Gross return',
      formula: 'Σ weight × asset return',
      expression: terms.length > 0 ? terms.join(' + ') : '0',
      result: formatReturn(outcome.grossReturn, 2, false),
    },
    {
      label: 'Net return',
      formula: 'gross return − annual fee',
      expression: `${formatReturn(outcome.grossReturn, 2, false)} − ${formatPct(config.annualFeePct)} fee`,
      result: formatReturn(outcome.netReturn, 2, false),
    },
    {
      label: 'Ending balance',
      formula: 'starting balance × (1 + net return)',
      expression:
        outcome.netReturn < 0
          ? `${formatCurrency(outcome.startingBalance)} × (1 − ${formatReturn(Math.abs(outcome.netReturn), 2, false)})`
          : `${formatCurrency(outcome.startingBalance)} × (1 + ${formatReturn(outcome.netReturn, 2, false)})`,
      result: formatCurrency(outcome.endingBalance),
    },
  ];
}

export type ScoreKey = 'performance' | 'riskFit' | 'diversification';

export interface ScoreExplanation {
  key: ScoreKey;
  label: string;
  score: number;
  weightPct: number;
  /** Points this component adds to the overall score (weight x score). */
  points: number;
  formula: string;
  reason: string;
}

export function explainScores(outcome: RoundOutcome, config: SimulationConfig, profileName: string): ScoreExplanation[] {
  const { scoring } = config;
  const netPct = outcome.netReturn * 100;
  const distance = Math.abs(outcome.portfolioRisk - outcome.targetRisk);
  const direction = outcome.portfolioRisk > outcome.targetRisk ? 'above' : 'below';
  const assetCount = config.assets.length;
  const minHhi = 1 / assetCount;

  const performanceReason =
    outcome.scores.performance >= 100
      ? 'Net return was high enough to reach the maximum score.'
      : outcome.scores.performance <= 0
        ? 'Net return was low enough to reach the minimum score.'
        : netPct >= 0
          ? `A net ${formatReturn(outcome.netReturn)} adds points above the ${formatNumber(scoring.performanceBaseScore)} base.`
          : `A net ${formatReturn(outcome.netReturn)} takes points below the ${formatNumber(scoring.performanceBaseScore)} base.`;

  const riskReason =
    distance < 1e-9
      ? `Your portfolio risk of ${formatNumber(outcome.portfolioRisk, 1)} matches the ${profileName} target exactly.`
      : `Your portfolio risk of ${formatNumber(outcome.portfolioRisk, 1)} is ${formatNumber(distance, 1)} points ${direction} the ${profileName} target of ${formatNumber(outcome.targetRisk, 1)}.`;

  const diversificationReason =
    outcome.hhi - minHhi < 1e-9
      ? `An even split gives the lowest possible concentration (HHI ${formatNumber(minHhi, 4)}).`
      : outcome.hhi > 1 - 1e-9
        ? 'Everything is in one asset, the highest possible concentration (HHI 1).'
        : `Concentration (HHI) is ${formatNumber(outcome.hhi, 4)}; an even split across ${assetCount} assets would be ${formatNumber(minHhi, 4)}.`;

  const rows: Array<Omit<ScoreExplanation, 'points'>> = [
    {
      key: 'performance',
      label: 'Performance',
      score: outcome.scores.performance,
      weightPct: scoring.weights.performancePct,
      formula: `clamp(${formatNumber(scoring.performanceBaseScore)} + ${formatNumber(scoring.performancePointsPerReturnPct)} × ${term(formatNumber(netPct, 2), netPct)}, 0, 100)`,
      reason: performanceReason,
    },
    {
      key: 'riskFit',
      label: 'Risk fit',
      score: outcome.scores.riskFit,
      weightPct: scoring.weights.riskFitPct,
      formula: `clamp(100 − ${formatNumber(scoring.riskFitPenaltyPerRiskPoint)} × |${formatNumber(outcome.portfolioRisk, 2)} − ${formatNumber(outcome.targetRisk, 2)}|, 0, 100)`,
      reason: riskReason,
    },
    {
      key: 'diversification',
      label: 'Diversification',
      score: outcome.scores.diversification,
      weightPct: scoring.weights.diversificationPct,
      formula: `100 × (1 − ${formatNumber(outcome.hhi, 4)}) ÷ (1 − 1/${assetCount})`,
      reason: diversificationReason,
    },
  ];
  return rows.map((row) => ({ ...row, points: (row.weightPct / 100) * row.score }));
}

export const overallFormula = (explanations: ReadonlyArray<ScoreExplanation>): string =>
  explanations.map((row) => `${formatNumber(row.weightPct / 100, 4)} × ${formatScore(row.score)}`).join(' + ');

/* ------------------------------------------------------------------ */
/* Round statement and feedback                                       */
/* ------------------------------------------------------------------ */

/**
 * A round as a small money statement. Every amount is the engine's own result multiplied out; nothing
 * is recalculated. startingBalance + grossAmount - feeAmount equals endingBalance (up to floating-point
 * dust far below a cent).
 */
export interface RoundStatement {
  startingBalance: number;
  grossReturn: number;
  grossAmount: number;
  feeRate: number;
  feeAmount: number;
  netReturn: number;
  endingBalance: number;
}

export function roundStatement(outcome: RoundOutcome): RoundStatement {
  return {
    startingBalance: outcome.startingBalance,
    grossReturn: outcome.grossReturn,
    grossAmount: outcome.startingBalance * outcome.grossReturn,
    feeRate: outcome.feeRate,
    feeAmount: outcome.startingBalance * outcome.feeRate,
    netReturn: outcome.netReturn,
    endingBalance: outcome.endingBalance,
  };
}

export interface FeedbackPoint {
  key: ScoreKey;
  /** Points of the overall score this component gave up: weight x (100 - score). */
  pointsLost: number;
  text: string;
}

const assetName = (config: SimulationConfig, id: string): string => config.assets.find((asset) => asset.id === id)?.name ?? id;

/**
 * Plain-language feedback for one round, ordered from the component that cost the most overall points
 * to the one that cost the least. Every sentence is derived from the outcome and the configuration; it
 * describes trade-offs and never claims there was one correct allocation.
 */
export function roundFeedback(outcome: RoundOutcome, config: SimulationConfig, profileName: string): FeedbackPoint[] {
  const { weights } = config.scoring;
  const lost = (weightPct: number, score: number) => (weightPct / 100) * (100 - score);
  const held = outcome.contributions.filter((item) => item.weight > 0);

  // Performance: which holdings added and subtracted the most return.
  const sorted = [...held].sort((a, b) => b.contributionPct - a.contributionPct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const describe = (item: (typeof held)[number]) =>
    `${assetName(config, item.assetId)} (${formatNumber(item.weight * 100, 0)}% × ${term(formatPct(item.returnPct), item.returnPct)} = ${formatPct(item.contributionPct, 2, true)} of return)`;
  let performance = `Your net return after the ${formatPct(config.annualFeePct)} fee was ${formatReturn(outcome.netReturn)}.`;
  if (best && best.contributionPct > 0) performance += ` The largest contribution came from ${describe(best)}.`;
  if (worst && worst !== best && worst.contributionPct < 0) performance += ` The largest drag was ${describe(worst)}.`;

  // Risk fit: how far from the target, and the smallest single move that would close the gap.
  const gap = outcome.portfolioRisk - outcome.targetRisk;
  let riskFit: string;
  if (Math.abs(gap) < 0.5) {
    riskFit = `Your portfolio risk of ${formatNumber(outcome.portfolioRisk, 1)} sat on the ${profileName} target of ${formatNumber(outcome.targetRisk, 1)}.`;
  } else {
    const above = gap > 0;
    // Move money out of the held asset that pushes risk the wrong way (largest holding breaks ties)…
    const heldAssets = config.assets
      .filter((asset) => (outcome.decision.allocationPct[asset.id] ?? 0) > 0)
      .sort((a, b) => (above ? b.riskRating - a.riskRating : a.riskRating - b.riskRating) || (outcome.decision.allocationPct[b.id] ?? 0) - (outcome.decision.allocationPct[a.id] ?? 0));
    // …into the asset that pulls it furthest the other way.
    const receivers = [...config.assets].sort((a, b) => (above ? a.riskRating - b.riskRating : b.riskRating - a.riskRating));
    const from = heldAssets[0];
    const to = receivers[0];
    riskFit = `Your portfolio risk of ${formatNumber(outcome.portfolioRisk, 1)} was ${formatNumber(Math.abs(gap), 1)} points ${above ? 'above' : 'below'} the ${profileName} target of ${formatNumber(outcome.targetRisk, 1)}.`;
    if (from && to && from.riskRating !== to.riskRating) {
      const shift = (Math.abs(gap) * 100) / Math.abs(from.riskRating - to.riskRating);
      const available = (outcome.decision.allocationPct[from.id] ?? 0) >= shift;
      riskFit += available
        ? ` Moving about ${formatNumber(shift, 1)} percentage points from ${from.name} (risk ${formatNumber(from.riskRating)}) to ${to.name} (risk ${formatNumber(to.riskRating)}) would have closed the gap.`
        : ` Shifting money ${above ? `towards lower-rated assets such as ${to.name}` : `towards higher-rated assets such as ${to.name}`} would have moved it closer.`;
    } else if (from && to) {
      riskFit += ' Every asset has the same risk rating, so the allocation cannot change portfolio risk.';
    }
  }

  // Diversification: the largest holding against an even split.
  const largest = [...held].sort((a, b) => b.weight - a.weight)[0];
  const even = 100 / config.assets.length;
  const diversification =
    outcome.scores.diversification >= 99.9995
      ? 'Your money was spread evenly, the maximum diversification score.'
      : `Your largest holding was ${largest ? `${assetName(config, largest.assetId)} at ${formatNumber(largest.weight * 100, 0)}%` : 'a single asset'}; an even split (${formatNumber(even, 1)}% each) gives the maximum diversification score, but may not suit your target risk.`;

  const points: FeedbackPoint[] = [
    { key: 'performance', pointsLost: lost(weights.performancePct, outcome.scores.performance), text: performance },
    { key: 'riskFit', pointsLost: lost(weights.riskFitPct, outcome.scores.riskFit), text: riskFit },
    { key: 'diversification', pointsLost: lost(weights.diversificationPct, outcome.scores.diversification), text: diversification },
  ];
  return points.sort((a, b) => b.pointsLost - a.pointsLost);
}
