import { formatCurrency, formatNumber, formatPct, formatReturn, formatScore } from '../utils/format';
import type { RoundOutcome, SimulationConfig } from './types';

/**
 * Turns a calculated outcome into plain-language explanations. These functions only describe numbers
 * that the calculation engine has already produced; they never calculate anything new.
 */

export interface CalculationStep {
  label: string;
  /** The formula with the student's numbers substituted in. */
  expression: string;
  result: string;
}

export function calculationSteps(outcome: RoundOutcome, config: SimulationConfig): CalculationStep[] {
  const terms = outcome.contributions
    .filter((term) => term.weight > 0)
    .map((term) => `${formatNumber(term.weight, 4)} × ${formatPct(term.returnPct)}`);
  return [
    {
      label: 'Gross return',
      expression: terms.length > 0 ? terms.join(' + ') : '0',
      result: formatReturn(outcome.grossReturn, 2, false),
    },
    {
      label: 'Net return',
      expression: `${formatReturn(outcome.grossReturn, 2, false)} − ${formatPct(config.annualFeePct)} fee`,
      result: formatReturn(outcome.netReturn, 2, false),
    },
    {
      label: 'Ending balance',
      expression: `${formatCurrency(outcome.startingBalance)} × (1 + ${formatReturn(outcome.netReturn, 2, false)})`,
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
      formula: `clamp(${formatNumber(scoring.performanceBaseScore)} + ${formatNumber(scoring.performancePointsPerReturnPct)} × ${formatNumber(netPct, 2)}, 0, 100)`,
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
