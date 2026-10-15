import { LIMITS } from '../domain/constants';
import { abandonSession, nextRoundOf, ProgressionError, startSession, submitRound } from '../domain/progression';
import type { RoundResult, SimulationConfig, SimulationSession, StudentDecision, ValidationIssue } from '../domain/types';
import { validateConfig } from '../domain/validation';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import {
  clearAllStoredData, loadActiveSessionId, loadConfig, loadSessions, saveActiveSessionId, saveConfig, saveSessions,
  type KeyValueStore, type SaveResult,
} from '../services/persistence/storage';
import { newId, nowIso } from '../utils/ids';

/**
 * Application state and every state transition, independent of React. Components read state through
 * useSyncExternalStore (see StoreContext.tsx) and change it only through these methods, so each rule
 * (one active session, valid decisions only, validated configurations only) lives in one place.
 */

export interface Notice {
  id: string;
  tone: 'info' | 'warning';
  text: string;
}

export interface AppState {
  /** The saved configuration. New sessions start from it. */
  config: SimulationConfig;
  /** Unsaved instructor edits, kept in memory only. Null when there are none. */
  draft: SimulationConfig | null;
  sessions: SimulationSession[];
  activeSessionId: string | null;
  /** True when the active session was restored from storage when the page loaded. */
  resumed: boolean;
  notices: Notice[];
  /** False when localStorage is unavailable and nothing will survive a reload. */
  persistent: boolean;
  saveError: string | null;
}

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string; issues?: ValidationIssue[] };

export interface AppStore {
  getState(): AppState;
  subscribe(listener: () => void): () => void;
  startSession(participantLabel: string): ActionResult<SimulationSession>;
  submitDecision(decision: StudentDecision): ActionResult<RoundResult>;
  abandonActiveSession(): void;
  closeActiveSession(): void;
  dismissResumed(): void;
  setDraft(draft: SimulationConfig | null): void;
  saveConfiguration(config: SimulationConfig): ActionResult;
  deleteSession(id: string): void;
  deleteAllSessions(): void;
  resetEverything(): void;
  dismissNotice(id: string): void;
}

export interface StoreOptions {
  storage: KeyValueStore;
  persistent: boolean;
  clock?: () => string;
  makeId?: (prefix: string) => string;
}

export function activeSessionOf(state: AppState): SimulationSession | null {
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? null;
}

export function createAppStore({ storage, persistent, clock = nowIso, makeId = newId }: StoreOptions): AppStore {
  const loadedConfig = loadConfig(storage);
  const loadedSessions = loadSessions(storage);
  const storedActiveId = loadActiveSessionId(storage);
  const activeSession = loadedSessions.value.find((session) => session.id === storedActiveId);

  const notices: Notice[] = [];
  if (!persistent) {
    notices.push({ id: 'no-storage', tone: 'warning', text: 'Browser storage is unavailable, so progress and settings will be lost when this tab closes.' });
  }
  for (const text of [loadedConfig.notice, loadedSessions.notice]) {
    if (text) notices.push({ id: makeId('notice'), tone: 'warning', text });
  }

  let state: AppState = {
    config: loadedConfig.value,
    draft: null,
    sessions: loadedSessions.value,
    activeSessionId: activeSession ? activeSession.id : null,
    resumed: activeSession?.status === 'in_progress' && activeSession.results.length > 0,
    notices,
    persistent,
    saveError: null,
  };
  const listeners = new Set<() => void>();

  const set = (patch: Partial<AppState>): void => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  /** Writes the given parts of state and records the first failure so the UI can show it. */
  const persist = (parts: { config?: boolean; sessions?: boolean; active?: boolean }, next: AppState): string | null => {
    const results: SaveResult[] = [];
    if (parts.config) results.push(saveConfig(storage, next.config));
    if (parts.sessions) results.push(saveSessions(storage, next.sessions));
    if (parts.active) results.push(saveActiveSessionId(storage, next.activeSessionId));
    const failure = results.find((result): result is { ok: false; error: string } => !result.ok);
    return failure ? failure.error : null;
  };

  const commit = (patch: Partial<AppState>, parts: { config?: boolean; sessions?: boolean; active?: boolean }): void => {
    const next = { ...state, ...patch };
    set({ ...patch, saveError: persist(parts, next) });
  };

  const replaceSession = (sessions: SimulationSession[], updated: SimulationSession): SimulationSession[] =>
    sessions.map((session) => (session.id === updated.id ? updated : session));

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    startSession(participantLabel) {
      const label = participantLabel.trim();
      if (label.length > LIMITS.maxLabelLength) return { ok: false, error: `Nicknames can be up to ${LIMITS.maxLabelLength} characters.` };
      const now = clock();
      // Only one session can be active: an unfinished one is marked abandoned, never deleted.
      const current = activeSessionOf(state);
      let sessions = current ? replaceSession(state.sessions, abandonSession(current, now)) : state.sessions;
      const session = startSession({ config: state.config, participantLabel: label, id: makeId('session'), now });
      sessions = [...sessions, session].slice(-LIMITS.maxStoredSessions);
      commit({ sessions, activeSessionId: session.id, resumed: false }, { sessions: true, active: true });
      return { ok: true, value: session };
    },

    submitDecision(decision) {
      const session = activeSessionOf(state);
      if (!session) return { ok: false, error: 'There is no simulation in progress. Start a new one.' };
      if (nextRoundOf(session) === null) return { ok: false, error: 'This simulation is already finished.' };
      try {
        const updated = submitRound(session, decision, clock());
        commit({ sessions: replaceSession(state.sessions, updated), resumed: false }, { sessions: true });
        const result = updated.results[updated.results.length - 1];
        if (!result) return { ok: false, error: 'The round could not be recorded.' };
        return { ok: true, value: result };
      } catch (caught) {
        if (caught instanceof ProgressionError) return { ok: false, error: caught.message };
        throw caught;
      }
    },

    abandonActiveSession() {
      const session = activeSessionOf(state);
      if (!session) return;
      commit({ sessions: replaceSession(state.sessions, abandonSession(session, clock())), activeSessionId: null, resumed: false }, { sessions: true, active: true });
    },

    closeActiveSession() {
      commit({ activeSessionId: null, resumed: false }, { active: true });
    },

    dismissResumed() {
      set({ resumed: false });
    },

    setDraft(draft) {
      set({ draft });
    },

    saveConfiguration(config) {
      const check = validateConfig(config);
      if (!check.ok) {
        return { ok: false, error: `The configuration has ${check.issues.length} ${check.issues.length === 1 ? 'problem' : 'problems'}. Nothing was saved.`, issues: check.issues };
      }
      commit({ config: structuredClone(check.config), draft: null }, { config: true });
      return { ok: true, value: undefined };
    },

    deleteSession(id) {
      const sessions = state.sessions.filter((session) => session.id !== id);
      const activeSessionId = state.activeSessionId === id ? null : state.activeSessionId;
      commit({ sessions, activeSessionId }, { sessions: true, active: true });
    },

    deleteAllSessions() {
      commit({ sessions: [], activeSessionId: null, resumed: false }, { sessions: true, active: true });
    },

    resetEverything() {
      clearAllStoredData(storage);
      set({ config: structuredClone(DEFAULT_CONFIG), draft: null, sessions: [], activeSessionId: null, resumed: false, saveError: null });
    },

    dismissNotice(id) {
      set({ notices: state.notices.filter((notice) => notice.id !== id) });
    },
  };
}
