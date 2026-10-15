import { LIMITS } from './constants';
import type { Asset, RiskProfile, Scenario, SimulationConfig } from './types';
import { slugId } from '../utils/ids';

/**
 * Pure editing operations used by the instructor dashboard. Each returns a new configuration and keeps
 * the cross-references consistent (every scenario has a return for every asset). Validation of the
 * values themselves is left to validateConfig().
 */

export function updateAsset(config: SimulationConfig, index: number, patch: Partial<Omit<Asset, 'id'>>): SimulationConfig {
  return { ...config, assets: config.assets.map((asset, i) => (i === index ? { ...asset, ...patch } : asset)) };
}

export function addAsset(config: SimulationConfig, name = 'New asset'): SimulationConfig {
  if (config.assets.length >= LIMITS.maxAssets) return config;
  const id = slugId(name, config.assets.map((asset) => asset.id), 'asset');
  return {
    ...config,
    assets: [...config.assets, { id, name, description: '', riskRating: 50 }],
    scenarios: config.scenarios.map((scenario) => ({ ...scenario, returnsPct: { ...scenario.returnsPct, [id]: 0 } })),
  };
}

export function removeAsset(config: SimulationConfig, assetId: string): SimulationConfig {
  if (config.assets.length <= LIMITS.minAssets) return config;
  return {
    ...config,
    assets: config.assets.filter((asset) => asset.id !== assetId),
    scenarios: config.scenarios.map((scenario) => {
      const { [assetId]: _removed, ...rest } = scenario.returnsPct;
      return { ...scenario, returnsPct: rest };
    }),
  };
}

export function updateProfile(config: SimulationConfig, index: number, patch: Partial<Omit<RiskProfile, 'id'>>): SimulationConfig {
  return { ...config, riskProfiles: config.riskProfiles.map((profile, i) => (i === index ? { ...profile, ...patch } : profile)) };
}

export function updateScenario(config: SimulationConfig, index: number, patch: Partial<Omit<Scenario, 'id' | 'returnsPct'>>): SimulationConfig {
  return { ...config, scenarios: config.scenarios.map((scenario, i) => (i === index ? { ...scenario, ...patch } : scenario)) };
}

export function updateScenarioReturn(config: SimulationConfig, index: number, assetId: string, value: number): SimulationConfig {
  return {
    ...config,
    scenarios: config.scenarios.map((scenario, i) => (i === index ? { ...scenario, returnsPct: { ...scenario.returnsPct, [assetId]: value } } : scenario)),
  };
}

/** Adds a scenario as the last round, with a 0% return for every asset. Returns the new config and the new index. */
export function addScenario(config: SimulationConfig): { config: SimulationConfig; index: number } {
  if (config.scenarios.length >= LIMITS.maxRounds) return { config, index: -1 };
  const taken = new Set(config.scenarios.map((scenario) => scenario.id));
  let counter = config.scenarios.length + 1;
  while (taken.has(`s${counter}`)) counter += 1;
  const scenario: Scenario = {
    id: `s${counter}`,
    title: 'New scenario',
    phase: '',
    description: '',
    lesson: '',
    returnsPct: Object.fromEntries(config.assets.map((asset) => [asset.id, 0])),
  };
  return { config: { ...config, scenarios: [...config.scenarios, scenario] }, index: config.scenarios.length };
}

export function removeScenario(config: SimulationConfig, index: number): SimulationConfig {
  if (config.scenarios.length <= LIMITS.minRounds) return config;
  return { ...config, scenarios: config.scenarios.filter((_, i) => i !== index) };
}

/** Moves a scenario up (-1) or down (+1) in the round order. Out-of-range moves return the config unchanged. */
export function moveScenario(config: SimulationConfig, index: number, delta: -1 | 1): SimulationConfig {
  const target = index + delta;
  if (target < 0 || target >= config.scenarios.length) return config;
  const scenarios = [...config.scenarios];
  const [moved] = scenarios.splice(index, 1);
  if (!moved) return config;
  scenarios.splice(target, 0, moved);
  return { ...config, scenarios };
}
