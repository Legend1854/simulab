import { DEFAULT_CONFIG } from '../src/data/defaultConfig';
import type { AllocationPct, SimulationConfig, StudentDecision } from '../src/domain/types';

export const cloneConfig = (overrides: Partial<SimulationConfig> = {}): SimulationConfig => ({
  ...structuredClone(DEFAULT_CONFIG),
  ...overrides,
});

/** Allocation keyed by the default asset ids: cash, bonds, global_equities, tech_equities. */
export const alloc = (cash: number, bonds: number, globalEq: number, tech: number): AllocationPct => ({
  cash,
  bonds,
  global_equities: globalEq,
  tech_equities: tech,
});

export const decision = (round: number, allocationPct: AllocationPct, riskProfileId = 'balanced'): StudentDecision => ({
  round,
  allocationPct,
  riskProfileId,
});

/** The MarketLab default allocation (15 / 25 / 40 / 20) used by the legacy reference workbook. */
export const LEGACY_ALLOCATION = alloc(15, 25, 40, 20);
export const EQUAL_ALLOCATION = alloc(25, 25, 25, 25);
export const NOW = '2026-01-01T00:00:00.000Z';
