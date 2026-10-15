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

describe('formula text with negative numbers', () => {
  it('wraps negative terms in parentheses and subtracts a negative net return', () => {
    const config = cloneConfig();
    const outcome = evaluateRound(config, 1, 10700, decision(2, alloc(30, 30, 30, 10)));
    const steps = calculationSteps(outcome, config);
    expect(steps[0]?.expression).toBe('0.3 × 2% + 0.3 × (-1%) + 0.3 × (-14%) + 0.1 × (-28%)');
    expect(steps[0]?.result).toBe('-6.70%');
    expect(steps[2]?.expression).toBe('$10,700.00 × (1 − 7.20%)');
    expect(steps[2]?.result).toBe('$9,929.60');
    expect(explainScores(outcome, config, 'Balanced')[0]?.formula).toBe('clamp(50 + 2.5 × (-7.2), 0, 100)');
  });
});

describe('roundStatement', () => {
  it('splits the result into amounts that add up to the ending balance', async () => {
    const { roundStatement } = await import('../../src/domain/explain');
    const outcome = evaluateRound(cloneConfig(), 0, 10000, decision(1, alloc(15, 25, 40, 20)));
    const statement = roundStatement(outcome);
    expect(statement.grossAmount).toBeCloseTo(750, 9);
    expect(statement.feeAmount).toBeCloseTo(50, 9);
    expect(statement.startingBalance + statement.grossAmount - statement.feeAmount).toBeCloseTo(statement.endingBalance, 9);
    expect(statement.endingBalance).toBeCloseTo(10700, 9);
  });
});

describe('roundFeedback', () => {
  it('orders points by the overall score they cost, and names the move that would close the risk gap', async () => {
    const { roundFeedback } = await import('../../src/domain/explain');
    const config = cloneConfig();
    // Round 1, 100% technology, Balanced target 60: risk 100 (40 above), concentration 1.
    const outcome = evaluateRound(config, 0, 10000, decision(1, alloc(0, 0, 0, 100)));
    const points = roundFeedback(outcome, config, 'Balanced');
    expect(points.map((p) => p.key)).toEqual(['diversification', 'riskFit', 'performance']);
    expect(points[0]?.pointsLost).toBeCloseTo(20, 9); // 20% weight x (100 - 0)
    expect(points[1]?.text).toBe(
      'Your portfolio risk of 100 was 40 points above the Balanced target of 60. Moving about 40 percentage points from Technology equities (risk 100) to Cash (risk 0) would have closed the gap.',
    );
    expect(points[0]?.text).toMatch(/largest holding was Technology equities at 100%; an even split \(25% each\)/);
    expect(points[2]?.text).toBe('Your net return after the 0.5% fee was +14.50%. The largest contribution came from Technology equities (100% × 15% = +15% of return).');
  });

  it('suggests a direction when the named asset is not held, and names the largest drag in a loss', async () => {
    const { roundFeedback } = await import('../../src/domain/explain');
    const config = cloneConfig();
    // Round 2 sell-off, all in cash and bonds: risk 0, 60 below the Balanced target.
    const outcome = evaluateRound(config, 1, 10000, decision(2, alloc(50, 50, 0, 0)));
    const risk = roundFeedback(outcome, config, 'Balanced').find((p) => p.key === 'riskFit');
    // Closing a 60-point gap needs 60 points from one asset, but the largest holding is only 50%.
    expect(risk?.text).toMatch(/60 points below the Balanced target of 60\. Shifting money towards higher-rated assets such as Diversified global equities would have moved it closer\./);
    const partial = evaluateRound(config, 1, 10000, decision(2, alloc(80, 0, 20, 0)));
    expect(roundFeedback(partial, config, 'Balanced').find((p) => p.key === 'riskFit')?.text).toMatch(/Moving about 40 percentage points from Cash \(risk 0\) to Diversified global equities \(risk 100\)/);
    const loss = evaluateRound(config, 1, 10000, decision(2, alloc(25, 25, 25, 25)));
    const performance = roundFeedback(loss, config, 'Balanced').find((p) => p.key === 'performance');
    expect(performance?.text).toMatch(/The largest drag was Technology equities \(25% × \(-28%\) = -7% of return\)\./);
  });

  it('recognises an exact risk match and an even split', async () => {
    const { roundFeedback } = await import('../../src/domain/explain');
    const config = cloneConfig();
    const outcome = evaluateRound(config, 0, 10000, decision(1, alloc(25, 25, 25, 25), 'conservative'));
    const points = roundFeedback(outcome, config, 'Conservative');
    expect(points.find((p) => p.key === 'diversification')?.text).toBe('Your money was spread evenly, the maximum diversification score.');
    const matched = evaluateRound(config, 0, 10000, decision(1, alloc(20, 20, 30, 30)));
    expect(roundFeedback(matched, config, 'Balanced').find((p) => p.key === 'riskFit')?.text).toMatch(/sat on the Balanced target of 60/);
  });
});
