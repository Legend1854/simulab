export const STARTING_CAPITAL = 10000;
export const RISK_TARGETS = Object.freeze({ conservative: 30, balanced: 60, growth: 80 });
export const ASSET_KEYS = Object.freeze(["cash", "bonds", "market", "technology"]);

// Original illustrative scenarios created for this portfolio prototype, not market forecasts.
export const SCENARIOS = Object.freeze([
  { id: 1, phase: "BASELINE", title: "A steady start", description: "Markets are constructive. Growth assets lead, while bonds and cash provide more modest returns.", lesson: "Compare potential returns with the risk you are willing to accept.", returns: { cash: 2, bonds: 4, market: 8, technology: 15 } },
  { id: 2, phase: "MARKET SHOCK", title: "A sudden sell-off", description: "Equities decline sharply. Defensive assets lose less value, showing why allocation matters when conditions change.", lesson: "Higher expected growth can come with larger losses during a downturn.", returns: { cash: 2, bonds: -1, market: -14, technology: -28 } },
  { id: 3, phase: "RECOVERY", title: "Recovery takes hold", description: "Risk assets rebound. A diversified portfolio participates in the recovery, but exposures determine how much.", lesson: "Rebalancing is a trade-off: it can change both risk and rebound participation.", returns: { cash: 2, bonds: 4, market: 12, technology: 22 } },
  { id: 4, phase: "INFLATION", title: "Inflation pressures", description: "Higher costs and rates weigh on growth assets. Cash earns more while bonds and equities face pressure.", lesson: "Different market conditions affect asset classes differently; no allocation wins every round.", returns: { cash: 3, bonds: 1, market: -4, technology: -9 } },
  { id: 5, phase: "EXPANSION", title: "A stronger expansion", description: "Growth improves and equity returns strengthen. Review your ending result and the risks taken to reach it.", lesson: "The final score weighs return, diversification and fit with your chosen risk approach.", returns: { cash: 2, bonds: 3, market: 9, technology: 16 } }
]);

export function validateAllocation(allocation) {
  if (!allocation || typeof allocation !== "object") return { valid: false, total: 0, message: "Enter an allocation for each asset." };
  const values = ASSET_KEYS.map((key) => allocation[key]);
  if (values.some((value) => !Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 100)) {
    return { valid: false, total: values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0), message: "Each allocation must be a whole percentage between 0 and 100." };
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total === 100
    ? { valid: true, total, message: "Allocation is balanced and ready to submit." }
    : { valid: false, total, message: `Allocations must total 100%. You are ${total < 100 ? `${100 - total}% under` : `${total - 100}% over`}.` };
}

export function calculatePortfolioReturn(allocation, scenario) {
  const check = validateAllocation(allocation);
  if (!check.valid) throw new Error(check.message);
  if (!scenario?.returns || ASSET_KEYS.some((key) => !Number.isFinite(scenario.returns[key]))) {
    throw new Error("Scenario return assumptions are incomplete.");
  }
  return ASSET_KEYS.reduce((sum, key) => sum + (allocation[key] / 100) * (scenario.returns[key] / 100), 0);
}

export function calculateDiversificationScore(allocation) {
  const check = validateAllocation(allocation);
  if (!check.valid) throw new Error(check.message);
  const weights = ASSET_KEYS.map((key) => allocation[key] / 100);
  const hhi = weights.reduce((sum, weight) => sum + weight ** 2, 0);
  const maximumDiversification = 1 - 1 / ASSET_KEYS.length;
  return Math.round(Math.max(0, Math.min(100, ((1 - hhi) / maximumDiversification) * 100)));
}

export function calculateRiskFitScore(allocation, riskProfile = "balanced") {
  const check = validateAllocation(allocation);
  if (!check.valid) throw new Error(check.message);
  const target = RISK_TARGETS[riskProfile];
  if (target === undefined) throw new Error("Unknown risk profile.");
  const riskyExposure = allocation.market + allocation.technology;
  return Math.round(Math.max(0, 100 - Math.abs(riskyExposure - target) * 1.25));
}

export function calculateDecisionScore(portfolioReturn, diversificationScore, riskFitScore) {
  if (![portfolioReturn, diversificationScore, riskFitScore].every(Number.isFinite)) throw new Error("Decision score inputs must be numeric.");
  const returnScore = Math.max(0, Math.min(100, 50 + portfolioReturn * 250));
  const score = 0.5 * returnScore + 0.2 * diversificationScore + 0.3 * riskFitScore;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function runSimulationRound({ capital, allocation, scenario, riskProfile }) {
  if (!Number.isFinite(capital) || capital < 0) throw new Error("Starting capital must be a non-negative number.");
  const portfolioReturn = calculatePortfolioReturn(allocation, scenario);
  const change = capital * portfolioReturn;
  const endingCapital = capital + change;
  const diversificationScore = calculateDiversificationScore(allocation);
  const riskFitScore = calculateRiskFitScore(allocation, riskProfile);
  const decisionScore = calculateDecisionScore(portfolioReturn, diversificationScore, riskFitScore);
  return { portfolioReturn, change, endingCapital, diversificationScore, riskFitScore, decisionScore };
}

export function getFinalRating(averageScore) {
  if (!Number.isFinite(averageScore)) return "Not rated";
  if (averageScore >= 85) return "Strategic thinker";
  if (averageScore >= 70) return "Steady decision-maker";
  if (averageScore >= 55) return "Developing investor";
  return "Learning in progress";
}
