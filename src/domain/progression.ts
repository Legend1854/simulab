import { evaluateRound, SimulationError } from './calculations';
import { ratingForAverage } from './scoring';
import type { RoundOutcome, RoundResult, SessionStats, SimulationConfig, SimulationSession, StudentDecision } from './types';
import { validateDecision } from './validation';

export class ProgressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgressionError';
  }
}

export function startSession(params: { config: SimulationConfig; participantLabel: string; id: string; now: string }): SimulationSession {
  return {
    id: params.id,
    participantLabel: params.participantLabel.trim(),
    status: 'in_progress',
    createdAt: params.now,
    updatedAt: params.now,
    config: structuredClone(params.config),
    results: [],
  };
}

export function currentBalanceOf(session: SimulationSession): number {
  const last = session.results[session.results.length - 1];
  return last ? last.endingBalance : session.config.startingBalance;
}

/** 1-based number of the round waiting for a decision, or null when the session accepts no more. */
export function nextRoundOf(session: SimulationSession): number | null {
  if (session.status !== 'in_progress') return null;
  const next = session.results.length + 1;
  return next <= session.config.scenarios.length ? next : null;
}

/** What-if calculation for the next round without changing the session (used for the live projection). */
export function projectNextRound(session: SimulationSession, decision: StudentDecision): RoundOutcome | null {
  const next = nextRoundOf(session);
  if (next === null || validateDecision(decision, session.config, next) !== null) return null;
  return evaluateRound(session.config, next - 1, currentBalanceOf(session), decision);
}

/**
 * The only way a session advances. Explicit transition rules:
 *  - the session must be in progress;
 *  - the decision must be for exactly the next round (so replays, double submits and skips are rejected);
 *  - the decision must be valid;
 *  - a valid submission appends one frozen result; submitting the last round completes the session.
 * The input session is never mutated.
 */
export function submitRound(session: SimulationSession, decision: StudentDecision, now: string): SimulationSession {
  const expected = nextRoundOf(session);
  if (expected === null) throw new ProgressionError('This simulation is not accepting more decisions.');
  const problem = validateDecision(decision, session.config, expected);
  if (problem) throw new ProgressionError(problem);

  let outcome: RoundOutcome;
  try {
    outcome = evaluateRound(session.config, expected - 1, currentBalanceOf(session), decision);
  } catch (caught) {
    if (caught instanceof SimulationError) throw new ProgressionError(caught.message);
    throw caught;
  }
  const result: RoundResult = Object.freeze({ ...outcome, submittedAt: now });
  const results = [...session.results, result];
  return {
    ...session,
    results,
    status: results.length === session.config.scenarios.length ? 'complete' : 'in_progress',
    updatedAt: now,
  };
}

/** Marks an unfinished session as abandoned (used when the participant restarts). Finished sessions are unchanged. */
export function abandonSession(session: SimulationSession, now: string): SimulationSession {
  return session.status === 'in_progress' ? { ...session, status: 'abandoned', updatedAt: now } : session;
}

export function sessionStats(session: SimulationSession): SessionStats {
  const { results, config } = session;
  const count = results.length;
  const currentBalance = currentBalanceOf(session);
  const mean = (pick: (result: RoundResult) => number): number => results.reduce((sum, result) => sum + pick(result), 0) / count;
  const averageScore = count > 0 ? mean((result) => result.scores.overall) : null;
  return {
    roundsCompleted: count,
    totalRounds: config.scenarios.length,
    currentBalance,
    totalReturn: (currentBalance - config.startingBalance) / config.startingBalance,
    averageScore,
    averageComponents:
      count > 0
        ? {
            performance: mean((result) => result.scores.performance),
            riskFit: mean((result) => result.scores.riskFit),
            diversification: mean((result) => result.scores.diversification),
          }
        : null,
    rating: session.status === 'complete' && averageScore !== null ? ratingForAverage(averageScore) : null,
  };
}

/** Balance after each round, starting with the opening balance (round 0). */
export function balanceHistory(session: SimulationSession): Array<{ round: number; balance: number }> {
  return [
    { round: 0, balance: session.config.startingBalance },
    ...session.results.map((result) => ({ round: result.round, balance: result.endingBalance })),
  ];
}
