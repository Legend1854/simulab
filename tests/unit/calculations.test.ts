import { describe, expect, it } from 'vitest';
import { equalSplitAllocation, evaluateRound, getRounds, SimulationError } from '../../src/domain/calculations';
import { alloc, cloneConfig, decision, EQUAL_ALLOCATION, LEGACY_ALLOCATION } from '../helpers';

/**
 * Expected values were computed independently with a separate Python script and written out here as
 * literals. They are not copied from the engine's output. Tolerance is 1e-9 unless stated otherwise.
 */
describe('evaluateRound: reference cases (default config, annual fee 0.5%)', () => {
  const config = cloneConfig();

  it('equal allocation across four assets, round 1', () => {
    const r = evaluateRound(config, 0, 10000, decision(1, EQUAL_ALLOCATION));
    expect(r.grossReturn).toBeCloseTo(0.0725, 9);
    expect(r.netReturn).toBeCloseTo(0.0675, 9);
    expect(r.endingBalance).toBeCloseTo(10675, 9);
    expect(r.portfolioRisk).toBeCloseTo(50, 9);
    expect(r.hhi).toBeCloseTo(0.25, 12);
    expect(r.scores.performance).toBeCloseTo(66.875, 9);
    expect(r.scores.riskFit).toBeCloseTo(87.5, 9);
    expect(r.scores.diversification).toBeCloseTo(100, 9);
    expect(r.scores.overall).toBeCloseTo(79.6875, 9);
  });

  it('100% in one asset (technology), round 1', () => {
    const r = evaluateRound(config, 0, 10000, decision(1, alloc(0, 0, 0, 100)));
    expect(r.grossReturn).toBeCloseTo(0.15, 12);
    expect(r.endingBalance).toBeCloseTo(11450, 9);
    expect(r.scores.performance).toBeCloseTo(86.25, 9);
    expect(r.scores.riskFit).toBeCloseTo(50, 9);
    expect(r.scores.diversification).toBe(0);
    expect(r.scores.overall).toBeCloseTo(58.125, 9);
  });

  it('mixed positive and negative returns, round 2 (sell-off)', () => {
    const r = evaluateRound(config, 1, 10000, decision(2, LEGACY_ALLOCATION));
    expect(r.grossReturn).toBeCloseTo(-0.1115, 9);
    expect(r.netReturn).toBeCloseTo(-0.1165, 9);
    expect(r.endingBalance).toBeCloseTo(8835, 9);
    expect(r.change).toBeCloseTo(-1165, 9);
    expect(r.scores.performance).toBeCloseTo(20.875, 9);
    expect(r.scores.diversification).toBeCloseTo(95.3333333333, 9);
    expect(r.scores.overall).toBeCloseTo(59.5041666667, 8);
  });

  it('records per-asset contributions that add up to the gross return', () => {
    const r = evaluateRound(config, 0, 10000, decision(1, LEGACY_ALLOCATION));
    const total = r.contributions.reduce((sum, c) => sum + c.contributionPct, 0);
    expect(total).toBeCloseTo(r.grossReturn * 100, 9);
    expect(r.contributions.map((c) => c.assetId)).toEqual(['cash', 'bonds', 'global_equities', 'tech_equities']);
  });
});

describe('evaluateRound: zero returns and management fees', () => {
  const zeroScenario = { id: 'zero', title: 'Flat', phase: '', description: '', lesson: '', returnsPct: { cash: 0, bonds: 0, global_equities: 0, tech_equities: 0 } };

  it('zero returns and zero fee leave the balance unchanged; performance is the base score 50', () => {
    const r = evaluateRound(cloneConfig({ annualFeePct: 0, scenarios: [zeroScenario] }), 0, 10000, decision(1, EQUAL_ALLOCATION));
    expect(r.endingBalance).toBe(10000);
    expect(r.change).toBe(0);
    expect(r.scores.performance).toBe(50);
  });

  it('a 0.5% fee on zero returns costs A$50 and lowers performance to 48.75', () => {
    const r = evaluateRound(cloneConfig({ annualFeePct: 0.5, scenarios: [zeroScenario] }), 0, 10000, decision(1, EQUAL_ALLOCATION));
    expect(r.feeRate).toBeCloseTo(0.005, 12);
    expect(r.netReturn).toBeCloseTo(-0.005, 12);
    expect(r.endingBalance).toBeCloseTo(9950, 9);
    expect(r.scores.performance).toBeCloseTo(48.75, 9);
  });

  it('the fee is charged on the starting balance of each round, so it compounds with the balance', () => {
    const config = cloneConfig({ annualFeePct: 2, scenarios: [zeroScenario, { ...zeroScenario, id: 'zero2' }] });
    const first = evaluateRound(config, 0, 10000, decision(1, EQUAL_ALLOCATION));
    const second = evaluateRound(config, 1, first.endingBalance, decision(2, EQUAL_ALLOCATION));
    expect(first.endingBalance).toBeCloseTo(9800, 9);
    expect(second.endingBalance).toBeCloseTo(9604, 9);
  });
});

