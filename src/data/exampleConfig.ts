import { SCHEMA_VERSION } from '../domain/constants';
import type { SimulationConfig } from '../domain/types';

/**
 * Fictional scenario pack used for the downloadable example workbook. It differs from the default
 * on purpose so that importing it visibly changes the simulation: six rounds, graded risk ratings,
 * an A$25,000 start and a 0.75% fee. All figures are invented for teaching.
 */
export const EXAMPLE_CONFIG: SimulationConfig = {
  schemaVersion: SCHEMA_VERSION,
  name: 'Rate-cycle pack (fictional example)',
  startingBalance: 25000,
  annualFeePct: 0.75,
  assets: [
    { id: 'cash', name: 'Cash', description: 'Deposits and money-market style holdings.', riskRating: 0 },
    { id: 'bonds', name: 'Government bonds', description: 'Fixed income that reacts to interest-rate moves.', riskRating: 25 },
    { id: 'global_equities', name: 'Diversified global equities', description: 'Broad, diversified share-market exposure.', riskRating: 70 },
    { id: 'tech_equities', name: 'Technology equities', description: 'Concentrated growth-sector exposure.', riskRating: 100 },
  ],
  riskProfiles: [
    { id: 'conservative', name: 'Conservative', description: 'Protect capital first.', targetRisk: 25 },
    { id: 'balanced', name: 'Balanced', description: 'Blend growth with stability.', targetRisk: 50 },
    { id: 'growth', name: 'Growth', description: 'Accept swings for higher potential.', targetRisk: 70 },
  ],
  scenarios: [
    {
      id: 'soft_landing', title: 'Soft landing', phase: 'Expansion',
      description: 'Inflation eases without a recession. Most assets earn a healthy return.',
      lesson: 'Calm years reward growth exposure, but they say little about how you handle stress.',
      returnsPct: { cash: 3, bonds: 5, global_equities: 11, tech_equities: 17 },
    },
    {
      id: 'rate_shock', title: 'Rate shock', phase: 'Tightening',
      description: 'Central banks raise rates faster than expected. Bonds and growth shares both fall.',
      lesson: 'Spreading money across asset classes does not protect you when one driver hits them all.',
      returnsPct: { cash: 4, bonds: -9, global_equities: -12, tech_equities: -22 },
    },
    {
      id: 'credit_scare', title: 'Credit scare', phase: 'Stress',
      description: 'Lending conditions tighten and investors seek safety. Shares sell off while bonds recover.',
      lesson: 'Assets that fell together last round can move apart in the next.',
      returnsPct: { cash: 4, bonds: 6, global_equities: -15, tech_equities: -19 },
    },
    {
      id: 'policy_pivot', title: 'Policy pivot', phase: 'Recovery',
      description: 'Policy turns supportive. Bonds rally and shares begin to recover.',
      lesson: 'After a loss, decide whether the conditions or your goals have changed before you rebalance.',
      returnsPct: { cash: 3, bonds: 8, global_equities: 14, tech_equities: 25 },
    },
    {
      id: 'sideways_year', title: 'Sideways year', phase: 'Consolidation',
      description: 'Markets drift with little direction. Fees and concentration matter more than headlines.',
      lesson: 'When returns are flat, the fee and your diversification choices stand out.',
      returnsPct: { cash: 3, bonds: 2, global_equities: 2, tech_equities: -3 },
    },
    {
      id: 'broad_recovery', title: 'Broad recovery', phase: 'Expansion',
      description: 'Earnings improve and confidence returns across sectors.',
      lesson: 'Look back over all six rounds: which decisions did the scores reward, and why?',
      returnsPct: { cash: 3, bonds: 4, global_equities: 10, tech_equities: 14 },
    },
  ],
  scoring: {
    weights: { performancePct: 40, riskFitPct: 30, diversificationPct: 30 },
    performanceBaseScore: 50,
    performancePointsPerReturnPct: 2.5,
    riskFitPenaltyPerRiskPoint: 1.25,
  },
};
