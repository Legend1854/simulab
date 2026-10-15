import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/data/defaultConfig';
import { EXAMPLE_CONFIG } from '../../src/data/exampleConfig';
import { issuesByPath, validateAllocation, validateConfig } from '../../src/domain/validation';
import { alloc, cloneConfig } from '../helpers';

const assets = DEFAULT_CONFIG.assets;

describe('validateAllocation (exact: whole numbers, total exactly 100, no tolerance)', () => {
  it('accepts whole numbers totalling exactly 100', () => {
    const result = validateAllocation(alloc(15, 25, 40, 20), assets);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(100);
  });

  it('rejects 99 and 101 and says how far off the total is', () => {
    expect(validateAllocation(alloc(14, 25, 40, 20), assets).message).toMatch(/1% left to allocate/);
    expect(validateAllocation(alloc(16, 25, 40, 20), assets).message).toMatch(/1% over the limit/);
  });

  it('puts out-of-range messages on the right fields', () => {
    const result = validateAllocation(alloc(120, 0, 0, -20), assets);
    expect(result.valid).toBe(false);
    expect(result.fieldErrors.cash).toMatch(/between 0% and 100%/);
    expect(result.fieldErrors.tech_equities).toMatch(/between 0% and 100%/);
    expect(result.fieldErrors.bonds).toBeUndefined();
  });

  it('rejects decimals, NaN, missing values, unknown assets and non-objects', () => {
    expect(validateAllocation(alloc(15.5, 24.5, 40, 20), assets).fieldErrors.cash).toMatch(/whole number/);
    expect(validateAllocation({ ...alloc(25, 25, 25, 25), bonds: Number.NaN }, assets).fieldErrors.bonds).toMatch(/Enter a percentage/);
    expect(validateAllocation({ cash: 100 }, assets).valid).toBe(false);
    expect(validateAllocation({ ...alloc(25, 25, 25, 25), crypto: 0 }, assets).message).toMatch(/Unknown asset/);
    expect(validateAllocation(null, assets).valid).toBe(false);
  });
});

describe('validateConfig', () => {
  it('accepts the default and example configurations', () => {
    expect(validateConfig(DEFAULT_CONFIG).ok).toBe(true);
    expect(validateConfig(EXAMPLE_CONFIG).ok).toBe(true);
  });

  const codesOf = (config: unknown): string[] => {
    const result = validateConfig(config);
    return result.ok ? [] : result.issues.map((i) => i.code);
  };

  it('rejects score weights that do not total 100%', () => {
    const config = cloneConfig();
    config.scoring.weights = { performancePct: 50, riskFitPct: 30, diversificationPct: 30 };
    expect(codesOf(config)).toContain('weights_total');
  });

  it('accepts decimal weights that total 100 within floating-point tolerance', () => {
    const config = cloneConfig();
    config.scoring.weights = { performancePct: 33.3, riskFitPct: 33.3, diversificationPct: 33.4 };
    expect(validateConfig(config).ok).toBe(true);
  });

  it('rejects duplicate asset identifiers', () => {
    const config = cloneConfig();
    config.assets[1] = { ...config.assets[1]!, id: 'cash' };
    expect(codesOf(config)).toContain('duplicate_id');
  });

  it('rejects invalid identifiers (capitals, spaces)', () => {
    const config = cloneConfig();
    config.assets[0] = { ...config.assets[0]!, id: 'Cash Account' };
    expect(codesOf(config)).toContain('invalid_id');
  });

  it('rejects a scenario missing a return for an asset', () => {
    const config = cloneConfig();
    delete config.scenarios[0]!.returnsPct.bonds;
    expect(codesOf(config)).toContain('missing_return');
  });

  it('rejects a scenario with a return for an unknown asset', () => {
    const config = cloneConfig();
    config.scenarios[0]!.returnsPct.gold = 3;
    expect(codesOf(config)).toContain('unknown_asset');
  });

  it('rejects invalid scenario returns: NaN, below -100%, above +500%, text', () => {
    for (const bad of [Number.NaN, -100.5, 501, '8']) {
      const config = cloneConfig();
      (config.scenarios[0]!.returnsPct as Record<string, unknown>).cash = bad;
      expect(validateConfig(config).ok, String(bad)).toBe(false);
    }
  });

  it('rejects a fee that could take a balance negative (worst case -100% plus a fee)', () => {
    const config = cloneConfig({ annualFeePct: 0.5 });
    config.scenarios[0]!.returnsPct.tech_equities = -100;
    expect(codesOf(config)).toContain('negative_balance');
  });

  it('accepts a -100% worst case when the fee is zero (extreme but valid)', () => {
    const config = cloneConfig({ annualFeePct: 0 });
    config.scenarios[0]!.returnsPct.tech_equities = -100;
    expect(validateConfig(config).ok).toBe(true);
  });

  it('rejects out-of-range starting balance, fee and risk ratings', () => {
    expect(codesOf(cloneConfig({ startingBalance: 0 }))).toContain('out_of_range');
    expect(codesOf(cloneConfig({ annualFeePct: 11 }))).toContain('out_of_range');
    const config = cloneConfig();
    config.assets[0]!.riskRating = 101;
    expect(codesOf(config)).toContain('out_of_range');
  });

  it('rejects asset counts outside 2-8 and empty scenario lists', () => {
    expect(codesOf(cloneConfig({ assets: [DEFAULT_CONFIG.assets[0]!] }))).toContain('asset_count');
    expect(codesOf(cloneConfig({ scenarios: [] }))).toContain('scenario_count');
  });

  it('rejects wrong types and non-objects', () => {
    expect(validateConfig(null).ok).toBe(false);
    expect(validateConfig('hello').ok).toBe(false);
    expect(codesOf({ ...cloneConfig(), startingBalance: '10000' })).toContain('not_a_number');
  });

  it('rejects unsupported schema versions', () => {
    expect(codesOf({ ...cloneConfig(), schemaVersion: 99 })).toContain('schema_version');
  });

  it('exposes field-level messages keyed by model path', () => {
    const result = validateConfig(cloneConfig({ annualFeePct: 50 }));
    if (result.ok) throw new Error('expected failure');
    expect(issuesByPath(result.issues).annualFeePct).toMatch(/Annual fee/);
  });
});
