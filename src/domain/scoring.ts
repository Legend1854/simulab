import { RATING_BANDS, SCORE_MAX, SCORE_MIN } from './constants';
import type { ScoreComponents, ScoreWeights, ScoringConfig } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const clampScore = (value: number): number => clamp(value, SCORE_MIN, SCORE_MAX);

/**
 * Performance score: clamp(base + pointsPerPct x netReturnPercentage, 0, 100).
 * `netReturn` is a decimal fraction (0.04 = 4%); the formula uses percentage points (4).
 */
export function performanceScore(netReturn: number, scoring: ScoringConfig): number {
  const netReturnPercentage = netReturn * 100;
  return clampScore(scoring.performanceBaseScore + scoring.performancePointsPerReturnPct * netReturnPercentage);
}

/**
 * Risk-fit score: clamp(100 - penalty x |portfolioRisk - targetRisk|, 0, 100).
 * Both risks use the 0-100 asset risk-rating scale.
 */
export function riskFitScore(portfolioRisk: number, targetRisk: number, scoring: ScoringConfig): number {
  return clampScore(SCORE_MAX - scoring.riskFitPenaltyPerRiskPoint * Math.abs(portfolioRisk - targetRisk));
}

/**
 * Diversification score from the Herfindahl-Hirschman Index (HHI = sum of squared weights):
 * 100 x (1 - HHI) / (1 - 1/n). Equal weights give 100; one asset gives 0.
 * Clamped to remove tiny floating-point drift. Needs at least two assets.
 */
export function diversificationScore(hhi: number, assetCount: number): number {
  if (assetCount < 2) throw new RangeError('Diversification needs at least two assets.');
  const maxDiversification = 1 - 1 / assetCount;
  return clampScore((SCORE_MAX * (1 - hhi)) / maxDiversification);
}

/** Overall score: weighted sum of the three components, with weights converted from percent to fractions. */
export function overallScore(components: ScoreComponents, weights: ScoreWeights): number {
  return clampScore(
    (weights.performancePct / 100) * components.performance +
      (weights.riskFitPct / 100) * components.riskFit +
      (weights.diversificationPct / 100) * components.diversification,
  );
}

/** Maps an average overall score to a rating label. */
export function ratingForAverage(average: number): string {
  if (!Number.isFinite(average)) return 'Not rated';
  const band = RATING_BANDS.find((candidate) => average >= candidate.min);
  return band ? band.label : 'Not rated';
}
