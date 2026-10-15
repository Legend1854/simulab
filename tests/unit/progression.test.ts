import { describe, expect, it } from 'vitest';
import {
  abandonSession, balanceHistory, nextRoundOf, ProgressionError, projectNextRound, sessionStats, startSession, submitRound,
} from '../../src/domain/progression';
import { alloc, cloneConfig, decision, LEGACY_ALLOCATION, NOW } from '../helpers';

const fresh = (overrides = {}) => startSession({ config: cloneConfig(overrides), participantLabel: ' Demo ', id: 'sess_1', now: NOW });
const playAll = (overrides = {}) => {
  let session = fresh(overrides);
  for (let round = 1; round <= 5; round += 1) session = submitRound(session, decision(round, LEGACY_ALLOCATION), NOW);
  return session;
};

describe('progression state machine', () => {
  it('starts in progress at round 1 with a trimmed label', () => {
    const session = fresh();
    expect(session.status).toBe('in_progress');
    expect(session.participantLabel).toBe('Demo');
    expect(nextRoundOf(session)).toBe(1);
  });

  it('snapshots the configuration so later instructor edits cannot change a running session', () => {
    const config = cloneConfig();
    const session = startSession({ config, participantLabel: '', id: 's', now: NOW });
    config.annualFeePct = 9;
    expect(session.config.annualFeePct).toBe(0.5);
  });

  it('advances only when a valid decision for the next round is submitted', () => {
    const session = fresh();
    const next = submitRound(session, decision(1, LEGACY_ALLOCATION), NOW);
    expect(next.results).toHaveLength(1);
    expect(nextRoundOf(next)).toBe(2);
    expect(session.results).toHaveLength(0); // the input is not mutated
  });

  it('rejects an invalid allocation without changing the session', () => {
    const session = fresh();
    expect(() => submitRound(session, decision(1, alloc(10, 10, 10, 10)), NOW)).toThrow(ProgressionError);
    expect(session.results).toHaveLength(0);
  });

  it('rejects submitting the same round twice (domain-level double-submit protection)', () => {
    const once = submitRound(fresh(), decision(1, LEGACY_ALLOCATION), NOW);
    expect(() => submitRound(once, decision(1, LEGACY_ALLOCATION), NOW)).toThrow(/round 2 is next/);
    expect(once.results).toHaveLength(1);
  });

  it('rejects skipping ahead', () => {
    expect(() => submitRound(fresh(), decision(3, LEGACY_ALLOCATION), NOW)).toThrow(/round 1 is next/);
  });

  it('carries each ending balance into the next round (multiple sequential rounds, no fee)', () => {
    const session = playAll({ annualFeePct: 0 });
    const balances = session.results.map((r) => r.endingBalance);
    expect(balances[0]).toBeCloseTo(10750, 9);
    expect(balances[1]).toBeCloseTo(9551.375, 9);
    expect(balances[2]).toBeCloseTo(10554.269375, 9);
    expect(balances[3]).toBeCloseTo(10269.304101875, 9);
    expect(balances[4]).toBeCloseTo(11075.444473872187, 6);
    for (let index = 1; index < session.results.length; index += 1) {
      expect(session.results[index]!.startingBalance).toBe(session.results[index - 1]!.endingBalance);
    }
  });

  it('applies the default 0.5% fee across five rounds (independently computed final balance)', () => {
    expect(playAll().results[4]!.endingBalance).toBeCloseTo(10805.88702666, 6);
  });

  it('completes after the last round and then refuses further submissions', () => {
    const session = playAll();
    expect(session.status).toBe('complete');
    expect(nextRoundOf(session)).toBeNull();
    expect(() => submitRound(session, decision(6, LEGACY_ALLOCATION), NOW)).toThrow(/not accepting/);
  });

  it('stores frozen (immutable) round results', () => {
    const session = submitRound(fresh(), decision(1, LEGACY_ALLOCATION), NOW);
    expect(Object.isFrozen(session.results[0])).toBe(true);
  });

  it('abandons only unfinished sessions', () => {
    expect(abandonSession(fresh(), NOW).status).toBe('abandoned');
    expect(abandonSession(playAll(), NOW).status).toBe('complete');
    expect(nextRoundOf(abandonSession(fresh(), NOW))).toBeNull();
  });
});

describe('projectNextRound', () => {
  it('returns the same numbers a submission would, without changing the session', () => {
    const session = fresh();
    const projection = projectNextRound(session, decision(1, LEGACY_ALLOCATION));
    const submitted = submitRound(session, decision(1, LEGACY_ALLOCATION), NOW).results[0]!;
    expect(projection?.endingBalance).toBe(submitted.endingBalance);
    expect(projection?.scores).toEqual(submitted.scores);
    expect(session.results).toHaveLength(0);
  });
  it('returns null for an invalid decision', () => {
    expect(projectNextRound(fresh(), decision(1, alloc(1, 1, 1, 1)))).toBeNull();
  });
});

describe('sessionStats and balanceHistory', () => {
  it('reports balance, total return, averages and a rating once complete', () => {
    let session = fresh({ annualFeePct: 0 });
    expect(sessionStats(session).averageScore).toBeNull();
    for (let round = 1; round <= 5; round += 1) session = submitRound(session, decision(round, LEGACY_ALLOCATION), NOW);
    const stats = sessionStats(session);
    expect(stats.roundsCompleted).toBe(5);
    expect(stats.totalReturn).toBeCloseTo(0.1075444473872187, 9);
    // Independently computed unrounded overall scores for rounds 1-5: 83.4417, 60.1292, 87.1917, 70.6917, 83.8792
    expect(stats.averageScore).toBeCloseTo((83.4417 + 60.1292 + 87.1917 + 70.6917 + 83.8792) / 5, 3);
    expect(stats.rating).toBe('Steady decision-maker');
  });

  it('has no rating while the session is unfinished', () => {
    const session = submitRound(fresh(), decision(1, LEGACY_ALLOCATION), NOW);
    expect(sessionStats(session).rating).toBeNull();
  });

  it('lists the opening balance and each round', () => {
    const history = balanceHistory(submitRound(fresh({ annualFeePct: 0 }), decision(1, LEGACY_ALLOCATION), NOW));
    expect(history).toEqual([{ round: 0, balance: 10000 }, { round: 1, balance: 10750 }]);
  });
});