describe('evaluateRound: extreme but valid inputs', () => {
  const extreme = (value: number) => ({
    id: 'x', title: 'Extreme', phase: '', description: '', lesson: '',
    returnsPct: { cash: value, bonds: value, global_equities: value, tech_equities: value },
  });

  it('+500% on every asset multiplies the balance by 6 and clamps performance at 100', () => {
    const r = evaluateRound(cloneConfig({ annualFeePct: 0, scenarios: [extreme(500)] }), 0, 10000, decision(1, EQUAL_ALLOCATION));
    expect(r.endingBalance).toBeCloseTo(60000, 6);
    expect(r.scores.performance).toBe(100);
  });

  it('-100% with no fee takes the balance to exactly zero and clamps performance at 0', () => {
    const r = evaluateRound(cloneConfig({ annualFeePct: 0, scenarios: [extreme(-100)] }), 0, 10000, decision(1, EQUAL_ALLOCATION));
    expect(r.endingBalance).toBe(0);
    expect(r.scores.performance).toBe(0);
  });

  it('a very large starting balance keeps relative precision', () => {
    const r = evaluateRound(cloneConfig(), 0, 1_000_000_000, decision(1, EQUAL_ALLOCATION));
    expect(r.endingBalance / 1_000_000_000).toBeCloseTo(1.0675, 12);
  });

  it('refuses to produce a negative balance (a second line of defence behind config validation)', () => {
    const config = cloneConfig({ annualFeePct: 1, scenarios: [extreme(-100)] });
    expect(() => evaluateRound(config, 0, 10000, decision(1, EQUAL_ALLOCATION))).toThrow(/negative balance/);
  });

  it('is deterministic: identical inputs give identical outputs', () => {
    const config = cloneConfig();
    expect(evaluateRound(config, 2, 12345.67, decision(3, LEGACY_ALLOCATION))).toEqual(
      evaluateRound(config, 2, 12345.67, decision(3, LEGACY_ALLOCATION)),
    );
  });
});

describe('evaluateRound: error conditions', () => {
  const config = cloneConfig();
  it('rejects allocations that do not total 100', () => {
    expect(() => evaluateRound(config, 0, 10000, decision(1, alloc(10, 25, 40, 20)))).toThrow(SimulationError);
  });
  it('rejects an unknown risk profile', () => {
    expect(() => evaluateRound(config, 0, 10000, decision(1, EQUAL_ALLOCATION, 'reckless'))).toThrow(/risk profile/i);
  });
  it('rejects a round that has no scenario', () => {
    expect(() => evaluateRound(config, 9, 10000, decision(10, EQUAL_ALLOCATION))).toThrow(/no scenario/i);
  });
  it('rejects a negative or non-finite starting balance', () => {
    expect(() => evaluateRound(config, 0, -1, decision(1, EQUAL_ALLOCATION))).toThrow(/non-negative/);
    expect(() => evaluateRound(config, 0, Number.NaN, decision(1, EQUAL_ALLOCATION))).toThrow(/non-negative/);
  });
});

describe('helpers', () => {
  it('getRounds numbers scenarios from 1 in array order', () => {
    const rounds = getRounds(cloneConfig());
    expect(rounds.map((r) => r.round)).toEqual([1, 2, 3, 4, 5]);
    expect(rounds[1]?.scenario.title).toBe('A sudden sell-off');
  });
  it('equalSplitAllocation splits 100 into whole numbers', () => {
    expect(equalSplitAllocation([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }])).toEqual({ a: 25, b: 25, c: 25, d: 25 });
    expect(equalSplitAllocation([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual({ a: 34, b: 33, c: 33 });
  });
});
