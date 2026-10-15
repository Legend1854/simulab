import { SCHEMA_VERSION } from '../domain/constants';
import type { SimulationConfig } from '../domain/types';

/**
 * Default configuration, carried over from the MarketLab prototype (see docs/MIGRATION_FROM_MARKETLAB.md):
 *  - the same five illustrative scenarios and the same risk-profile targets (30 / 60 / 80);
 *  - asset ids `market` -> `global_equities` and `technology` -> `tech_equities`;
 *  - risk ratings 0 / 0 / 100 / 100, which make the weighted portfolio risk equal MarketLab's
 *    "risky exposure" (broad market % + technology %), so the original risk-fit rule is preserved.
 * New in SimuLab: an annual management fee, 0.5% by default. Set it to 0 to reproduce the
 * MarketLab reference workbook exactly.
 */
export const DEFAULT_CONFIG: SimulationConfig = {
  schemaVersion: SCHEMA_VERSION,
  name: 'Five-year portfolio challenge',
  startingBalance: 10000,
  annualFeePct: 0.5,
  assets: [
    { id: 'cash', name: 'Cash', description: 'Lowest volatility, modest return.', riskRating: 0 },
    { id: 'bonds', name: 'Government bonds', description: 'Income and relative stability.', riskRating: 0 },
    { id: 'global_equities', name: 'Diversified global equities', description: 'Broad share-market exposure.', riskRating: 100 },
    { id: 'tech_equities', name: 'Technology equities', description: 'Higher growth potential, larger swings.', riskRating: 100 },
  ],
  riskProfiles: [
    { id: 'conservative', name: 'Conservative', description: 'Prioritise stability.', targetRisk: 30 },
    { id: 'balanced', name: 'Balanced', description: 'Mix growth and stability.', targetRisk: 60 },
    { id: 'growth', name: 'Growth', description: 'Accept larger swings for growth.', targetRisk: 80 },
  ],
  scenarios: [
    {
      id: 's1',
      title: 'A steady start',
      phase: 'Baseline',
      description: 'Markets are constructive. Growth assets lead, while bonds and cash provide more modest returns.',
      lesson: 'Compare potential returns with the risk you are willing to accept.',
      returnsPct: { cash: 2, bonds: 4, global_equities: 8, tech_equities: 15 },
    },
    {
      id: 's2',
      title: 'A sudden sell-off',
      phase: 'Market shock',
      description: 'Equities decline sharply. Defensive assets lose less value, showing why allocation matters when conditions change.',
      lesson: 'Higher expected growth can come with larger losses during a downturn.',
      returnsPct: { cash: 2, bonds: -1, global_equities: -14, tech_equities: -28 },
    },
    {
      id: 's3',
      title: 'Recovery takes hold',
      phase: 'Recovery',
      description: 'Risk assets rebound. A diversified portfolio takes part in the recovery, but exposures determine how much.',
      lesson: 'Rebalancing is a trade-off: it changes both risk and how much of a rebound you capture.',
      returnsPct: { cash: 2, bonds: 4, global_equities: 12, tech_equities: 22 },
    },
    {
      id: 's4',
      title: 'Inflation pressures',
      phase: 'Inflation',
      description: 'Higher costs and rates weigh on growth assets. Cash earns more while bonds and equities face pressure.',
      lesson: 'Different conditions affect asset classes differently; no allocation wins every round.',
      returnsPct: { cash: 3, bonds: 1, global_equities: -4, tech_equities: -9 },
    },
    {
      id: 's5',
      title: 'A stronger expansion',
      phase: 'Expansion',
      description: 'Growth improves and equity returns strengthen. Review your result and the risks you took to reach it.',
      lesson: 'The final score weighs return, diversification and fit with your chosen risk approach.',
      returnsPct: { cash: 2, bonds: 3, global_equities: 9, tech_equities: 16 },
    },
  ],
  scoring: {
    weights: { performancePct: 50, riskFitPct: 30, diversificationPct: 20 },
    performanceBaseScore: 50,
    performancePointsPerReturnPct: 2.5,
    riskFitPenaltyPerRiskPoint: 1.25,
  },
};
