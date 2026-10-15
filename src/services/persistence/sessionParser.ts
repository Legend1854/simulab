import { BALANCE_TOLERANCE, LIMITS } from '../../domain/constants';
import { startSession, submitRound } from '../../domain/progression';
import type { SessionStatus, SimulationSession, StudentDecision } from '../../domain/types';
import { validateConfig } from '../../domain/validation';

const STATUSES: ReadonlyArray<SessionStatus> = ['in_progress', 'complete', 'abandoned'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type ParsedSession = { ok: true; session: SimulationSession } | { ok: false; reason: string };

function parseDecision(raw: unknown): StudentDecision | null {
  if (!isRecord(raw) || !isRecord(raw.decision)) return null;
  const { decision } = raw;
  if (typeof decision.round !== 'number' || typeof decision.riskProfileId !== 'string' || !isRecord(decision.allocationPct)) return null;
  const allocationPct: Record<string, number> = {};
  for (const [key, value] of Object.entries(decision.allocationPct)) {
    if (typeof value !== 'number') return null;
    allocationPct[key] = value;
  }
  return { round: decision.round, riskProfileId: decision.riskProfileId, allocationPct };
}

/**
 * Turns untrusted stored data into a trustworthy SimulationSession.
 *
 * The stored decisions are the source of truth. Every derived number is recalculated by the engine
 * and compared with what was stored; a mismatch means the data was edited or corrupted, and the
 * session is rejected rather than shown with numbers nobody can reproduce.
 */
export function parseSession(raw: unknown): ParsedSession {
  if (!isRecord(raw)) return { ok: false, reason: 'not an object' };
  if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 64) return { ok: false, reason: 'missing id' };
  if (typeof raw.participantLabel !== 'string' || raw.participantLabel.length > LIMITS.maxLabelLength) {
    return { ok: false, reason: 'invalid participant label' };
  }
  if (typeof raw.status !== 'string' || !STATUSES.includes(raw.status as SessionStatus)) return { ok: false, reason: 'invalid status' };
  if (typeof raw.createdAt !== 'string' || typeof raw.updatedAt !== 'string') return { ok: false, reason: 'invalid timestamps' };
  const configCheck = validateConfig(raw.config);
  if (!configCheck.ok) return { ok: false, reason: 'invalid configuration snapshot' };
  if (!Array.isArray(raw.results) || raw.results.length > configCheck.config.scenarios.length) return { ok: false, reason: 'invalid results' };

  let replay = startSession({ config: configCheck.config, participantLabel: raw.participantLabel, id: raw.id, now: raw.createdAt });
  for (const [index, storedRaw] of raw.results.entries()) {
    const decision = parseDecision(storedRaw);
    const stored = isRecord(storedRaw) ? storedRaw : {};
    if (!decision || typeof stored.submittedAt !== 'string' || typeof stored.endingBalance !== 'number') {
      return { ok: false, reason: `round ${index + 1} is malformed` };
    }
    try {
      replay = submitRound(replay, decision, stored.submittedAt);
    } catch {
      return { ok: false, reason: `round ${index + 1} could not be replayed` };
    }
    const fresh = replay.results[index];
    if (!fresh || Math.abs(fresh.endingBalance - stored.endingBalance) > BALANCE_TOLERANCE * Math.max(1, Math.abs(fresh.endingBalance))) {
      return { ok: false, reason: `round ${index + 1} does not match a fresh calculation` };
    }
  }

  const status = raw.status as SessionStatus;
  if (status === 'complete' && replay.status !== 'complete') return { ok: false, reason: 'marked complete with missing rounds' };
  if (status !== 'complete' && replay.status === 'complete') return { ok: false, reason: 'all rounds present but not marked complete' };
  return { ok: true, session: { ...replay, status, updatedAt: raw.updatedAt } };
}
