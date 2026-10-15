import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/data/defaultConfig';
import { clamp, diversificationScore, overallScore, performanceScore, ratingForAverage, riskFitScore } from '../../src/domain/scoring';

const scoring = DEFAULT_CONFIG.scoring;

describe('performanceScore = clamp(50 + 2.5 x net return in percentage points, 0, 100)', () => {
  it('maps a 4% net return to 60 (the formula uses 4, not 0.04)', () => {
    expect(performanceScore(0.04, scoring)).toBeCloseTo(60, 12);
  });
  it('maps 0% to the base score of 50', () => {
    expect(performanceScore(0, scoring)).toBe(50);
  });
  it('clamps at 0 and 100', () => {
    expect(performanceScore(-0.5, scoring)).toBe(0);
    expect(performanceScore(0.5, scoring)).toBe(100);
  });
  it('uses the configured base and slope', () => {
    expect(performanceScore(0.1, { ...scoring, performanceBaseScore: 40, performancePointsPerReturnPct: 1 })).toBeCloseTo(50, 12);
  });
});

describe('riskFitScore = clamp(100 - penalty x |portfolio risk - target|, 0, 100)', () => {
  it('is 100 when portfolio risk equals the target', () => {
    expect(riskFitScore(60, 60, scoring)).toBe(100);
  });
  it('loses 1.25 points per risk point of distance, in either direction', () => {
    expect(riskFitScore(50, 60, scoring)).toBeCloseTo(87.5, 12);
    expect(riskFitScore(70, 60, scoring)).toBeCloseTo(87.5, 12);
  });
  it('never goes below zero', () => {
    expect(riskFitScore(100, 0, scoring)).toBe(0);
  });
});

describe('diversificationScore = 100 x (1 - HHI) / (1 - 1/n)', () => {
  it('is 100 for an equal split across four assets (HHI 0.25)', () => {
    expect(diversificationScore(0.25, 4)).toBeCloseTo(100, 12);
  });
  it('is 0 when everything is in one asset (HHI 1)', () => {
    expect(diversificationScore(1, 4)).toBe(0);
  });
  it('gives 95.33 for HHI 0.285 (the MarketLab default allocation), which MarketLab rounded to 95', () => {
    expect(diversificationScore(0.285, 4)).toBeCloseTo(95.3333333333, 9);
  });
  it('clamps floating-point drift just outside the range', () => {
    expect(diversificationScore(0.25 - 1e-15, 4)).toBe(100);
  });
  it('needs at least two assets', () => {
    expect(() => diversificationScore(1, 1)).toThrow(RangeError);
  });
});

describe('overallScore', () => {
  it('applies weights converted from percent to fractions', () => {
    const value = overallScore({ performance: 80, riskFit: 60, diversification: 40 }, { performancePct: 50, riskFitPct: 30, diversificationPct: 20 });
    expect(value).toBeCloseTo(0.5 * 80 + 0.3 * 60 + 0.2 * 40, 12);
  });
  it('responds to custom weights', () => {
    expect(overallScore({ performance: 100, riskFit: 0, diversification: 0 }, { performancePct: 100, riskFitPct: 0, diversificationPct: 0 })).toBe(100);
  });
});

describe('ratingForAverage', () => {
  it('maps band boundaries', () => {
    expect(ratingForAverage(85)).toBe('Strategic thinker');
    expect(ratingForAverage(84.99)).toBe('Steady decision-maker');
    expect(ratingForAverage(70)).toBe('Steady decision-maker');
    expect(ratingForAverage(55)).toBe('Developing investor');
    expect(ratingForAverage(54.99)).toBe('Learning in progress');
    expect(ratingForAverage(Number.NaN)).toBe('Not rated');
  });
});

describe('clamp', () => {
  it('bounds a value', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
