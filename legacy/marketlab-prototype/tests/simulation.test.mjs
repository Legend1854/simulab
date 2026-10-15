import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_KEYS, SCENARIOS, STARTING_CAPITAL,
  validateAllocation, calculatePortfolioReturn, calculateDiversificationScore,
  calculateRiskFitScore, calculateDecisionScore, runSimulationRound, getFinalRating
} from '../simulation.js';

const defaultAllocation = { cash: 15, bonds: 25, market: 40, technology: 20 };

test('default allocation is valid and totals 100%', () => {
  assert.deepEqual(validateAllocation(defaultAllocation), { valid: true, total: 100, message: 'Allocation is balanced and ready to submit.' });
});

test('invalid allocation total is rejected', () => {
  assert.equal(validateAllocation({ ...defaultAllocation, cash: 10 }).valid, false);
  assert.throws(() => calculatePortfolioReturn({ ...defaultAllocation, cash: 10 }, SCENARIOS[0]), /total 100%/);
});

test('allocation rejects out-of-range, decimal and missing values', () => {
  assert.equal(validateAllocation({ ...defaultAllocation, cash: 120, bonds: -5 }).valid, false);
  assert.equal(validateAllocation({ ...defaultAllocation, cash: 15.5 }).valid, false);
  assert.equal(validateAllocation({ cash: 100 }).valid, false);
});

test('portfolio return matches the weighted scenario assumptions', () => {
  assert.ok(Math.abs(calculatePortfolioReturn(defaultAllocation, SCENARIOS[0]) - 0.075) < 1e-10);
  const shock = calculatePortfolioReturn(defaultAllocation, SCENARIOS[1]);
  assert.ok(Math.abs(shock - (-0.1115)) < 1e-10);
});

test('diversification is maximised for equal allocation and zero for one asset', () => {
  assert.equal(calculateDiversificationScore({ cash: 25, bonds: 25, market: 25, technology: 25 }), 100);
  assert.equal(calculateDiversificationScore({ cash: 100, bonds: 0, market: 0, technology: 0 }), 0);
});

test('risk-fit score rewards the selected profile target', () => {
  assert.equal(calculateRiskFitScore(defaultAllocation, 'balanced'), 100);
  assert.equal(calculateRiskFitScore({ cash: 0, bonds: 0, market: 20, technology: 80 }, 'conservative'), 13);
  assert.throws(() => calculateRiskFitScore(defaultAllocation, 'unknown'), /Unknown risk profile/);
});

test('decision score is bounded to 0 through 100', () => {
  assert.equal(calculateDecisionScore(0.5, 100, 100), 100);
  assert.equal(calculateDecisionScore(-0.5, 0, 0), 0);
  assert.ok(calculateDecisionScore(0.02, 80, 75) >= 0);
});

test('round simulation returns expected first-year value and metrics', () => {
  const result = runSimulationRound({ capital: STARTING_CAPITAL, allocation: defaultAllocation, scenario: SCENARIOS[0], riskProfile: 'balanced' });
  assert.ok(Math.abs(result.portfolioReturn - 0.075) < 1e-10);
  assert.equal(result.change, 750);
  assert.equal(result.endingCapital, 10750);
  assert.equal(result.riskFitScore, 100);
  assert.ok(result.decisionScore >= 0 && result.decisionScore <= 100);
});

test('final rating thresholds are mapped', () => {
  assert.equal(getFinalRating(90), 'Strategic thinker');
  assert.equal(getFinalRating(75), 'Steady decision-maker');
  assert.equal(getFinalRating(60), 'Developing investor');
  assert.equal(getFinalRating(30), 'Learning in progress');
  assert.equal(getFinalRating(NaN), 'Not rated');
});

test('each illustrative scenario has a numeric return for all assets', () => {
  for (const scenario of SCENARIOS) {
    for (const key of ASSET_KEYS) assert.ok(Number.isFinite(scenario.returns[key]), `${scenario.title}: ${key}`);
  }
});
