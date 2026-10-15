// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EXAMPLE_CONFIG } from '../../src/data/exampleConfig';
import { evaluateRound } from '../../src/domain/calculations';
import { sessionStats, startSession, submitRound } from '../../src/domain/progression';
import { sessionsToCsv } from '../../src/services/exports/csv';
import { loadSessions, MemoryStore, saveSessions } from '../../src/services/persistence/storage';
import { workbookBytes } from '../../src/services/spreadsheets/exportWorkbook';
import { importWorkbook } from '../../src/services/spreadsheets/importWorkbook';
import { cloneConfig, decision, NOW } from '../helpers';

describe('import a workbook, then run the simulation from it', () => {
  const imported = importWorkbook(workbookBytes(EXAMPLE_CONFIG), 'example.xlsx');
  if (!imported.ok) throw new Error(JSON.stringify(imported.issues));
  const { config } = imported;
  const allocation = { cash: 10, bonds: 30, global_equities: 40, tech_equities: 20 };

  it('runs a complete first round with hand-checked numbers', () => {
    const session = submitRound(startSession({ config, participantLabel: 'Integration', id: 'sess_int', now: NOW }), decision(1, allocation), NOW);
    const first = session.results[0]!;
    // Gross: 0.10 x 3% + 0.30 x 5% + 0.40 x 11% + 0.20 x 17% = 0.003 + 0.015 + 0.044 + 0.034 = 9.6%
    expect(first.grossReturn).toBeCloseTo(0.096, 12);
    expect(first.netReturn).toBeCloseTo(0.096 - 0.0075, 12);
    expect(first.endingBalance).toBeCloseTo(25000 * 1.0885, 8);
    // Graded risk: 0.30 x 25 + 0.40 x 70 + 0.20 x 100 = 55.5 against the Balanced target of 50
    expect(first.portfolioRisk).toBeCloseTo(55.5, 10);
    expect(first.scores.riskFit).toBeCloseTo(100 - 1.25 * 5.5, 10);
  });

  it('plays all six rounds, survives a save/load cycle and exports every round', () => {
    let session = startSession({ config, participantLabel: 'Integration', id: 'sess_int', now: NOW });
    for (let round = 1; round <= config.scenarios.length; round += 1) session = submitRound(session, decision(round, allocation), NOW);
    expect(session.status).toBe('complete');
    expect(sessionStats(session).rating).not.toBeNull();

    const store = new MemoryStore();
    saveSessions(store, [session]);
    const [restored] = loadSessions(store).value;
    expect(restored?.results.map((r) => r.endingBalance)).toEqual(session.results.map((r) => r.endingBalance));

    const lines = sessionsToCsv([restored!]).split('\r\n');
    expect(lines).toHaveLength(1 + 6);
    expect(lines[1]).toContain('"Soft landing"');
  });

  it('a failed import leaves the active configuration untouched', () => {
    const active = cloneConfig();
    const before = structuredClone(active);
    expect(importWorkbook(new TextEncoder().encode('not a workbook'), 'bad.xlsx').ok).toBe(false);
    expect(active).toEqual(before);
  });
});

describe('invariants over many random valid allocations (seeded, so deterministic)', () => {
  it('keeps scores within 0-100 and balances consistent with the formulas', () => {
    let seed = 12345;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296; // linear congruential generator
      return seed / 4294967296;
    };
    const config = cloneConfig();
    for (let trial = 0; trial < 500; trial += 1) {
      const cuts = [random(), random(), random()].map((x) => Math.round(x * 100)).sort((a, b) => a - b) as [number, number, number];
      const allocation = { cash: cuts[0], bonds: cuts[1] - cuts[0], global_equities: cuts[2] - cuts[1], tech_equities: 100 - cuts[2] };
      const roundIndex = trial % 5;
      const start = 1000 + random() * 99000;
      const result = evaluateRound(config, roundIndex, start, decision(roundIndex + 1, allocation));
      for (const score of Object.values(result.scores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      expect(result.endingBalance).toBeCloseTo(start * (1 + result.netReturn), 6);
      expect(result.netReturn).toBeCloseTo(result.grossReturn - 0.005, 12);
      expect(result.contributions.reduce((sum, c) => sum + c.contributionPct, 0)).toBeCloseTo(result.grossReturn * 100, 9);
    }
  });
});
