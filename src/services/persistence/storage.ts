import { LIMITS, SCHEMA_VERSION } from '../../domain/constants';
import type { SimulationConfig, SimulationSession } from '../../domain/types';
import { validateConfig } from '../../domain/validation';
import { DEFAULT_CONFIG } from '../../data/defaultConfig';
import { parseSession } from './sessionParser';

/**
 * Versioned browser persistence. Everything is wrapped in an envelope { schemaVersion, savedAt, data }
 * and validated on the way back in. A future server-backed store only needs to implement the same
 * load/save functions; the calculation engine does not change.
 */

/** Minimal storage interface so tests (and a future server-backed store) can replace localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = {
  config: 'simulab.config',
  sessions: 'simulab.sessions',
  activeSession: 'simulab.activeSession',
} as const;

export interface LoadResult<T> {
  value: T;
  /** Set when stored data was outdated or damaged and was replaced. Shown to the user. */
  notice?: string;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/** localStorage when it is usable; otherwise an in-memory store, so the app still works but does not persist. */
export function getBrowserStore(): { store: KeyValueStore; persistent: boolean } {
  try {
    const probe = '__simulab_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return { store: window.localStorage, persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}

function writeEnvelope(store: KeyValueStore, key: string, data: unknown): SaveResult {
  try {
    store.setItem(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), data }));
    return { ok: true };
  } catch (caught) {
    // DOMException is not an Error subclass in every environment, so read the name defensively.
    const name = typeof caught === 'object' && caught !== null && 'name' in caught ? String(caught.name) : 'unknown error';
    return { ok: false, error: `Could not save to browser storage (${name}). Changes are kept until this tab is closed.` };
  }
}

type ReadResult = { status: 'missing' } | { status: 'damaged'; reason: string } | { status: 'outdated' } | { status: 'ok'; data: unknown };

function readEnvelope(store: KeyValueStore, key: string): ReadResult {
  let text: string | null;
  try {
    text = store.getItem(key);
  } catch {
    return { status: 'damaged', reason: 'storage is unavailable' };
  }
  if (text === null) return { status: 'missing' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'damaged', reason: 'the data is not valid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || !('schemaVersion' in parsed) || !('data' in parsed)) {
    return { status: 'damaged', reason: 'the data has an unexpected shape' };
  }
  const envelope = parsed as { schemaVersion: unknown; data: unknown };
  if (envelope.schemaVersion !== SCHEMA_VERSION) return { status: 'outdated' };
  return { status: 'ok', data: envelope.data };
}

/* Configuration ---------------------------------------------------- */

export function loadConfig(store: KeyValueStore): LoadResult<SimulationConfig> {
  const read = readEnvelope(store, STORAGE_KEYS.config);
  const defaults = structuredClone(DEFAULT_CONFIG);
  switch (read.status) {
    case 'missing':
      return { value: defaults };
    case 'outdated':
      return { value: defaults, notice: 'The saved configuration came from a different version of SimuLab, so the defaults were loaded instead.' };
    case 'damaged':
      return { value: defaults, notice: `The saved configuration could not be read (${read.reason}), so the defaults were loaded instead.` };
    case 'ok': {
      const check = validateConfig(read.data);
      return check.ok
        ? { value: check.config }
        : { value: defaults, notice: 'The saved configuration failed validation, so the defaults were loaded instead.' };
    }
  }
}

export const saveConfig = (store: KeyValueStore, config: SimulationConfig): SaveResult => writeEnvelope(store, STORAGE_KEYS.config, config);

/* Sessions ---------------------------------------------------------- */

export function loadSessions(store: KeyValueStore): LoadResult<SimulationSession[]> {
  const read = readEnvelope(store, STORAGE_KEYS.sessions);
  if (read.status === 'missing') return { value: [] };
  if (read.status === 'outdated') return { value: [], notice: 'Saved sessions came from a different version of SimuLab and could not be restored.' };
  if (read.status === 'damaged') return { value: [], notice: `Saved sessions could not be read (${read.reason}) and were cleared.` };
  if (!Array.isArray(read.data)) return { value: [], notice: 'Saved sessions had an unexpected shape and were cleared.' };

  const sessions: SimulationSession[] = [];
  let dropped = 0;
  for (const raw of read.data.slice(-LIMITS.maxStoredSessions)) {
    const parsed = parseSession(raw);
    if (parsed.ok) sessions.push(parsed.session);
    else dropped += 1;
  }
  if (dropped === 0) return { value: sessions };
  const noun = dropped === 1 ? 'session' : 'sessions';
  return { value: sessions, notice: `${dropped} saved ${noun} failed validation and ${dropped === 1 ? 'was' : 'were'} removed.` };
}

export const saveSessions = (store: KeyValueStore, sessions: ReadonlyArray<SimulationSession>): SaveResult =>
  writeEnvelope(store, STORAGE_KEYS.sessions, sessions.slice(-LIMITS.maxStoredSessions));

export function loadActiveSessionId(store: KeyValueStore): string | null {
  const read = readEnvelope(store, STORAGE_KEYS.activeSession);
  return read.status === 'ok' && typeof read.data === 'string' ? read.data : null;
}

export function saveActiveSessionId(store: KeyValueStore, id: string | null): SaveResult {
  if (id !== null) return writeEnvelope(store, STORAGE_KEYS.activeSession, id);
  try {
    store.removeItem(STORAGE_KEYS.activeSession);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not update browser storage.' };
  }
}

/** Removes every key SimuLab owns (the "reset all local data" recovery action). */
export function clearAllStoredData(store: KeyValueStore): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      store.removeItem(key);
    } catch {
      /* nothing more can be done if storage itself is failing */
    }
  }
}
