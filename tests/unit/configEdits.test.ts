import { describe, expect, it } from 'vitest';
import {
  addAsset, addScenario, moveScenario, removeAsset, removeScenario, updateAsset, updateScenario, updateScenarioReturn,
} from '../../src/domain/configEdits';
import { validateConfig } from '../../src/domain/validation';
import { cloneConfig } from '../helpers';

describe('instructor configuration edits keep the model consistent', () => {
  it('adding an asset adds a 0% return to every scenario and stays valid', () => {
    const config = addAsset(cloneConfig(), 'Gold & Silver');
    const added = config.assets[4]!;
    expect(added.id).toBe('gold_silver');
    expect(config.scenarios.every((s) => s.returnsPct.gold_silver === 0)).toBe(true);
    expect(validateConfig(config).ok).toBe(true);
  });

  it('generates a unique id when the name is taken', () => {
    expect(addAsset(cloneConfig(), 'Cash').assets[4]?.id).toBe('cash_2');
    expect(addAsset(cloneConfig(), '123').assets[4]?.id).toBe('asset_123');
  });

  it('removing an asset removes its returns everywhere, but never below the minimum of two assets', () => {
    const config = removeAsset(cloneConfig(), 'bonds');
    expect(config.assets.map((a) => a.id)).not.toContain('bonds');
    expect(config.scenarios.every((s) => !('bonds' in s.returnsPct))).toBe(true);
    expect(validateConfig(config).ok).toBe(true);
    const two = removeAsset(removeAsset(config, 'cash'), 'global_equities');
    expect(two.assets).toHaveLength(2);
  });

  it('adds, edits and removes scenarios', () => {
    const { config, index } = addScenario(cloneConfig());
    expect(index).toBe(5);
    expect(config.scenarios[5]?.id).toBe('s6');
    const edited = updateScenarioReturn(updateScenario(config, 5, { title: 'Bonus round' }), 5, 'cash', 4);
    expect(edited.scenarios[5]).toMatchObject({ title: 'Bonus round', returnsPct: { cash: 4 } });
    expect(validateConfig(edited).ok).toBe(true);
    expect(removeScenario(edited, 5).scenarios).toHaveLength(5);
  });

  it('reorders rounds and ignores moves past either end', () => {
    const config = cloneConfig();
    expect(moveScenario(config, 1, -1).scenarios.map((s) => s.id)).toEqual(['s2', 's1', 's3', 's4', 's5']);
    expect(moveScenario(config, 4, 1)).toBe(config);
    expect(moveScenario(config, 0, -1)).toBe(config);
  });

  it('does not mutate its input', () => {
    const config = cloneConfig();
    const before = structuredClone(config);
    updateAsset(config, 0, { riskRating: 5 });
    addAsset(config);
    moveScenario(config, 0, 1);
    expect(config).toEqual(before);
  });
});
