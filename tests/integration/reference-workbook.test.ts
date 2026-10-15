// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateRound } from '../../src/domain/calculations';
import type { SimulationConfig } from '../../src/domain/types';
import { parseCellRef } from '../../src/services/spreadsheets/ooxml/cellRef';
import { cellKey, readXlsx, type XlsxCell } from '../../src/services/spreadsheets/ooxml/readXlsx';
import { cloneConfig, decision } from '../helpers';

/**
 * Parity check against the original MarketLab formula workbook (tests/fixtures/MarketLab_Reference_Model.xlsx).
 *
 * Three things are kept separate on purpose:
 *   1. SPREADSHEET INPUTS  - read from the workbook's Inputs and Scenarios sheets.
 *   2. APPLICATION LOGIC   - the TypeScript engine in src/domain. It never reads the Model sheet.
 *   3. SPREADSHEET OUTPUT  - values the spreadsheet application last calculated and saved in the Model
 *                            sheet. These cells hold formulas; SimuLab's reader reports that and returns
 *                            the saved result without evaluating anything.
 * The test feeds (1) into (2) and compares the result with (3).
 *
 * The workbook was written by a different tool from SimuLab's own writer (it uses x: namespace prefixes,
 * absolute relationship targets and byte-order marks), so this test also checks the reader on a file
 * SimuLab did not produce.
 *
 * Documented difference: MarketLab rounds the diversification and risk-fit sub-scores to whole numbers
 * before combining them; SimuLab keeps full precision and rounds only for display. So the whole-number
 * decision score must agree exactly, and the unrounded sub-scores must be within 0.5 of the rounded ones.
 */
const workbook = readXlsx(new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures/MarketLab_Reference_Model.xlsx'))));

function cellAt(sheet: string, address: string): XlsxCell | undefined {
  const ref = parseCellRef(address);
  if (!ref) throw new Error(`bad address ${address}`);
  return workbook.sheets.find((s) => s.name === sheet)?.cells.get(cellKey(ref.row, ref.col));
}

const value = (sheet: string, address: string): number => {
  const cell = cellAt(sheet, address);
  if (cell?.kind !== 'number') throw new Error(`${sheet}!${address} is not a number`);
  return cell.value;
};

// Legacy column order on both sheets: Cash, Bonds, Broad market, Technology.
const LEGACY_ASSET_IDS = ['cash', 'bonds', 'global_equities', 'tech_equities'] as const;
const SCENARIO_COLUMNS = ['C', 'D', 'E', 'F'] as const;
const FIRST_ROUND_ROW = 4;
const ROUNDS = 5;

function configFromWorkbookInputs(): SimulationConfig {
  const config = cloneConfig({ annualFeePct: 0 }); // the legacy workbook has no fee
  config.startingBalance = value('Inputs', 'B3');
  config.scenarios = Array.from({ length: ROUNDS }, (_, index) => {
    const row = FIRST_ROUND_ROW + index;
    return {
      id: `s${index + 1}`,
      title: String(cellAt('Scenarios', `B${row}`)?.value),
      phase: '',
      description: '',
      lesson: '',
      returnsPct: Object.fromEntries(LEGACY_ASSET_IDS.map((id, column) => [id, value('Scenarios', `${SCENARIO_COLUMNS[column]}${row}`)])),
    };
  });
  return config;
}

describe('reading the reference workbook', () => {
  it('finds the three sheets and reports the Model outputs as formulas with saved results', () => {
    expect(workbook.sheets.map((s) => s.name)).toEqual(['Inputs', 'Scenarios', 'Model']);
    expect(cellAt('Model', 'F4')).toMatchObject({ kind: 'number', value: 10750, hasFormula: true });
    expect(cellAt('Inputs', 'B3')).toMatchObject({ kind: 'number', value: 10000, hasFormula: false });
  });
});

describe('the SimuLab engine reproduces the MarketLab reference workbook (fee set to 0)', () => {
  const config = configFromWorkbookInputs();
  const allocationPct = Object.fromEntries(LEGACY_ASSET_IDS.map((id, index) => [id, value('Inputs', `B${8 + index}`)]));

  it('uses the same inputs as the workbook', () => {
    expect(config.startingBalance).toBe(10000);
    expect(allocationPct).toEqual({ cash: 15, bonds: 25, global_equities: 40, tech_equities: 20 });
    expect(config.riskProfiles.find((p) => p.id === 'balanced')?.targetRisk).toBe(value('Inputs', 'B5'));
    expect(config.scenarios.map((s) => s.returnsPct)).toEqual(cloneConfig().scenarios.map((s) => s.returnsPct));
  });

  it('matches return, change, ending capital and scores for all five rounds', () => {
    let balance = config.startingBalance;
    for (let index = 0; index < ROUNDS; index += 1) {
      const row = FIRST_ROUND_ROW + index;
      const outcome = evaluateRound(config, index, balance, decision(index + 1, allocationPct));
      balance = outcome.endingBalance;
      const label = `round ${index + 1}`;
      expect(outcome.grossReturn, `${label} return`).toBeCloseTo(value('Model', `C${row}`), 10);
      expect(outcome.startingBalance, `${label} starting capital`).toBeCloseTo(value('Model', `D${row}`), 8);
      expect(outcome.change, `${label} change`).toBeCloseTo(value('Model', `E${row}`), 8);
      expect(outcome.endingBalance, `${label} ending capital`).toBeCloseTo(value('Model', `F${row}`), 8);
      expect(outcome.scores.performance, `${label} return score`).toBeCloseTo(value('Model', `I${row}`), 10);
      expect(Math.abs(outcome.scores.diversification - value('Model', `G${row}`)), `${label} diversification`).toBeLessThan(0.5);
      expect(Math.abs(outcome.scores.riskFit - value('Model', `H${row}`)), `${label} risk fit`).toBeLessThan(0.5);
      expect(Math.round(outcome.scores.overall), `${label} decision score`).toBe(value('Model', `J${row}`));
    }
    expect(balance).toBeCloseTo(11075.444473872187, 8);
  });

  it('matches the documented reference case: round 1 returns 7.5% and ends at A$10,750', () => {
    const outcome = evaluateRound(config, 0, 10000, decision(1, allocationPct));
    expect(outcome.grossReturn).toBeCloseTo(0.075, 12);
    expect(outcome.endingBalance).toBeCloseTo(10750, 9);
  });
});
