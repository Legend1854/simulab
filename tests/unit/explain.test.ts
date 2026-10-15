import { describe, expect, it } from 'vitest';
import { evaluateRound } from '../../src/domain/calculations';
import { calculationSteps, explainScores, overallFormula } from '../../src/domain/explain';
import { alloc, cloneConfig, decision, EQUAL_ALLOCATION } from '../helpers';

describe('explanations describe the engine output without recalculating it', () => {
  const config = cloneConfig();
  const outcome = evaluateRound(config, 0, 10000, decision(1, EQUAL_ALLOCATION));

  it('shows the substituted formula for gross return, net return and ending balance', () => {
    const steps = calculationSteps(outcome, config);
    expect(steps.map((s) => s.label)).toEqual(['Gross return', 'Net return', 'Ending balance']);
    expect(steps[0]?.expression).toBe('0.25 × 2% + 0.25 × 4% + 0.25 × 8% + 0.25 × 15%');
    expect(steps[0]?.result).toBe('7.25%');
    expect(steps[1]?.expression).toBe('7.25% − 0.5% fee');
    expect(steps[1]?.result).toBe('6.75%');
    expect(steps[2]?.result).toBe('$10,675.00');
  });

  it('explains each score with its weight and the points it contributes', () => {
    const rows = explainScores(outcome, config, 'Balanced');
    expect(rows.map((r) => r.key)).toEqual(['performance', 'riskFit', 'diversification']);
    expect(rows[1]?.reason).toBe('Your portfolio risk of 50 is 10 points below the Balanced target of 60.');
    expect(rows[2]?.reason).toMatch(/lowest possible concentration/);
    const points = rows.reduce((sum, r) => sum + r.points, 0);
    expect(points).toBeCloseTo(outcome.scores.overall, 12);
    expect(overallFormula(rows)).toBe('0.5 × 66.9 + 0.3 × 87.5 + 0.2 × 100.0');
  });

  it('describes the extremes', () => {
    const single = evaluateRound(config, 0, 10000, decision(1, alloc(0, 0, 0, 100)));
    expect(explainScores(single, config, 'Balanced')[2]?.reason).toMatch(/one asset/);
  });
});

describe('niceTicks (chart axis)', () => {
  it('produces evenly spaced round numbers that bracket the data', async () => {
    const { niceTicks } = await import('../../src/features/student/BalanceChart');
    const ticks = niceTicks(9453.45, 10805.89);
    expect(ticks[0]).toBeLessThanOrEqual(9453.45);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(10805.89);
    const steps = ticks.slice(1).map((t, i) => t - ticks[i]!);
    expect(new Set(steps).size).toBe(1);
    expect(ticks).toEqual([9000, 9500, 10000, 10500, 11000]);
  });
  it('handles a flat series', async () => {
    const { niceTicks } = await import('../../src/features/student/BalanceChart');
    expect(niceTicks(10000, 10000).length).toBeGreaterThanOrEqual(2);
  });
});
